package expo.modules.ibeaconscanner

import android.bluetooth.BluetoothManager
import android.bluetooth.le.BluetoothLeScanner
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Context
import android.os.Handler
import android.os.Looper
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicLong

/**
 * Scan BLE direct par adresse MAC (piste G du debug iBeacon).
 *
 * Pourquoi : sur Pixel 10 / Android 16, les advertisements iBeacon (manufacturer
 * data Apple sub-type 0x02) sont filtres au niveau firmware/HAL avant d'arriver
 * au callback BluetoothLeScanner. Toutes les tentatives (ble-plx brut, ScanFilter
 * Apple, AltBeacon 2.21) ont echoue. Le filtre par adresse MAC contourne ce filtre
 * iBeacon-specifique : Android livre les advertisements du device cible quelle que
 * soit la forme de leur payload manufacturer.
 *
 * On expose le meme nom de module ("IBeaconScanner") et les memes events
 * ("onIBeacon", "onDiag") pour minimiser le diff cote JS. Les champs uuid/major/
 * minor restent dans le payload mais sont vides (l'UUID iBeacon n'est plus parse
 * cote natif).
 *
 * Diagnostics defensifs integres :
 *  - validation MAC (regex AA:BB:CC:DD:EE:FF)
 *  - check BluetoothAdapter present + enabled
 *  - capture onScanFailed avec le code d'erreur
 *  - tick periodique (5s) : scans/matched/last_rssi/age
 *  - warning si aucun advertisement recu apres le premier tick
 */
class IBeaconScannerModule : Module() {

  companion object {
    private val MAC_REGEX = Regex("^[0-9A-Fa-f]{2}(:[0-9A-Fa-f]{2}){5}$")
    private const val TICK_PERIOD_MS = 5000L
  }

  private var scanner: BluetoothLeScanner? = null
  private var callback: ScanCallback? = null
  private val mainHandler = Handler(Looper.getMainLooper())
  private val totalScans = AtomicInteger(0)
  private val matchedScans = AtomicInteger(0)
  private val lastSeenMs = AtomicLong(0L)
  @Volatile private var lastRssi = 0
  @Volatile private var lastName = ""
  @Volatile private var targetMac: String = ""
  // Compteur par MAC vue pendant le scan, pour debug top-N quand on ne
  // matche pas la MAC cible (cas MAC random / privacy-friendly beacon).
  private val macCounts = ConcurrentHashMap<String, AtomicInteger>()
  private var tickRunnable: Runnable? = null

