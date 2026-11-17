# 周而复起 (zhouerfuqi)

> 闹钟周而复起,班表从不掉链子。

开源、本地优先的「任意班制」闹钟 App,为**大小周、轮班倒班、自定义月历排班**而生。

## 参与内测

- 🍎 **iOS · TestFlight**:装好 [TestFlight](https://apps.apple.com/app/testflight/id899247664)
  后点公开链接加入 → **https://testflight.apple.com/join/9vNcHgha**(限 10,000 人)
- 🤖 **Android · Google Play 封闭测试**:需要邮箱白名单,去
  [内测招募 issue](https://github.com/TNT-Likely/zhouerfuqi/issues/1) 留邮箱即可
- 📦 **Android · APK 直装**:不装 Play 的直接从
  [GitHub Releases](https://github.com/TNT-Likely/zhouerfuqi/releases) 下载 APK 安装

## 为什么做这个

- 国产手机自带的「智能工作日」只懂法定节假日,不懂**大小周**;
- 每周六手动开关闹钟,忘一次就迟到一次;
- 市面上的排班闹钟闭源、有广告、订阅制,数据出不来;
- 想要一个规则可控、数据本地的开源实现,顺便验证跨端方案。

## 能力规划

**班制规则**(一个闹钟组挂一条规则,可多组并存):

| 规则 | 场景 |
| --- | --- |
| `weekly` 每周星期几 | 普通双休 / 单休 |
| `everyNWeeks` 每 N 周 | 大小周(n=2):「下个大周周六是几号」一个锚点搞定 |
| `everyNDays` 每 N 天 | 上 X 休 Y 的最简形态 |
| `customDates` 自定义月历 | 每月手动点选工作日;点选即权威,不被节假日层取消 |

**节假日叠加**(china-smart 模式,默认开启):

- 规则命中日落在法定假日 → 自动跳过;
- 不在规则内的**调休补班日 → 自动响起**,且独立于周期规则(全国补班日,
  大周小周都算上班日);
- 与大小周正交组合:大周周六撞上放假会跳过,小周周六撞上补班会响起;
- `customDates` 手动点选例外:点选即最高意志,不受以上两层影响。

**闹钟分组**:

- 「上班」组 = 6:40 / 6:50 / 7:00 / 12:55,一键开关整组;
- 组内可挂多个时间,未来支持按组设铃声。

## 架构

```
packages/core     纯 TypeScript 规则引擎(零运行时依赖,本仓库已可用)
apps/mobile       Expo + React Native App(M1 起)
```

- **core**:四种班制规则 × 节假日叠加 → 展开为未来 N 天的具体响铃事件。
  调度引擎只吃「具体日期时间列表」,与平台解耦,可单测、可复用(未来甚至可
  移植到鸿蒙端)。
- **原生层**(规划):
  - Android:`react-native-notify-kit`(Notifee 新架构 fork)以
    `SET_ALARM_CLOCK` 精确闹钟 + 全屏意图实现,配电池白名单引导页;
    目标机型 HarmonyOS 4.x 实测可靠性。
  - iOS 26+:AlarmKit(与系统闹钟同级的响铃体验);iOS < 26 降级为
    时间敏感通知,并在 UI 明确标注。

## 路线图

- [x] **M0** core 规则引擎 + 全量单测(本提交)
- [ ] **M1** Android MVP:分组管理 UI、响铃、开机重排、华为保活引导 → 真机日常使用
- [ ] **M2** iOS:AlarmKit 接入与降级策略
- [ ] **M3** 打磨:渐进音量、贪睡、自定义铃声、响铃日历预览、holiday-cn 数据自动更新、GitHub Actions 出 APK

- [docs/architecture.md](docs/architecture.md) —— 技术架构 v0.1:四条架构原则、物化流水线、Android/iOS 可靠性专项、里程碑映射与风险登记簿。

## 设计

- [design/index.html](design/index.html) —— HTML 设计稿 v0.1:品牌与 Logo、设计令牌、五张核心界面(首页 / 规则编辑 / 响铃日历 / 响铃页 / 华为保活引导)、组件样张,浏览器打开即可查看;
- [design/logo.svg](design/logo.svg) / [design/logo-mono.svg](design/logo-mono.svg) —— 全彩与单色 Logo,可直接用于 GitHub 与 App 图标生成(7 段弧 = 一周循环,橙 = 下一个班日)。

## 本地开发

要求 Node.js ≥ 22.6(原生运行 TS,无需编译步骤)。

```bash
pnpm install            # 可选,仅为 typecheck 拉依赖
pnpm test               # 或零依赖直接跑:
node --experimental-strip-types --test packages/core/test/*.test.ts
```

## 节假日数据

生产环境将内置 [holiday-cn](https://github.com/NateScarlet/holiday-cn)(MIT)的年度
快照 JSON,并提供可选的在线更新。当前测试使用合成数据,不对应真实年份安排。

## License

[MIT](./LICENSE)

## 发布与更新

仓库:[github.com/TNT-Likely/zhouerfuqi](https://github.com/TNT-Likely/zhouerfuqi)

**CI 流水线**:

- `CI`:push/PR 自动跑 core 单测 + 双端 typecheck;
- `Release APK`:推送 `v*` tag(或手动触发)→ 构建签名 release APK +
  `update.json` → 自动发布 GitHub Release。

**发版**:

```bash
git tag v0.1.x -m "..." && git push origin v0.1.x
# CI 产出:zhouerfuqi-<ver>.apk + update.json(应用内更新源)
```

**应用内更新**:`设置 → 检查更新` → 拉取 GitHub Releases 最新
`update.json` → 比对 versionCode → 下载 APK → FileProvider 拉起系统安装器
(需要「允许安装未知应用」授权)。

**签名说明**:`zhouerfuqi.keystore` 随仓库提交(开源自用分发,口令见
`gradle.properties`,不含机密)。若用于正式渠道,请换成私密 keystore 并通过
GitHub Secrets 注入同名 gradle 属性。
