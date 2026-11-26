# RosterWake App Store artwork · 周而复起商店创意素材

The iOS 0.4.0 artwork pairs an ivory bell with a six-part blue dial. The six sections come from the app’s two-early, two-late, two-off rotation. In the header, layers of paper lead from midnight blue into sunrise. In search results, a ringing bell on the left sits beside the app’s actual next alarm.

这套素材为 iOS 0.4.0 商店页面设计。象牙白铃铛周围的六段蓝色表盘取自「两早、两晚、两休」的轮班循环。标题横幅用层叠纸景表现从深夜到破晓，搜索结果图把摇动的铃铛与首页真实的下次响铃并排展示。

| Placement / 位置 | Language / 语言 | PNG (px) | Apple art safe area (x, y, w, h) / 核心安全区 | Export / 成品 |
| --- | --- | --- | --- | --- |
| Product page header / 标题 | No text, shared / 无字，中英共用 | 3840 × 1646 | 1097, 493, 1646, 661 | [Header / 标题横幅](../../docs/store-launch/app-store-creative/rosterwake-header.png) |
| Search results / 搜索结果 | English (US) · `en-US` | 3840 × 2560 | 836, 765, 2168, 1030 | [English search image](../../docs/store-launch/app-store-creative/rosterwake-search-en-US.png) |
| Search results / 搜索结果 | 简体中文 · `zh-CN` (App Store Connect `zh-Hans`) | 3840 × 2560 | 836, 765, 2168, 1030 | [中文搜索结果图](../../docs/store-launch/app-store-creative/rosterwake-search-zh-CN.png) |

All coordinates are pixels from the top left. On iOS and iPadOS 27 or later, these placements can crop differently by device and orientation. Keep the header’s bell and the search image’s bell and card inside their respective safe areas. The search card is 1144 px wide at x = 1828, centered vertically at y = 1280. Exports are opaque sRGB PNGs. [Apple placement specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/creative-assets-specifications) · [Apple artwork and preview guidelines](https://developer.apple.com/app-store/asset-best-practices/)

坐标原点在左上角。iOS 和 iPadOS 27 及以上的商店会随设备和方向裁切画面。调整素材时，让横幅里的铃铛、搜索图里的铃铛和卡片都落在各自的安全区内。搜索卡片左边缘为 1828 px，宽 1144 px，垂直中心为 1280 px。送审文件采用无透明通道的 sRGB PNG。

## Sources · 源素材

- The two illustrations are the original ImageGen PNGs. Edit the layered-paper scenery here. The prompts used for both images are preserved verbatim. 两幅母图保留 ImageGen 原始输出，改动蓝色纸景、光线或表盘时从这里开始。[Header illustration](sources/header-source.png) · [Search illustration](sources/search-source.png) · [Original prompts / 原始提示词](imagegen-briefs.md)
- The localized cards are full crops of the 0.4.0 iOS home screen with sample shifts. On the 1320 × 2868 screen, the crop starts at (42, 405) and measures 1236 × 992 px. Only the background outside the four rounded corners is transparent. 英文卡显示 `7:00 AM`，中文卡显示 `07:00`。两张卡均取自 0.4.0 的 iOS 排班演示截图，保留原生字体、日期和系统登记状态。更新界面时，用相同语言的新截图替换相应卡片。[English card](sources/native-next-alarm-en-US.png) · [中文卡片](sources/native-next-alarm-zh-CN.png) · [Capture notes / 截图来源](../../.docs/acceptance-20261125-localization.md)

## Render · 导出

On macOS with Xcode Command Line Tools, run the following from the repository root. The Swift script reads the artwork beside it, fits the background around the safe area, and writes the three PNGs to `docs/store-launch/app-store-creative/`.

在安装了 Xcode 命令行工具的 macOS 上，从仓库根目录执行下列命令即可重新导出三张成品。脚本从自身所在目录读取素材。图层布局、安全区和卡片位置可在渲染脚本内调整。[Render.swift](Render.swift)

```sh
swift design/app-store-creative/Render.swift
```

To preview edits elsewhere, pass an output directory. Relative output paths are resolved from the working directory. 试导时可以指定独立的输出目录，也可在任意工作目录通过脚本路径执行。

```sh
preview_dir="$(mktemp -d)"
swift design/app-store-creative/Render.swift --output "$preview_dir"
```
