package expo.modules.ibeaconscanner

import android.content.Context
import android.os.Handler
import android.os.Looper
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.altbeacon.beacon.Beacon
import org.altbeacon.beacon.BeaconManager
import org.altbeacon.beacon.BeaconParser
import org.altbeacon.beacon.RangeNotifier
import org.altbeacon.beacon.Region
import java.util.concurrent.atomic.AtomicInteger

/**
 * Module natif iBeacon basé sur la lib AltBeacon (Android Beacon Library).
 *
 * Pourquoi : sur Android 14+ (et clairement Pixel 10 / Android 16), un scan
 * BluetoothLeScanner standard, même avec un ScanFilter explicite sur
 * manufacturer data Apple 0x004C + pattern 02 15, ne livre PAS les
 * advertising iBeacon (les autres sous-types Apple, AirTag/AirPods, passent
 * normalement). AltBeacon utilise des techniques de scan/parsing qui
 * contournent ce filtrage Android.
 *
 * Layout iBeacon : m:2-3=0215,i:4-19,i:20-21,i:22-23,p:24-24
 *   - bytes 0-1 : company ID (4C 00) — implicite
 *   - bytes 2-3 : type+length 02 15
 *   - bytes 4-19 : UUID
 *   - bytes 20-21 : major
 *   - bytes 22-23 : minor
 *   - byte 24 : tx power
 */
class IBeaconScannerModule : Module() {

  companion object {
    private const val IBEACON_LAYOUT =
      "m:2-3=0215,i:4-19,i:20-21,i:22-23,p:24-24"
    private val REGION = Region("mia-tracker-region", null, null, null)
  }

  private var beaconManager: BeaconManager? = null
  private var notifier: RangeNotifier? = null
  private var targetUuid: String? = null
  private val rangeCount = AtomicInteger(0)
  private val beaconCount = AtomicInteger(0)
  private val mainHandler = Handler(Looper.getMainLooper())

  override fun definition() = ModuleDefinition {
    Name("IBeaconScanner")

    Events("onIBeacon", "onDiag")

    Function("ping") { -> "pong-altbeacon" }

    Function("start") { uuid: String? ->
      targetUuid = uuid?.uppercase()
      diag("start_called uuid=$targetUuid (AltBeacon)")

      val ctx: Context = appContext.reactContext ?: run {
        diag("no_react_context")
        return@Function
      }

      // Tout le setup AltBeacon DOIT tourner sur le main thread (LiveData
      // observeForever exige le main thread). Sinon : "Method addObserver
      // must be called on the main thread"
      mainHandler.post {
        try {
          val mgr = BeaconManager.getInstanceForApplication(ctx.applicationContext)
          mgr.beaconParsers.clear()
          mgr.beaconParsers.add(BeaconParser().setBeaconLayout(IBEACON_LAYOUT))

          mgr.foregroundScanPeriod = 1100L
          mgr.foregroundBetweenScanPeriod = 0L

          notifier?.let { mgr.removeRangeNotifier(it) }

          rangeCount.set(0)
          beaconCount.set(0)

          val n = RangeNotifier { beacons: Collection<Beacon>, _: Region ->
            rangeCount.incrementAndGet()
            beaconCount.addAndGet(beacons.size)
            diag("range n=${beacons.size} total=${beaconCount.get()}")
            for (b in beacons) {
              val uuid2 = b.id1?.toString()?.uppercase() ?: continue
              val major = try { b.id2.toInt() } catch (_: Throwable) { 0 }
              val minor = try { b.id3.toInt() } catch (_: Throwable) { 0 }
              val tx = b.txPower
              val rssi = b.rssi
              val tgt = targetUuid
              val match = tgt.isNullOrEmpty() || uuid2 == tgt
              sendEvent(
                "onIBeacon",
                mapOf(
                  "uuid" to uuid2,
                  "major" to major,
                  "minor" to minor,
                  "txPower" to tx,
                  "rssi" to rssi,
                  "deviceId" to (b.bluetoothAddress ?: ""),
                  "match" to match
                )
              )
            }
          }
          notifier = n
          mgr.addRangeNotifier(n)

          try {
            mgr.startRangingBeacons(REGION)
            diag("ranging_started_ok (main thread)")
          } catch (e: Throwable) {
            diag("start_ranging_threw:${e.message}")
          }

          beaconManager = mgr
        } catch (e: Throwable) {
          diag("init_threw:${e.message}")
        }
      }
    }

    Function("stop") {
      mainHandler.post {
        try {
          beaconManager?.let { mgr ->
            notifier?.let { mgr.removeRangeNotifier(it) }
            mgr.stopRangingBeacons(REGION)
          }
        } catch (_: Throwable) {}
        notifier = null
        beaconManager = null
        diag("stopped")
      }
    }

    OnDestroy {
      mainHandler.post {
        try {
          beaconManager?.let { mgr ->
            notifier?.let { mgr.removeRangeNotifier(it) }
            mgr.stopRangingBeacons(REGION)
          }
        } catch (_: Throwable) {}
        notifier = null
        beaconManager = null
      }
    }
  }

  private fun diag(msg: String) {
    try {
      sendEvent("onDiag", mapOf("msg" to msg))
    } catch (_: Throwable) {}
  }
}
