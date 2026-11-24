# Android 12 闹钟通知与锁屏试响验收

使用隔离 AOSP Android 12 模拟器（API 31、arm64-v8a）。`./gradlew :app:assembleRelease` 构建退出码为 0，实际安装包为 `com.tntlikely.zhouerfuqi`，版本 `0.3.0-android12-qa (1795517527)`。APK SHA-256 为 `2ddd0488f8719f3b64e2b06d49df3e237d97d2e11efdf7eacf1d6c449ee6be2f`。

| 场景 | 结果 | 实测依据 |
| --- | --- | --- |
| Android 12 的全屏通知设置 | PASS | `dumpsys package` 显示已授予 `USE_FULL_SCREEN_INTENT`。系统没有处理 `MANAGE_APP_USE_FULL_SCREEN_INTENT` 的页面。 |
| 保活向导与通知设置入口 | PASS | 「保活向导 → 闹钟通知」把锁屏通知标为「如有」。首次启动后点「打开通知设置」，直接打开周而复起的通知页，可见「闹钟响铃」类别。 |
| 通知关闭与恢复 | PASS | 关闭系统通知后，向导的通知项转为待开启，设置与首页显示通知已关闭。首页「去开启」直达同一系统页，重新允许通知后返回 App，首页提示消失。冷启动后设置仍显示权限已开启。 |
| 带 PIN 的锁屏试响 | PASS | 从设置安排 30 秒试响。到点前显示器为 `OFF`，系统锁屏为 `showing=true`、`secure=true`。19:05:39.049 触发后显示器变为 `ON`，`AlarmActivity` 全屏显示在锁屏之上。点「关闭」后回到系统锁屏。 |
| 亮屏时点通知 | PASS | 19:02:49.825 触发时主界面仍在前台。展开通知栏点「试响 · 周而复起」，打开原生响铃界面，关闭后返回主界面。 |
| 华为真机 | NOT_RUN | 本轮使用 AOSP 模拟器，华为机型上的通知菜单和锁屏策略需用真机确认。 |

`pnpm test` 的 14 项规则引擎测试和移动端 TypeScript 检查均通过。系统状态、安装版本、截图和启动日志在 `.tools/shots/acceptance-20261124-android12-notifications/`。
