# iOS 闹钟去重与停止验收

环境为 iPhone 17 Pro 模拟器，iOS 26.5（23F77）。App 通过 `xcodebuild -configuration Release -destination 'generic/platform=iOS Simulator'` 构建，退出码为 0。安装后读取包标识 `com.tntlikely.zhouerfuqi`，版本 `0.3.0 (1794758803)`，可执行文件 SHA-256 为 `5b5a9d4ecdcb74d614db4371833763a404f6683efa645159b80a87ac63531279`。

| 场景 | 结果 | 实测依据 |
| --- | --- | --- |
| 旧数据去重 | PASS | 探针编译生产版 Swift 调度器，用真实 AlarmKit 构造 0.3.0 的 UUID 映射和三条同一时刻的系统闹钟。清理移除了未映射的旧条目，保留了两个有效 UUID。重新注册后，原 UUID 迁移到新记录。 |
| 重排、改时间和改标题 | PASS | 探针连续重排八次，系统返回的 UUID 集合一致。修改时间后，原 UUID 对应新的固定时刻。修改标题后，系统闹钟数量不变，持久化标题更新。 |
| 通知降级切回系统闹钟 | PASS | 探针预置了同一个逻辑 ID 的降级通知和一条独立通知。系统闹钟注册成功后，只移除了对应的降级通知。 |
| App 手动重排和重启 | PASS | 实际 App 从「设置 → 立即重排」运行，显示「响铃已重排」。手动重排和重启后的 40 个未来提醒 ID 与 UUID 映射一致。 |
| 停止单次响铃 | PASS | 实际 App 从「设置 → 试响 → 安排试响」登记一条提醒。系统响铃后点灵动岛关闭按钮，响铃界面消失。重启 App 后已停止的试响记录被清理，40 个未来提醒保留。探针调用系统停止后，AlarmKit 也返回了仅包含未来提醒的列表。 |
| Apple Watch 到 iPhone | NOT_RUN | 此次使用 iPhone 模拟器，手表按钮触发的跨设备停止仍需用配对真机验证。 |

`pnpm test` 的 14 项规则引擎测试、移动端与 core 的 TypeScript 检查、iOS 16.4 deployment target 的 Swift 类型检查均通过。迁移覆盖使用模拟器构造的旧数据，App 路径使用本次构建。

本地证据保存在 `.tools/shots/acceptance-20261124-watch-sync/`，包含实际安装版本、AlarmKit 探针日志、重排比对和响铃前后截图。
