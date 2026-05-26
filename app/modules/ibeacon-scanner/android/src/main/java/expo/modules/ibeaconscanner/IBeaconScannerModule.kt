package expo.modules.ibeaconscanner

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
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
 * Module natif iBeacon basé sur AltBeacon (Android Beacon Library).
 *
 * Sur Android 8+, AltBeacon utilise par défaut le JobScheduler (scan par lots),
 * ce qui livre n=0 en foreground. On désactive le JobScheduler et on active le
 * foreground service scanning pour obtenir un scan continu avec une notification.
 *
 * Permissions requises (dans ce manifest) :
 *   FOREGROUND_SERVICE + FOREGROUND_SERVICE_CONNECTED_DEVICE (Android 14+)
 *
 * Layout iBeacon : m:2-3=0215,i:4-19,i:20-21,i:22-23,p:24-24
 */
class IBeaconScannerModule : Module() {

  companion object {
    private const val IBEACON_LAYOUT =
      "m:2-3=0215,i:4-19,i:20-21,i:22-23,p:24-24"
    private val REGION = Region("mia-tracker-region", null, null, null)
    private const val NOTIF_ID = 456
    private const val CHANNEL_ID = "mia-beacon-scan"
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

    Function("ping") { -> "pong-altbeacon-v2" }

    Function("start") { uuid: String? ->
      targetUuid = uuid?.uppercase()
      diag("start_called uuid=$targetUuid (AltBeacon v2)")

      val ctx: Context = appContext.reactContext ?: run {
        diag("no_react_context")
        return@Function
      }

      // Tout le setup AltBeacon DOIT tourner sur le main thread (LiveData
      // observeForever exige le main thread).
      mainHandler.post {
        try {
          val appCtx = ctx.applicationContext
          val mgr = BeaconManager.getInstanceForApplication(appCtx)
          mgr.beaconParsers.clear()
          mgr.beaconParsers.add(BeaconParser().setBeaconLayout(IBEACON_LAYOUT))

          // Désactive le JobScheduler (mode batch Android 8+) — utilise à la
          // place le foreground service pour un scan continu sans pauses.
          mgr.setEnableScheduledScanJobs(false)
          mgr.foregroundScanPeriod = 1100L
          mgr.foregroundBetweenScanPeriod = 0L

          // Canal notification (obligatoire Android 8+)
          val nm = appCtx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
          if (nm.getNotificationChannel(CHANNEL_ID) == null) {
            val channel = NotificationChannel(
              CHANNEL_ID,
              "Scan beacon Mia",
              NotificationManager.IMPORTANCE_LOW
            )
            nm.createNotificationChannel(channel)
          }

          val notif = Notification.Builder(appCtx, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("Mia Tracker")
            .setContentText("Recherche du beacon de Mia...")
            .build()

          try {
            mgr.enableForegroundServiceScanning(notif, NOTIF_ID)
            diag("foreground_service_enabled")
          } catch (e: Throwable) {
            diag("foreground_service_err:${e.message}")
          }

          // Pousse explicitement les beaconParsers + scan periods vers le
          // ScanHelper interne. Sans ça, le ScanHelper reste sur sa copie
          // figée (parsers count=0) et le RangeNotifier livre n=0 en boucle.
          try {
            mgr.applySettings()
            diag("settings_applied parsers=${mgr.beaconParsers.size}")
          } catch (e: Throwable) {
            diag("apply_settings_err:${e.message}")
          }

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
            diag("ranging_started_ok (foreground service)")
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
            try { mgr.disableForegroundServiceScanning() } catch (_: Throwable) {}
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
            try { mgr.disableForegroundServiceScanning() } catch (_: Throwable) {}
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
