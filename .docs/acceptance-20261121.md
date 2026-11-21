# v0.2.7 顶部安全区验收

运行日期为 2026-11-21。使用 Pixel 10 Android 36 和 iPhone 17 Pro iOS 26.5 模拟器。覆盖安装和闹钟注册使用模拟器上已有的测试班组。

| 验收项 | 结果 | 观测依据 |
| --- | --- | --- |
| Android 顶部安全区 | PASS | 启动应用后经页面入口与深链打开首页、设置、关于、月历、班组编辑、保活向导和应用内响铃页。系统状态栏底边为 142 px，七页标题起点分别为 198、207、207、207、185、191 和 163 px。 |
| iOS 顶部安全区 | PASS | 从首页打开月历、班组编辑、设置和关于。截图中标题与顶部操作都位于灵动岛下方，设置滚动后标题保持在安全区内。关于页显示 v0.2.7。 |
| Android 覆盖安装与重启 | PASS | 覆盖安装后通过 `am force-stop` 退出并重新打开。上班班组和四个响铃时间仍可见。`dumpsys alarm` 显示应用原生接收器已重新注册 24 条系统闹钟。 |
| TypeScript 与规则单测 | PASS | `tsc --noEmit` 退出码为 0，`npm test` 的 14 个用例均通过。 |
| 商店签名包真机安装、锁屏触发和应用内下载 | NOT_RUN | 属于本次顶部安全区修复范围之外的发行验证。 |

## 候选包与证据

- Android 使用 `./gradlew assembleRelease --console=plain -PappVersionName=0.2.7 -PappVersionCode=1795300003` 构建，退出码为 0。通过 `adb install -r` 安装 arm64 APK，`dumpsys package` 确认为 `com.tntlikely.zhouerfuqi`、0.2.7、1795300003。该本地 APK 的 SHA-256 为 `3c1e69385da7f2ec08fec0243f6f9eb7d7024a419dc72cae19568393310cda19`。
- iOS 使用 `xcodebuild -workspace app.xcworkspace -scheme app -configuration Release -sdk iphonesimulator` 构建并经 `simctl install` 安装。构建退出码为 0，`simctl appinfo` 确认为 `com.tntlikely.zhouerfuqi`、0.2.7、1794758803。模拟器包内 `main.jsbundle` 的 SHA-256 为 `a68a9c10c7b653ef5e6b22b4888b443daa942a08dedc87dc0d4a850a9cfd7e71`。
- Android 标题坐标来自 `uiautomator dump` 和 `dumpsys window displays`。本地截图与 Android 测量记录存于 `.tools/shots/acceptance-20261121-v0.2.7/`。
