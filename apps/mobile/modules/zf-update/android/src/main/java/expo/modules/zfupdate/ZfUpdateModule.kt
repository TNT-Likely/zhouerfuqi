package expo.modules.zfupdate

import android.content.Intent
import android.os.Build
import androidx.core.content.FileProvider
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

class ZfUpdateModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ZfUpdate")

    // 当前安装版本(与 update.json 的 versionCode 比较用)
    Function("getVersion") {
      val context = appContext.reactContext ?: throw Exception("React context unavailable")
      val info = context.packageManager.getPackageInfo(context.packageName, 0)
      val code = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        info.longVersionCode.toInt()
      } else {
        @Suppress("DEPRECATION") info.versionCode
      }
      mapOf(
        "versionName" to (info.versionName ?: ""),
        "versionCode" to code,
      )
    }

    // 通过系统安装器安装下载好的 APK(FileProvider content:// 共享)
    Function("installApk") { path: String ->
      val context = appContext.reactContext ?: throw Exception("React context unavailable")
      // expo-file-system 返回 file:// URI;剥前缀后再转 File
      val cleanPath = if (path.startsWith("file://")) {
        java.net.URI(path).path ?: path.removePrefix("file://")
      } else {
        path
      }
      val file = File(cleanPath)
      if (!file.exists()) throw Exception("APK 不存在: $cleanPath")

      val uri = FileProvider.getUriForFile(context, "${context.packageName}.zfupdate", file)
      val intent = Intent(Intent.ACTION_VIEW).apply {
        setDataAndType(uri, "application/vnd.android.package-archive")
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION)
      }
      context.startActivity(intent)
      true
    }
  }
}