  override fun definition() = ModuleDefinition {
    Name("IBeaconScanner")

    Events("onIBeacon", "onDiag")

    Function("ping") { -> "pong-macscan-v1" }

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

      val s = adapter.bluetoothLeScanner
      if (s == null) {
        diag("no_le_scanner adapter pas pret")
        return@Function
      }

      stopInternal()

      targetMac = mac
      totalScans.set(0)
      matchedScans.set(0)
      lastSeenMs.set(0L)
      lastRssi = 0
      lastName = ""
      macCounts.clear()

      // Pas de ScanFilter : ScanFilter.setDeviceAddress() filtre par defaut
      // sur ADDRESS_TYPE_PUBLIC et rate les adresses random (RPA). On scanne
      // tout comme nRF Connect, on matche cote code dans handleResult().
      val settings = ScanSettings.Builder()
        .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
        .setCallbackType(ScanSettings.CALLBACK_TYPE_ALL_MATCHES)
        .setMatchMode(ScanSettings.MATCH_MODE_AGGRESSIVE)
        .setNumOfMatches(ScanSettings.MATCH_NUM_MAX_ADVERTISEMENT)
        .setLegacy(true)
        .setReportDelay(0L)
        .build()

      val cb = object : ScanCallback() {
        override fun onScanResult(callbackType: Int, result: ScanResult) {
          handleResult(result)
        }
        override fun onBatchScanResults(results: MutableList<ScanResult>) {
          for (r in results) handleResult(r)
        }
        override fun onScanFailed(errorCode: Int) {
          val label = when (errorCode) {
            SCAN_FAILED_ALREADY_STARTED -> "ALREADY_STARTED"
            SCAN_FAILED_APPLICATION_REGISTRATION_FAILED -> "APP_REG_FAILED"
            SCAN_FAILED_FEATURE_UNSUPPORTED -> "FEATURE_UNSUPPORTED"
            SCAN_FAILED_INTERNAL_ERROR -> "INTERNAL_ERROR"
            5 -> "OUT_OF_HW_RESOURCES"
            6 -> "SCANNING_TOO_FREQUENTLY"
            else -> "UNKNOWN"
          }
          diag("scan_failed code=$errorCode ($label)")
        }
      }

      try {
        s.startScan(emptyList(), settings, cb)
        scanner = s
        callback = cb
        diag("scan_started mac=$mac mode=LOW_LATENCY filter=none (match cote code)")
      } catch (e: SecurityException) {
        diag("start_scan_security_err:${e.message} (BLUETOOTH_SCAN refuse ?)")
        return@Function
      } catch (e: Throwable) {
        diag("start_scan_threw:${e.javaClass.simpleName}:${e.message}")
        return@Function
      }

      val tick = object : Runnable {
        override fun run() {
          val n = totalScans.get()
          val m = matchedScans.get()
          val unique = macCounts.size
          val lastMs = lastSeenMs.get()
          val ageMs = if (lastMs == 0L) -1L else System.currentTimeMillis() - lastMs
          diag("tick total=$n matched=$m unique_macs=$unique rssi=${lastRssi}dBm age=${ageMs}ms")
          when {
            n == 0 -> diag("warn aucun_advertisement_recu BT off ? scanner bloque ?")
            m == 0 -> {
              // Top 5 MACs vues pour identifier si notre beacon broadcast
              // avec une MAC differente de celle qu'on attendait.
              val top = macCounts.entries
                .map { it.key to it.value.get() }
                .sortedByDescending { it.second }
                .take(5)
                .joinToString(" ") { "${it.first}=${it.second}" }
              diag("warn target_mac_pas_vu cible=$targetMac top5: $top")
            }
          }
          mainHandler.postDelayed(this, TICK_PERIOD_MS)
        }
      }
      tickRunnable = tick
      mainHandler.postDelayed(tick, TICK_PERIOD_MS)
    }

    Function("stop") {
      stopInternal()
      diag("stopped")
    }

    OnDestroy {
      stopInternal()
    }
  }

  private fun handleResult(result: ScanResult) {
    totalScans.incrementAndGet()
    val deviceAddr = try { result.device?.address ?: "" } catch (_: SecurityException) { "" }
    val addrUp = deviceAddr.uppercase()
    if (addrUp.isNotEmpty()) {
      macCounts.computeIfAbsent(addrUp) { AtomicInteger(0) }.incrementAndGet()
    }

    if (addrUp != targetMac) return

    val m = matchedScans.incrementAndGet()
    lastSeenMs.set(System.currentTimeMillis())
    lastRssi = result.rssi
    val devName = try { result.device?.name } catch (_: SecurityException) { null }
    val name = devName ?: result.scanRecord?.deviceName ?: ""
    if (name.isNotEmpty()) lastName = name
    val tx = try { result.txPower } catch (_: Throwable) { 0 }

    sendEvent(
      "onIBeacon",
      mapOf(
        "uuid" to "",
        "major" to 0,
        "minor" to 0,
        "txPower" to tx,
        "rssi" to result.rssi,
        "deviceId" to addrUp,
        "match" to true
      )
    )

    if (m == 1) {
      diag("first_match rssi=${result.rssi}dBm name='$lastName' tx=$tx")
    }
  }

  private fun stopInternal() {
    try {
      callback?.let { scanner?.stopScan(it) }
    } catch (_: Throwable) {}
    callback = null
    scanner = null
    tickRunnable?.let { mainHandler.removeCallbacks(it) }
    tickRunnable = null
  }

  private fun diag(msg: String) {
    try { sendEvent("onDiag", mapOf("msg" to msg)) } catch (_: Throwable) {}
  }
}
