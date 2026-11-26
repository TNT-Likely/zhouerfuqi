# 周而复起商店首发素材

英文名称选用 **RosterWake**。Roster 对应轮班表，Wake 对应由班表触发的起床提醒。英文商店标题使用 **RosterWake: Shift Alarm**，方便第一次看到的人理解用途。中文商店面向大小周、调休和轮班用户，英文商店以轮班周期和下次响铃为主。

| 商店语言 | 可粘贴文案 | App Store 截图 | Google Play 素材 |
| --- | --- | --- | --- |
| 简体中文 | [中文文案](zh-CN/listing.md) | [iPhone 截图](zh-CN/app-store/) | [手机截图和宣传图](zh-CN/google-play/) |
| English (U.S.) | [英文文案](en-US/listing.md) | [iPhone screenshots](en-US/app-store/) | [Phone screenshots and feature graphic](en-US/google-play/) |

App Store 的标题横幅用昼夜交替表现轮班，中英文共用。搜索结果图展示对应语言的「下一次响铃」卡片。[标题横幅](app-store-creative/rosterwake-header.png) · [英文搜索图](app-store-creative/rosterwake-search-en-US.png) · [简中搜索图](app-store-creative/rosterwake-search-zh-CN.png) · [设计源文件与导出方法](../../design/app-store-creative/README.md)

隐私政策使用 [仓库中的双语隐私政策](https://github.com/TNT-Likely/zhouerfuqi/blob/main/docs/privacy.md)，支持地址使用 [GitHub Issues](https://github.com/TNT-Likely/zhouerfuqi/issues)。商店发布时填写已公开可访问的对应地址。Google Play 的应用图标使用 [512 像素 PNG](google-play-icon.png)。iOS 图标从 App 自带资源获取。

App Store Connect 的简体中文对应 `zh-Hans`，Google Play 对应 `zh-CN`。两个商店的美国英语均对应 `en-US`。

## 截图顺序

1. 下次响铃。展示首页的注册状态与下一次实际响铃。
2. 月历。展示工作日、休息日和单日排班。
3. 轮班编辑。展示给班次分别设置响铃时间的入口。
4. 试响。展示设置中的锁屏试响入口。

## 审核备注

```text
On first launch, choose a schedule template, review the next alarm, and enable it.
For a quick check, open Settings and use the lock-screen
alarm test. Allow alarms or notifications if prompted, then lock the device and
wait for the short countdown. The app shows the scheduled delivery method in
Settings. Shift schedules are stored locally on the device.
```

- App Store 首发素材按 iPhone 6.9 英寸竖屏槽位准备。从 2027 年 4 月起，使用 iOS 27.1 SDK 或更新版本送审时，需要提供 iPhone Duo 截图。[Apple 截图规格](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)
- Google Play 使用 512 × 512 图标、1024 × 500 宣传图和四张手机截图。权限声明可用设置里的试响演示作证据，按发布构建核对精确闹钟和全屏意图用途。[Play 素材规格](https://support.google.com/googleplay/android-developer/answer/9866151)
