# 周而复起 / RosterWake 双语隔离验收

2026 年 11 月 25 日。验收以 `main` 的 `80c476c` 为基线，包含当前工作区的中英文本地化与响铃页修复。设备内只录入了合成班表。

| 设备 | 安装后核验 |
| --- | --- |
| Android 37.2 隔离模拟器 | `com.tntlikely.zhouerfuqi`。最终 arm64 Release APK 的 SHA-256 为 `7c54c433f78e485f8813c9c4b0c1c13358bd57cb1b8b855d71a9f8b7e8d20068`，与设备安装的 APK 一致。本地 Gradle 构建显示 `0.1.0 (1)`，正式工作流通过参数注入发布版本号。 |
| iPhone 17 Pro Max，iOS 26.5 隔离模拟器 | Xcode 27.2 (`27B52`) 的模拟器 Release 构建，安装后为 `com.tntlikely.zhouerfuqi`，`0.4.0 (1794758803)`。最终构建与已安装 App 的 JS 包和小组件二进制哈希一致。 |

| 场景 | 结论 | 实测依据 |
| --- | --- | --- |
| Android 双语首次建班表 | PASS | 从模板创建合成轮班，通过系统弹窗授予通知权限。首页显示系统登记，`dumpsys alarm` 中有 7 条独立响铃。英文显示 `7:00 AM` 且月历周日开头，简中显示 `07:00` 且周一开头。 |
| Android 从设置切换应用语言 | PASS | 经应用设置打开系统应用语言，选择「简体中文 → 中国」。界面切换为简中，已有英文班组名称和标签可用，7 条系统响铃的标识和触发时间一致。 |
| Android 覆盖安装 | PASS | 使用 `adb install -r` 安装最终修复包。覆盖前后的 7 条实际系统响铃保持一致。 |
| Android 双语锁屏试响与停止 | PASS | 两种语言都从设置安排一次真实试响。休眠状态进入原生 `AlarmActivity`，显示完整的本地化时钟、日期和停止按钮。停止后回到应用，系统登记恢复为原来的 7 条。初版英文钟面裁切已在最终包中复验。 |
| Android 应用内响铃页 | PASS | 从 `/ring` 深链传入旧格式 `19:00`，英文 12 小时界面显示 `7:00 PM`，停止后显示 `Alarm stopped`。 |
| iOS 双语建档与保留班表 | PASS | XCUITest 使用应用启动语言设置分别验证英文和简中。英文创建的班组名称与下一次安排在简中重启时保留。两种语言的新轮班各登记了 9 条 AlarmKit 闹钟。 |
| iOS 双语试响与取消 | PASS | 两种语言安排的 30 秒试响进入系统唤醒队列。取消后，AlarmKit 恢复到下一个排班时间。 |
| 原生名称和小组件资源 | PASS | 最终 iOS 安装中含英文与简中的权限说明和小组件语言资源。Android 安装包的多语言资源显示 `RosterWake` 和 `周而复起`。 |
| 商店素材 | PASS | 两端均采集首页、月历、班次编辑、试响入口的简中和英文原图。交付 16 张经视觉复核的截图。已验证 iPhone 图为 1320 × 2868，Play 手机图为 1080 × 1920，两个宣传图为 1024 × 500，图标为 512 × 512。两种语言的商店字段均在长度限制内。 |
| 小组件实际添加、华为 Android 12、iPhone 和 Apple Watch、iPhone Duo | NOT_RUN | 本轮在两台隔离模拟器验证。Duo 设备配置要求 iOS 27.1 及以上运行时，本轮使用 iOS 26.5。 |

排班核心测试 18 项通过，移动端 TypeScript 检查和 `git diff --check` 通过。隔离模拟器的 XCUITest 结果为 2 项通过。两个原生构建命令均退出 `0`。

原始记录保存在 `.tools/shots/acceptance-20261125-localization/`。`qa/android/` 含系统语言和排程对照，`qa/android-final/` 含最终 APK、休眠、响铃窗口与停止证据。`ios-ui-test/summary.json` 和 `ios-alarmkit-runtime.log` 分别记录 UI 与系统闹钟。交付素材见 [商店首发目录](../docs/store-launch/README.md)。
