# 周而复起 0.3.0 验收

应用源码提交为 `f288ba6`。正式 APK 的发布配置提交为 `fe404fe`。

| 检查 | 结果 | 证据 |
|---|---|---|
| 核心规则与类型 | PASS | 14 项核心单测通过，核心包和移动端 TypeScript 检查通过。 |
| Android 覆盖安装 | PASS | `com.tntlikely.zhouerfuqi` 的 arm64 签名 APK 为 `0.3.0 (1795433069)`。APK 签名与 0.2.8 一致。从 0.2.8 覆盖安装后，首次安装时间和首页两个排班组保留。 |
| Android 熄屏试响 | PASS | 在隔离 Android 模拟器从设置安排 30 秒试响。到点前显示器为 OFF、锁屏已显示，19:28:01.897 触发，随后亮屏并打开 `AlarmActivity`。关闭按钮正常，日志无应用崩溃。系统首次全屏提示关闭后已截图。 |
| 小米真机修复验证 | PASS | 用户在 `0.2.8-dev (1795248067)` 上复测通过。该开发包包含同一处 `AlarmActivity` 窗口创建顺序修复。 |
| iOS 锁屏试响 | PASS | iOS 26.5 隔离模拟器安装 `com.tntlikely.zhouerfuqi` 的 `0.3.0` Debug 构建，从设置安排试响。用系统「锁定屏幕」动作锁屏，19:29:59 的系统日志显示 `isDeviceUILocked: 1`，模拟器显示全屏闹钟和「滑动以停止」。 |
| 商店包在真机安装 | NOT_RUN | 本轮锁屏回归使用本地签名 APK 和 iOS 模拟器构建。 |

本地 Android 验收 APK 的 SHA-256 为 `c27f39663a49354717b482943c2e3e4e335fee1a7aa9b32f2110530806c6dfb7`。验收截图保存在本地 `.tools/shots/acceptance-v0.3.0/`。

## 发布

| 渠道 | 结果 | 证据 |
|---|---|---|
| iOS TestFlight | PASS | 签名构建 `0.3.0 (1795433178)` 上传成功。App Store Connect 确认为 `VALID`，外测状态为 `READY_FOR_BETA_SUBMISSION`。由用户发起后续提审。[上传记录](https://github.com/TNT-Likely/zhouerfuqi/actions/runs/45165120347) |
| GitHub APK | PASS | `v0.3.0` 为最新正式 Release，tag 指向 `fe404fe`。已下载并校验 arm64-v8a、armeabi-v7a、x86_64 的包名、架构、签名和版本 `0.3.0 (1795433578)`。`main` 更新清单与 Release 资产一致，下载路径指向正式 tag。[发布页](https://github.com/TNT-Likely/zhouerfuqi/releases/tag/v0.3.0) |
| Google Play 封闭测试 | PASS | `0.3.0 (1795433162)` 的签名 AAB 上传后分配到 `alpha`，Google Play 确认提交成功。[提交记录](https://github.com/TNT-Likely/zhouerfuqi/actions/runs/45165121133) |

## 测试资源清理

已删除本项目的一台 iOS QA 模拟器、两台 Android QA 模拟器和项目构建缓存，并停止 Metro。按删除前的目录占用统计约清理 23.8 GiB。README 演示使用正式 APK 在独立模拟器录制，录制用模拟器与临时文件已删除。
