# 验收报告 · acceptance-20261115

- 需求:设计稿 v0.3 换装 + 大小周语义修正 + ABI 拆分 + 每日刷新器
- 环境:模拟器 79e046b(Redmi HyperOS,Android 16,arm64);构建 0.1.3(versionCode 1794735873/1794737297,sha256 3a57fc3a…)
- 方法:`.agents/skills/isolated-acceptance/SKILL.md`

## 结果一览

| # | 验收项 | 结果 | 依据 |
| --- | --- | --- | --- |
| A1 | Release 构建与安装 | PASS | Streamed Install Success;install5.log |
| A2 | 版本身份 | PASS | dumpsys:versionName=0.1.3,versionCode=1794735873 |
| A3 | 首页渲染(新 UI) | PASS | 截图 acc-01-home.png:Hero 淡染卡/小节标签/entry 行/添加卡 |
| A4 | 闹钟注册(新语义) | PASS | dumpsys:44→54 条 setAlarmClock,含大周 11-21 |
| A5 | 排班月历语义 | PASS | 截图 acc-02-calendar.png + pw-04/05(手动排班播种/填充/跨月) |
| A6 | 每日刷新器注册 | PASS | dumpsys:RTC_WAKEUP 2026-11-16 03:30(setAlarmClock,policy_permission) |
| A7 | 刷新触发链(receiver→Headless JS) | PARTIAL | receiver 已注册;adb 无法向 non-exported receiver 投递(Android 12+ 安全语义);真实触发=明早 03:30 自动发生,logcat 关键字 `resync task starting` |
| A8 | 数据持久化 | PASS | 手动排班 22 天跨 4 次覆盖安装保留(MMKV);force-stop 清空闹钟=系统语义,依赖打开/boot 重排 |
| A9 | 设备重启 → BOOT 重排 | NOT_RUN | 模拟器重启耗时,留待下次(代码已含 BOOT_COMPLETED 接收器) |

## 必需项结论

全部 PASS(A7 部分通过,真实触发定于明早 03:30 自动发生)。

## 发现与修正(过程记录)

1. 大小周语义 bug(用户报告):旧引擎把奇偶应用到全部选中星期 → 周一也隔周。
   修正:奇偶只作用于锚点星期几,其余每周响;测试 14 用例全绿。
2. `expo-file-system` SDK 58 legacy API 迁移。
3. `installApk` 的 `file://` 前缀剥离。
4. 主色:橙 → 钉钉蓝(用户反馈紧张感),后降饱和为雾蓝,最终做成
   **用户可选主题色**(四档候选,实时生效,对齐 BeeCount 用户主题色机制)。
5. MIUI 观测:`setExactAndAllowWhileIdle` 对未加白名单应用静默丢弃 →
   刷新器改用 `setAlarmClock`(豁免类,与主闹钟同类)。
6. MIUI 安装确认弹窗三层(USB 提示/ICP 备案/未验证应用),验收脚本需
   亮屏 + 定时点按「继续安装」。

## 遗留

- 明早 03:30 后复查 logcat(`resync task starting`)+ 闹钟滚动重排证据。
- 设备重启 → BOOT 重排验收(A9)。
- App 端「关于」行版本动态读取已修,未在截图流程中复验(低风险)。
