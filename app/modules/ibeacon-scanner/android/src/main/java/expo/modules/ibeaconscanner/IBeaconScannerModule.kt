package expo.modules.ibeaconscanner

import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.content.Context
import android.os.Handler
import android.os.Looper
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicLong

/**
 * Tracking BLE par connexion active (workaround filtre anti-tracker Pixel/Android 16+).
 *
 * Pourquoi : Android Pixel filtre activement les advertisements iBeacon Apple
 * sub-type 0x02 provenant de devices connectables (mesure anti-stalking depuis
 * Android 14+). Tous les scans tentes (ble-plx, BluetoothLeScanner natif avec ou
 * sans filtre MAC, AltBeacon) reviennent vides pour ce device, alors que nRF
 * Connect le voit parfaitement. La connexion GATT directe par MAC, elle, n'est
 * pas concernee par ce filtre (commande HCI "LE Create Connection" directe,
 * sans passer par le scan).
 *
 * Strategie : connectGatt(autoConnect=false) initiale, puis readRemoteRssi() en
 * boucle (1 lecture/s). Quand le beacon nous deconnecte (timeout typique ~5-15s
 * pour economiser sa batterie), on retry une nouvelle connexion. autoConnect=true
 * serait plus robuste en theorie mais s'appuie sur le scan background — qui est
 * justement bloque pour ce device, donc inutilisable ici.
 *
 * API : on garde le nom IBeaconScanner et les events onIBeacon + onDiag pour
 * compatibilite avec le code JS existant. Les champs uuid/major/minor de l'event
 * sont vides, seul rssi est rempli.
 */
class IBeaconScannerModule : Module() {

  companion object {
    private val MAC_REGEX = Regex("^[0-9A-Fa-f]{2}(:[0-9A-Fa-f]{2}){5}$")
    private const val RSSI_POLL_MS = 1000L
    private const val DIAG_TICK_MS = 5000L
    private const val RECONNECT_DELAY_MS = 2000L
  }

  private val mainHandler = Handler(Looper.getMainLooper())
  @Volatile private var gatt: BluetoothGatt? = null
  @Volatile private var targetMac: String = ""
  @Volatile private var lastRssi = 0
  private val isConnected = AtomicBoolean(false)
  private val stopRequested = AtomicBoolean(false)
  private val rssiReads = AtomicInteger(0)
  private val connectionAttempts = AtomicInteger(0)
  private val disconnections = AtomicInteger(0)
  private val lastRssiMs = AtomicLong(0L)

  private var rssiPollRunnable: Runnable? = null
  private var reconnectRunnable: Runnable? = null
  private var diagTickRunnable: Runnable? = null

  private val gattCallback = object : BluetoothGattCallback() {
    override fun onConnectionStateChange(g: BluetoothGatt, status: Int, newState: Int) {
      when (newState) {
        BluetoothProfile.STATE_CONNECTED -> {
          isConnected.set(true)
          diag("connected status=$status attempt=${connectionAttempts.get()}")
          // Certains stacks exigent discoverServices() avant readRemoteRssi().
          try { g.discoverServices() } catch (_: Throwable) {}
          startRssiPoll()
        }
        BluetoothProfile.STATE_DISCONNECTED -> {
          val wasConnected = isConnected.getAndSet(false)
          stopRssiPoll()
          disconnections.incrementAndGet()
          diag("disconnected status=$status wasConnected=$wasConnected")
          // Important : close() libere les ressources du gatt cote Android.
          try { g.close() } catch (_: Throwable) {}
          if (gatt === g) gatt = null
          if (!stopRequested.get()) scheduleReconnect()
        }
      }
    }

    override fun onServicesDiscovered(g: BluetoothGatt, status: Int) {
      diag("services_discovered status=$status count=${g.services?.size ?: 0}")
    }

    override fun onReadRemoteRssi(g: BluetoothGatt, rssi: Int, status: Int) {
      if (status != BluetoothGatt.GATT_SUCCESS) {
        diag("read_rssi_failed status=$status")
        return
      }
      val n = rssiReads.incrementAndGet()
      lastRssi = rssi
      lastRssiMs.set(System.currentTimeMillis())
      sendEvent(
        "onIBeacon",
        mapOf(
          "uuid" to "",
          "major" to 0,
          "minor" to 0,
          "txPower" to 0,
          "rssi" to rssi,
          "deviceId" to targetMac,
          "match" to true
        )
      )
      if (n == 1) diag("first_rssi ${rssi}dBm")
    }
  }

