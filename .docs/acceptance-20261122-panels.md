# 设置、头像与弹窗隔离验收

验收日期为 2026-11-22。候选包来自 `main` 的 `34c3311` 与本次工作区改动。使用独立的 Pixel Android 17（API 37）模拟器和 iPhone 17 Pro iOS 26.5 模拟器。照片和备份均为合成测试数据。

| 验收项 | 结果 | 观测依据 |
| --- | --- | --- |
| 默认头像与自定义照片 | PASS | 两端从首页进入「设置 → 首页头像」，通过系统照片选择器选入样例图，显示圆形裁切预览。保存后退出进程并重新启动，自定义头像仍可见。两端都验证了取消恢复默认会保留自定义图，保存恢复默认会显示破晓头像。iOS 本地偏好中的照片解码为 256 × 256 JPEG。 |
| 自定义响铃时间与删除确认 | PASS | Android 从现有班组进入时间面板，重复的 07:00 保留在面板中并显示校验提示。23:55 增加五分钟到 00:00，减少一分钟到 23:59。保存后首页显示 23:59。删除卡显示班组名和响铃数，取消后班组仍可保存。 |
| 无效备份与覆盖确认 | PASS | Android 通过系统文件选择器选入三种 JSON。无效备份显示失败卡。取消有效备份的覆盖提示后原班组仍可见。确认恢复后重启，恢复用的班组和 08:23 响铃仍可见。最后恢复空备份并重启，班组数仍为 0。 |
| Android 导出备份与检查更新 | PASS | 「生成并分享」打开系统分享面板，文件名为周而复起的 JSON 备份。退出分享后检查更新，获取到「已是最新版本」结果。 |
| 试响预览 | PASS | 两端均通过「设置 → 试响 → 预览响铃」打开界面。应用内预览可延后、关闭，并返回设置。 |
| Android 锁屏试响 | PASS | 安排 30 秒试响后执行「立即重排」，`dumpsys alarm` 仍含原生响铃接收器的闹钟。熄屏后原生 `AlarmActivity` 成为前台，画面显示试响和关闭按钮。关闭后恢复设置页。 |
| 设置、权限、保活向导和关于 | PASS | 两端打开设置与响铃权限面板。Android 从保活向导打开锁屏展示步骤。iOS 切换暗黑与破晓琥珀，进入关于页和技术说明，看到隐私政策入口。 |
| 状态栏与安全区 | PASS | Android 状态栏底边为 142 px，头像、时间和删除弹窗标题起点分别为 1342、652 和 1064 px。两端截图确认弹窗操作区在系统安全区内。 |
| 类型检查与排班规则测试 | PASS | `tsc --noEmit -p apps/mobile` 退出码 0，`npm test` 全部 14 个用例通过，`git diff --check` 退出码 0。 |
| 物理设备试响、iOS 系统锁屏触发及新版安装交接 | NOT_RUN | 本次验收使用模拟器。Android 验证了原生锁屏试响，iOS 验证了应用内响铃预览。 |

## 候选包与证据

- Android 运行 `./gradlew assembleRelease --console=plain -PreactNativeArchitectures=arm64-v8a -PappVersionName=0.2.7 -PappVersionCode=1795300004`，退出码为 0。安装后 `dumpsys package` 确认为 `com.tntlikely.zhouerfuqi`、0.2.7、1795300004。arm64 APK SHA-256 为 `53e19eae0d1b96dee6f50381d4c3e22fc7c7584901dab224feff73209bb4fe09`。
- iOS 运行 `xcodebuild -workspace app.xcworkspace -scheme app -configuration Release -sdk iphonesimulator -destination 'id=ABE0CDEF-6F3D-418D-87B3-17A75CAE7E84' -derivedDataPath build/dd build`，退出码为 0。安装后 `simctl appinfo` 确认为 `com.tntlikely.zhouerfuqi`、0.2.7、1794758803。模拟器包的 `main.jsbundle` SHA-256 为 `07e18dc6db45db5d76bcd8017509f5e695ab3bd3726bfac22a116f98c01d2691`。
- 本地截图、Android 无障碍树和闹钟注册记录位于 `.tools/shots/acceptance-20261122-panels/`。
