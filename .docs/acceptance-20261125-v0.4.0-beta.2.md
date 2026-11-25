# 周而复起 0.4.0 Beta 2 隔离验收

验收于 2026 年 11 月 25 日进行。发布代码为 `89c6684b8523d4e958036578268492bb02e49934`，标签为 `v0.4.0-beta.2`。验收设备只使用合成排班数据。

| 环境 | 实际安装与产物 |
| --- | --- |
| Android 37.2 隔离模拟器 | `com.tntlikely.zhouerfuqi`，`versionName=0.4.0-beta.2`，`versionCode=1795607193`。本地 arm64 APK SHA-256 为 `bf3e9fdabb6e1f62bba1f8dd799c47d3ff043eda8110519002afa4de34903050`。 |
| iPhone 17 Pro、iOS 26.5 隔离模拟器 | `com.tntlikely.zhouerfuqi`，0.4.0 模拟器 Release 构建，安装包内含 `com.tntlikely.zhouerfuqi.NextAlarmWidget`。 |

| 验收项 | 结果 | 实际依据 |
| --- | --- | --- |
| 首次启用 | PASS | 干净安装先显示班制模板。选择双休、核对首响并开启权限后，Android 有 9 条独立系统登记。iOS 大小周模板确认后显示已登记系统闹钟。 |
| 真正的下一次响铃 | PASS | 安卓在晚间显示明早 07:00 和对应班组。增加轮班后，两个班组同为 07:00 时保留独立登记，共 18 条。 |
| 单次跳过、仅改当天与撤销 | PASS | 两种操作均使系统登记从 9 条降为 8 条，撤销后恢复 9 条。 |
| 轮班、多班组筛选与直接修改 | PASS | Android 使用早早晚晚休休模板，月历区分全部和轮班。首页点响铃时间直接把上班组从 07:00 改到 07:01。Beta 2 再次核对两组记录和月历导航。 |
| 跨月手动排班草稿 | PASS | 添加 11 月 26 日和 12 月 5 日，启用后共有 11 条登记。编辑月历草稿时取消日期并舍弃，系统登记维持 11 条。 |
| Android 覆盖安装 | PASS | Beta 1 覆盖安装后出现全局导航桥尚未就绪的异常，三个分发任务已取消。Beta 2 覆盖安装保留 18 条登记，成功往返首页、设置和月历。 |
| Android 熄屏试响、停止与取消 | PASS | 熄屏时 `dumpsys power` 报告休眠。响铃时间到达后 `AlarmActivity` 取得焦点，界面显示「锁屏试响」和「停止本次」。另一次试响在倒计时取消后，对应的系统 PendingIntent 已移除。 |
| Android 重启补排 | PASS | 模拟器重启后，启动应用前恢复全部 18 条已排定响铃。 |
| iOS 班表导出 | PASS | 通过「导出本月」进入系统分享面板，实际生成 ICS。校验到 23 条按时序排列的事件，UID 唯一。 |
| Android 与 iOS 桌面小组件 | PASS | 两端都从系统目录实际添加。Android 显示「轮班 · 早班 · 起床」和 07:00，点按进入应用。iOS 显示「大小周 · 起床」、07:00 和 11 月 26 日。 |
| 旧备份导入与本地副本 | PASS | Android 通过系统文件选择器导入 schema 1 备份。确认页列出被替换的班组，恢复后剩 9 条登记。使用恢复前的副本可取回两组及原有 18 条登记。 |
| iOS 倒计时与系统登记 | PASS | 授权系统闹钟后，设置显示已登记。试响出现实时倒计时和取消入口。 |
| 华为 Android 12 真机与 Apple Watch | NOT_RUN | 本轮使用隔离模拟器，尚未覆盖厂商锁屏策略和手表联动。 |

核心规则单元测试 18 项通过，包含旧大小周语义、同一时刻的多组事件、轮班日期例外和夏令时钟面时间。核心、移动端 TypeScript 检查及发布工作流语法检查通过。

原始记录在本地 `.tools/shots/acceptance-20261125-v0.4.0-beta.2/`，含覆盖安装前后 APK 标识、系统闹钟、模拟器截图和实际导出的班表。模拟器验收和商店签名构建使用各自的 build number。

## 测试渠道

- GitHub 已发布 Beta 2 预发布，包含三个架构的 APK 和 `update.json`。APK 使用同一源提交的本地签名产物，versionCode 为 `1795607193`。从发布页下载 arm64 APK 后已验签、覆盖安装并打开设置。[APK 下载](https://github.com/TNT-Likely/zhouerfuqi/releases/tag/v0.4.0-beta.2)
- Google Play 的 Alpha 封闭测试已收到 `0.4.0-beta.2`，versionCode 为 `1795607432`。上传、分配轨道和提交均成功。[发布记录](https://github.com/TNT-Likely/zhouerfuqi/actions/runs/45608096011)
- Apple 已处理 TestFlight 构建 `0.4.0 (1795607444)`，状态为 `VALID`。外测审核由用户发起。[处理记录](https://github.com/TNT-Likely/zhouerfuqi/actions/runs/45611770264)
