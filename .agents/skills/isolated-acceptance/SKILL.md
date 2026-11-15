---
name: isolated-acceptance
description: "对 zhouerfuqi 需求做端到端隔离验收:真实入口 + 独立证据 + PASS/FAIL/NOT_RUN/BLOCKED 报告。适用于版本发布前验收、功能闭环确认、数据持久化核验;普通代码修改和仅单元测试无需使用。"
---

# 周而复起 · 隔离功能验收

将需求变成可观察条件,用项目实际入口与独立资源验证,交付可复查证据。
方法源自 beecount 的隔离验收实践(`BeeCount/.docs/qa-generalization/`),按本项目技术栈适配。

## 环境与入口

- 构建链:`.tools/`(JDK17/Gradle home/pnpm shim),`apps/mobile/android/gradlew assembleRelease`
- 真机/模拟器:`adb`(HyperOS 模拟器 79e046b 或用户真机);安装需走 MIUI USB 确认弹窗(亮屏 + 后台安装 + 定时点按「继续安装」)
- 系统级核验:`dumpsys alarm`(精确闹钟注册)/ `dumpsys package`(版本身份)/ logcat(Headless JS)
- 更新闭环:GitHub Releases 的 `update.json` → 应用内「设置 → 检查更新」

## 运行与证明

1. 写出用户动作、实际结果、对象身份(applicationId + versionCode)、数据保持条件与错误路径;区分必需/可选并映射到证据。
2. 运行时核验身份:构建产物 sha、设备上 `dumpsys package` 的 versionName/versionCode,不以文件名或工程配置替代。
3. 每项记录范围、命令、退出码与来源版本;单元测试(fake)结果单独标注。
4. 用实际安装的 APK 完成被测动作(点按/深链);异步步骤等待可观察状态并设超时。
5. 验证 UI → 调度(AlarmManager)→ 持久化(重启/force-stop 后仍生效)闭环。
6. 代码或构建输入变化时,重新构建并重跑受影响证据;失败修正后重跑,不把失败改成未执行。

## 专项核验点(本项目)

- **闹钟注册**:`dumpsys alarm` 中 `com.tntlikely.zhouerfuqi}` 条目数与触发时间序列;
  setAlarmClock 类型(带 `Alarm clock: triggerTime=`)为系统级待遇的标志。
- **大小周语义**:周一~周五每周响;锚点星期六隔 N 周响;小周周六不响(除非补班)。
  日历 UI 上一周工作日(如 11-9~13)必须有点。
- **节假日联动**:合成/真实假日跳过、补班日响起。
- **每日刷新**:03:30 refresher 在 `dumpsys alarm` 中注册(allow-while-idle);
  触发链验证:`am broadcast` 自定义 action → logcat 出现 `[zf] headless resync`。
- **应用内更新**:检查 → 弹窗 → 下载 → FileProvider 安装器 → versionCode 翻转。

## 报告

每项 `PASS / FAIL / NOT_RUN / BLOCKED` + 实际依据;截图存 `.tools/shots/`(不入库),
报告写 `.docs/acceptance-<date>.md`(入库);必需项全部 PASS 才算整体通过;
NOT_RUN/BLOCKED 的必需项不并入通过。构建产物发布走 GitHub Release 白名单(三个 ABI APK + update.json)。
