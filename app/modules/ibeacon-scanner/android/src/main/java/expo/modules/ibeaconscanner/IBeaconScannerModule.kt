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

    Events("onIBeacon", "onDiag")

    // Ping synchrone pour vérifier que le module natif est bien chargé côté JS
    Function("ping") { ->
      "pong-v2"
    }

    Function("start") { uuid: String? ->
      targetUuid = uuid?.uppercase()
      stopInternal()

      diag("start_called uuid=$targetUuid")

      val ctx: Context = appContext.reactContext ?: run {
        diag("no_react_context")
        return@Function
      }
      val btManager = ctx.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
      if (btManager == null) { diag("no_bt_manager"); return@Function }
      val adapter = btManager.adapter
      if (adapter == null) { diag("no_bt_adapter"); return@Function }
      if (!adapter.isEnabled) { diag("bt_disabled"); return@Function }
      val s = adapter.bluetoothLeScanner ?: run { diag("no_le_scanner"); return@Function }

      // Filter relâché : manufacturer Apple (0x004C) + byte[0]=0x02 (iBeacon type)
      // Le byte[1] (length 0x15) n'est pas vérifié → tolérant aux firmwares non standards
      val filter = try {
        ScanFilter.Builder()
          .setManufacturerData(
            0x004C,
            byteArrayOf(0x02),
            byteArrayOf(0xFF.toByte())
          )
          .build()
      } catch (e: Throwable) {
        diag("filter_build_failed:${e.message}")
        return@Function
      }

      val settings = ScanSettings.Builder()
        .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
        .setCallbackType(ScanSettings.CALLBACK_TYPE_ALL_MATCHES)
        .setMatchMode(ScanSettings.MATCH_MODE_AGGRESSIVE)
        .setNumOfMatches(ScanSettings.MATCH_NUM_MAX_ADVERTISEMENT)
        .setLegacy(true)
        .build()

      val cb = object : ScanCallback() {
        override fun onScanResult(callbackType: Int, result: ScanResult) {
          diag("scan_result rssi=${result.rssi} addr=${result.device?.address}")
          handleResult(result)
        }

        override fun onBatchScanResults(results: MutableList<ScanResult>) {
          diag("batch_results n=${results.size}")
          for (r in results) handleResult(r)
        }

        override fun onScanFailed(errorCode: Int) {
          diag("scan_failed code=$errorCode")
        }
      }
      callback = cb
      scanner = s
      try {
        s.startScan(listOf(filter), settings, cb)
        diag("scan_started_ok")
      } catch (e: Throwable) {
        diag("start_scan_threw:${e.message}")
      }
    }

    Function("stop") {
      stopInternal()
      diag("stopped")
    }

    OnDestroy {
      stopInternal()
    }
  }

  private fun diag(msg: String) {
    try {
      sendEvent("onDiag", mapOf("msg" to msg))
    } catch (_: Throwable) {}
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

    val uuidBytes = md.copyOfRange(2, 18)
    val bb = ByteBuffer.wrap(uuidBytes).order(ByteOrder.BIG_ENDIAN)
    val msb = bb.long
    val lsb = bb.long
    val uuid = UUID(msb, lsb).toString().uppercase()

    val tgt = targetUuid
    val match = tgt.isNullOrEmpty() || uuid == tgt

    val major = ((md[18].toInt() and 0xFF) shl 8) or (md[19].toInt() and 0xFF)
    val minor = ((md[20].toInt() and 0xFF) shl 8) or (md[21].toInt() and 0xFF)
    val tx = md[22].toInt()

    sendEvent(
      "onIBeacon",
      mapOf(
        "uuid" to uuid,
        "major" to major,
        "minor" to minor,
        "txPower" to tx,
        "rssi" to result.rssi,
        "deviceId" to (result.device?.address ?: ""),
        "match" to match
      )
    )
  }
}
