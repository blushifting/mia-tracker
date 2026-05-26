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
    private const val DIAG_TICK_MS = 5000L
    private const val MAC_LIST_TICK_MS = 1000L
    private const val MAC_LIST_MAX = 25
  }

  // Entree par MAC : derniere mesure observee pour cette adresse pendant
  // la session de scan. Champs @Volatile pour visibilite cross-thread sans
  // synchronisation lourde (la precision exacte du count n'est pas critique).
  private class MacEntry {
    @Volatile var rssi: Int = 0
    @Volatile var lastMs: Long = 0L
    @Volatile var count: Int = 0
    @Volatile var name: String = ""
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
  // Mode discovery : on garde la derniere donnee par MAC pour pousser une
  // liste live cote UI et identifier visuellement le beacon par on/off.
  private val macEntries = ConcurrentHashMap<String, MacEntry>()
  private var diagTickRunnable: Runnable? = null
  private var macListTickRunnable: Runnable? = null

  override fun definition() = ModuleDefinition {
    Name("IBeaconScanner")

    Events("onIBeacon", "onDiag", "onMacList")

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
      macEntries.clear()

      // Pas de ScanFilter : ScanFilter.setDeviceAddress() filtre par defaut
      // sur ADDRESS_TYPE_PUBLIC et rate les adresses random (RPA). On scanne
      // tout comme nRF Connect, on matche cote code dans handleResult().
      val settings = ScanSettings.Builder()
        .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
        .setCallbackType(ScanSettings.CALLBACK_TYPE_ALL_MATCHES)
        .setMatchMode(ScanSettings.MATCH_MODE_AGGRESSIVE)
        .setNumOfMatches(ScanSettings.MATCH_NUM_MAX_ADVERTISEMENT)
        // Legacy=false : accepter BT4.x ET BLE5 extended advertising. Sans
        // ca, les beacons qui broadcast en extended (format moderne, plus
        // de payload) sont invisibles. nRF Connect scanne les deux par
        // defaut, c'est pour ca qu'il voit le device.
        .setLegacy(false)
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
        diag("scan_started mac=$mac mode=LOW_LATENCY legacy=false filter=none")
      } catch (e: SecurityException) {
        diag("start_scan_security_err:${e.message} (BLUETOOTH_SCAN refuse ?)")
        return@Function
      } catch (e: Throwable) {
        diag("start_scan_threw:${e.javaClass.simpleName}:${e.message}")
        return@Function
      }

      val diagTick = object : Runnable {
        override fun run() {
          val n = totalScans.get()
          val m = matchedScans.get()
          val unique = macEntries.size
          val lastMs = lastSeenMs.get()
          val ageMs = if (lastMs == 0L) -1L else System.currentTimeMillis() - lastMs
          diag("tick total=$n matched=$m unique_macs=$unique rssi=${lastRssi}dBm age=${ageMs}ms")
          if (n == 0) {
            diag("warn aucun_advertisement_recu BT off ? scanner bloque ?")
          }
          mainHandler.postDelayed(this, DIAG_TICK_MS)
        }
      }
      diagTickRunnable = diagTick
      mainHandler.postDelayed(diagTick, DIAG_TICK_MS)

      val macListTick = object : Runnable {
        override fun run() {
          val now = System.currentTimeMillis()
          // Snapshot trie par fraicheur (plus recent en tete), limite a
          // MAC_LIST_MAX entrees pour rester lisible cote UI.
          val items = macEntries.entries
            .map { (mac, e) ->
              mapOf(
                "mac" to mac,
                "rssi" to e.rssi,
                "ageMs" to (now - e.lastMs),
                "count" to e.count,
                "name" to e.name,
              )
            }
            .sortedBy { it["ageMs"] as Long }
            .take(MAC_LIST_MAX)
          try {
            sendEvent("onMacList", mapOf(
              "items" to items,
              "total" to totalScans.get(),
              "unique" to macEntries.size,
              "target" to targetMac,
            ))
          } catch (_: Throwable) {}
          mainHandler.postDelayed(this, MAC_LIST_TICK_MS)
        }
      }
      macListTickRunnable = macListTick
      mainHandler.postDelayed(macListTick, MAC_LIST_TICK_MS)
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
    val now = System.currentTimeMillis()
    val deviceAddr = try { result.device?.address ?: "" } catch (_: SecurityException) { "" }
    val addrUp = deviceAddr.uppercase()
    val devName = try { result.device?.name } catch (_: SecurityException) { null }
    val name = devName ?: result.scanRecord?.deviceName ?: ""

    if (addrUp.isNotEmpty()) {
      val entry = macEntries.computeIfAbsent(addrUp) { MacEntry() }
      entry.rssi = result.rssi
      entry.lastMs = now
      entry.count++
      if (name.isNotEmpty()) entry.name = name
    }

    if (addrUp != targetMac) return

    val m = matchedScans.incrementAndGet()
    lastSeenMs.set(now)
    lastRssi = result.rssi
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
    diagTickRunnable?.let { mainHandler.removeCallbacks(it) }
    diagTickRunnable = null
    macListTickRunnable?.let { mainHandler.removeCallbacks(it) }
    macListTickRunnable = null
  }

  private fun diag(msg: String) {
    try { sendEvent("onDiag", mapOf("msg" to msg)) } catch (_: Throwable) {}
  }
}