  override fun definition() = ModuleDefinition {
    Name("IBeaconScanner")

    Events("onIBeacon", "onDiag")

    Function("ping") { -> "pong-connect-v1" }

    Function("start") { macParam: String? ->
      val mac = (macParam ?: "").uppercase().trim()
      diag("start_called mac=$mac")

      if (!MAC_REGEX.matches(mac)) {
        diag("bad_mac '$mac' attendu AA:BB:CC:DD:EE:FF")
        return@Function
      }

      val ctx: Context = appContext.reactContext ?: run {
        diag("no_react_context")
        return@Function
      }

      val btMgr = ctx.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
      val adapter = btMgr?.adapter
      if (adapter == null) {
        diag("no_bluetooth_adapter")
        return@Function
      }
      if (!adapter.isEnabled) {
        diag("bt_disabled active le Bluetooth")
        return@Function
      }

      // Reset complet de l'etat de session.
      stopInternal()
      stopRequested.set(false)
      targetMac = mac
      lastRssi = 0
      lastRssiMs.set(0L)
      rssiReads.set(0)
      connectionAttempts.set(0)
      disconnections.set(0)

      connectOnce(ctx, adapter)

      // Tick periodique de diag pour suivre la sante de la connexion.
      val diagTick = object : Runnable {
        override fun run() {
          val now = System.currentTimeMillis()
          val ageMs = if (lastRssiMs.get() == 0L) -1L else now - lastRssiMs.get()
          diag(
            "tick connected=${isConnected.get()} reads=${rssiReads.get()} " +
              "attempts=${connectionAttempts.get()} disconnects=${disconnections.get()} " +
              "rssi=${lastRssi}dBm age=${ageMs}ms"
          )
          mainHandler.postDelayed(this, DIAG_TICK_MS)
        }
      }
      diagTickRunnable = diagTick
      mainHandler.postDelayed(diagTick, DIAG_TICK_MS)
    }

    Function("stop") {
      stopRequested.set(true)
      stopInternal()
      diag("stopped")
    }

    OnDestroy {
      stopRequested.set(true)
      stopInternal()
    }
  }

  private fun connectOnce(ctx: Context, adapter: android.bluetooth.BluetoothAdapter) {
    if (stopRequested.get()) return
    val device: BluetoothDevice = try {
      adapter.getRemoteDevice(targetMac)
    } catch (e: IllegalArgumentException) {
      diag("invalid_mac:${e.message}")
      return
    }
    val attempt = connectionAttempts.incrementAndGet()
    try {
      // autoConnect=false : "directed connection" (commande HCI LE Create
      // Connection directe) — ne depend PAS du scan, donc contourne le filtre
      // anti-tracker. autoConnect=true serait inutilisable ici car il s'appuie
      // sur la decouverte par scan, qui est justement bloquee.
      val newGatt = device.connectGatt(ctx, false, gattCallback, BluetoothDevice.TRANSPORT_LE)
      gatt = newGatt
      diag("connect_initiated attempt=$attempt autoConnect=false transport=LE")
    } catch (e: SecurityException) {
      diag("connect_security_err:${e.message}")
    } catch (e: Throwable) {
      diag("connect_threw:${e.javaClass.simpleName}:${e.message}")
    }
  }

  private fun scheduleReconnect() {
    if (stopRequested.get()) return
    reconnectRunnable?.let { mainHandler.removeCallbacks(it) }
    val r = Runnable {
      if (stopRequested.get()) return@Runnable
      val ctx = appContext.reactContext ?: run {
        diag("reconnect_skipped no_context")
        return@Runnable
      }
      val adapter = (ctx.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager)?.adapter
      if (adapter == null || !adapter.isEnabled) {
        diag("reconnect_skipped bt_off")
        return@Runnable
      }
      connectOnce(ctx, adapter)
    }
    reconnectRunnable = r
    mainHandler.postDelayed(r, RECONNECT_DELAY_MS)
  }

  private fun startRssiPoll() {
    stopRssiPoll()
    val poll = object : Runnable {
      override fun run() {
        if (stopRequested.get() || !isConnected.get()) return
        val g = gatt
        if (g != null) {
          try {
            if (!g.readRemoteRssi()) diag("read_rssi_returned_false")
          } catch (e: SecurityException) {
            diag("read_rssi_security_err:${e.message}")
          } catch (e: Throwable) {
            diag("read_rssi_threw:${e.message}")
          }
        }
        mainHandler.postDelayed(this, RSSI_POLL_MS)
      }
    }
    rssiPollRunnable = poll
    mainHandler.postDelayed(poll, 200L)
  }

  private fun stopRssiPoll() {
    rssiPollRunnable?.let { mainHandler.removeCallbacks(it) }
    rssiPollRunnable = null
  }

  private fun stopInternal() {
    stopRssiPoll()
    reconnectRunnable?.let { mainHandler.removeCallbacks(it) }
    reconnectRunnable = null
    diagTickRunnable?.let { mainHandler.removeCallbacks(it) }
    diagTickRunnable = null
    val g = gatt
    gatt = null
    if (g != null) {
      try { g.disconnect() } catch (_: Throwable) {}
      try { g.close() } catch (_: Throwable) {}
    }
    isConnected.set(false)
  }

  private fun diag(msg: String) {
    try { sendEvent("onDiag", mapOf("msg" to msg)) } catch (_: Throwable) {}
  }
}
