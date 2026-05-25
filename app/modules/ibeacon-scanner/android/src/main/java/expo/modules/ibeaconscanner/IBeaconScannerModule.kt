package expo.modules.ibeaconscanner

import android.bluetooth.BluetoothManager
import android.bluetooth.le.BluetoothLeScanner
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Context
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.UUID

class IBeaconScannerModule : Module() {

  private var scanner: BluetoothLeScanner? = null
  private var callback: ScanCallback? = null
  private var targetUuid: String? = null

  override fun definition() = ModuleDefinition {
    Name("IBeaconScanner")

    Events("onIBeacon")

    Function("start") { uuid: String? ->
      targetUuid = uuid?.uppercase()
      stopInternal()

      val ctx: Context = appContext.reactContext ?: return@Function
      val btManager = ctx.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
      val adapter = btManager?.adapter ?: return@Function
      val s = adapter.bluetoothLeScanner ?: return@Function

      // ScanFilter explicite : manufacturer Apple (0x004C), pattern iBeacon (0x02 0x15)
      // C'est ce qui débloque la livraison des iBeacons sur Android 14+ (le scan sans
      // filtre les drop silencieusement).
      val filter = ScanFilter.Builder()
        .setManufacturerData(
          0x004C,
          byteArrayOf(0x02, 0x15),
          byteArrayOf(0xFF.toByte(), 0xFF.toByte())
        )
        .build()

      val settings = ScanSettings.Builder()
        .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
        .setCallbackType(ScanSettings.CALLBACK_TYPE_ALL_MATCHES)
        .setMatchMode(ScanSettings.MATCH_MODE_AGGRESSIVE)
        .setNumOfMatches(ScanSettings.MATCH_NUM_MAX_ADVERTISEMENT)
        .build()

      val cb = object : ScanCallback() {
        override fun onScanResult(callbackType: Int, result: ScanResult) {
          handleResult(result)
        }

        override fun onBatchScanResults(results: MutableList<ScanResult>) {
          for (r in results) handleResult(r)
        }

        override fun onScanFailed(errorCode: Int) {
          sendEvent(
            "onIBeacon",
            mapOf(
              "uuid" to "ERROR",
              "major" to errorCode,
              "minor" to 0,
              "txPower" to 0,
              "rssi" to 0,
              "deviceId" to "scan_failed"
            )
          )
        }
      }
      callback = cb
      scanner = s
      try {
        s.startScan(listOf(filter), settings, cb)
      } catch (_: Throwable) {
      }
    }

    Function("stop") {
      stopInternal()
    }

    OnDestroy {
      stopInternal()
    }
  }

  private fun stopInternal() {
    try { callback?.let { scanner?.stopScan(it) } } catch (_: Throwable) {}
    callback = null
    scanner = null
  }

  private fun handleResult(result: ScanResult) {
    val record = result.scanRecord ?: return
    val md = record.getManufacturerSpecificData(0x004C) ?: return
    if (md.size < 23) return
    if (md[0] != 0x02.toByte()) return
    // md[1] = length byte (typiquement 0x15), on ne vérifie pas pour tolérance

    val uuidBytes = md.copyOfRange(2, 18)
    val bb = ByteBuffer.wrap(uuidBytes).order(ByteOrder.BIG_ENDIAN)
    val msb = bb.long
    val lsb = bb.long
    val uuid = UUID(msb, lsb).toString().uppercase()

    val tgt = targetUuid
    if (!tgt.isNullOrEmpty() && uuid != tgt) return

    val major = ((md[18].toInt() and 0xFF) shl 8) or (md[19].toInt() and 0xFF)
    val minor = ((md[20].toInt() and 0xFF) shl 8) or (md[21].toInt() and 0xFF)
    val tx = md[22].toInt() // signed byte → int

    sendEvent(
      "onIBeacon",
      mapOf(
        "uuid" to uuid,
        "major" to major,
        "minor" to minor,
        "txPower" to tx,
        "rssi" to result.rssi,
        "deviceId" to (result.device?.address ?: "")
      )
    )
  }
}
