# 周而复起 · 交接文档

> 更新:2026-11-16 · 维护者:TNT-Likely · 仓库:`github.com/TNT-Likely/zhouerfuqi`
> 一句话:开源、本地优先、任意班制的闹钟(大小周/倒班/手动月历),RN(Expo)+ 原生模块;Android M1 闭环,iOS M2 模拟器闭环。

---

## 1. 项目现状(M1 Android 已闭环)

| 模块 | 状态 |
| --- | --- |
| 规则引擎 `@zhouerfuqi/core`(UTC 日期串运算) | ✅ 14 单测全绿;语义:weekly / everyNWeeks(奇偶仅作用于锚点星期六,周一~五每周)/ everyNDays / customDates;china-smart 节假日(假日跳过、补班响起);customDates 免节假日层 |
| 五屏 UI(设计稿 v0.3) | ✅ 首页(Hero 淡染卡)/ 排班月历编辑器(规则预览/手动排班双模式、月份导航、快捷填充)/ 编辑 / 响铃 / 保活向导;钉钉蓝主色 + 方案 D 暗色(纯黑/#1C1C1E/主题色 30% 边框) |
| 物化响铃 | ✅ 14 天 horizon 物化 one-shot,setAlarmClock(SET_ALARM_CLOCK)系统级;store 变更自动 syncAll |
| 每日刷新器 `modules/zf-alarm` | ✅ 注册成功(明早 03:30 首跑);setAlarmClock 自续期;BOOT/TIME_SET/TIMEZONE_CHANGED → Headless JS 重排 |
| 应用内更新 | ✅ 真机端到端验证过(raw update.json → 下载 → FileProvider 安装 → versionCode 翻转) |
| CI 双流水线 | ✅ ci.yml(测试+typecheck);release-apk.yml(tag v* → 三 ABI APK + update.json,manifest 自动提交 main,rebase 重试×5,全败显式红) |
| ABI 拆分 | ✅ 97MB → arm64 34MB / armv7 26MB / x86_64 34MB |
| iOS M2(模拟器) | ✅ expo prebuild ios/ 已提交;`modules/zf-alarm-ios`(Swift):AlarmKit(iOS 26+)主路径 + UNUserNotificationCenter 通知降级;iPhone 17 Pro 模拟器:UI 全渲染 + AlarmKit 授权通过 + 44 枚响铃全落 AlarmKit 零降级 |
| 验收 | ✅ `.docs/acceptance-20261115.md`(9 项 7 PASS/1 PARTIAL/1 NOT_RUN),方法:`.agents/skills/isolated-acceptance/SKILL.md` |

## 2. 仓库结构与关键文件

```
zhouerfuqi/
├─ packages/core/            # 规则引擎(纯 TS,node:test;唯一事实源,App 与设计稿共用语义)
│  ├─ src/{types,dates,holidays,schedule}.ts
│  └─ test/schedule.test.ts  # 大小周标准语义用例在这里
├─ apps/mobile/
│  ├─ app/                   # expo-router 五屏:(tabs)/{index,calendar,settings} + group/[id] + ring + guide
│  ├─ src/
│  │  ├─ theme.tsx           # 设计令牌(三主色 + 方案 D 暗色)
│  │  ├─ scheduler/{materialize,sync}   # 物化 + 系统注册
│  │  ├─ gateway/            # notify-kit 封装(trigger: alarmManager SET_ALARM_CLOCK)
│  │  ├─ services/{holidays,updater}    # holiday-cn(assets/holidays/2026.json)+ 更新
│  │  ├─ stores/groups.ts    # zustand + MMKV(v4 createMMKV)
│  │  ├─ headless.ts         # 'ZfResync' headless 任务(入口 index.js 注册)
│  │  └─ lib/labels.ts       # 展示文案
│  ├─ modules/zf-update/     # 应用内更新(FileProvider 安装器,Android)
│  ├─ modules/zf-alarm/      # 每日刷新器 + Headless 服务(Kotlin,Android)
│  ├─ modules/zf-alarm-ios/  # iOS 网关(Swift):AlarmKit 26+ / UNUserNotificationCenter 降级
│  ├─ ios/                   # 已提交的 prebuild;splits 无;Podfile.lock 一并提交(Pods/build 忽略)
│  ├─ android/               # 已提交的 prebuild;splits.abi 三 ABI;debug 用 release 签名
│  └─ index.js               # 自定义入口:注册 headless 后再挂 expo-router
├─ design/index.html         # 交互设计稿 v0.3(light-dark() + lucide + 内嵌同语义引擎)
├─ docs/                     # 架构文档 architecture.md + 本文件
├─ .agents/skills/isolated-acceptance/SKILL.md   # 验收方法
├─ .github/workflows/        # ci.yml + release-apk.yml
└─ .tools/                   # (gitignored)JDK17/Gradle home/pnpm shim/截图/验收证据
```

## 3. 开发环境(本机已配好)

- **Node**:系统默认 nvm node 20(Metro/tsc OK);跑 core 测试用 DSH 内置 node24
  (`/Users/sunxiao/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/node/bin/node --experimental-strip-types --test packages/core/test/*.test.ts`)
- **pnpm**:必须走 shim(`.tools/bin/pnpm`,内部用内置 node 跑 pnpm.mjs);v11 + `nodeLinker: hoisted`(在 pnpm-workspace.yaml,不在 .npmrc)
- **Java/Gradle**:`JAVA_HOME=.tools/jdk-17.0.21+9/Contents/Home`、`GRADLE_USER_HOME=.tools/gradle`、`ANDROID_HOME=~/Library/Android/sdk`、`HOME=.tools/home`(防 ~/.expo EPERM)
- **Metro(开发)**:`cd apps/mobile && node ../../node_modules/expo/bin/cli start --dev-client --port 8081`
  (不要设 CI=1,否则热重载被禁);真机同 WiFi 或 `adb reverse tcp:8081 tcp:8081`
- **iOS 构建/运行**:`cd apps/mobile/ios && LANG=en_US.UTF-8 pod install`(locale 必带,见坑清单);
  `xcodebuild -workspace app.xcworkspace -scheme app -configuration Debug -sdk iphonesimulator \
  -destination 'id=<sim-UDID>' -derivedDataPath build/dd build`
  (destination 用 UDID,别用 name=——有 CoreSimulator 状态竞态);产物 `build/dd/Build/Products/Debug-iphonesimulator/app.app`
- **iOS 模拟器联调**:`xcrun simctl install booted <app>` 后
  `xcrun simctl launch booted app.zhouerfuqi.mobile --initialUrl "http://localhost:8081"`
  ——dev-launcher 的启动参数,直连 Metro;不要用 `openurl`(会弹系统确认框且无辅助功能权限点不掉)
- **设计稿预览**:`python3 design/serve.py`(no-cache)→ http://127.0.0.1:8375/

## 4. 构建与发布

```bash
# Release(三 ABI)
cd apps/mobile/android
./gradlew assembleRelease -PappVersionName=x.y.z -PappVersionCode=$(date +%s)
# 产物:app/build/outputs/apk/release/app-{arm64-v8a,armeabi-v7a,x86_64}-release.apk

# Debug(真机 dev;已用 release 签名,可直接覆盖安装)
./gradlew assembleDebug -PappVersionName=x.y.z-dev -PappVersionCode=<必须大于已装版本>
```

- **发布 = 推 tag**(`git tag vX.Y.Z && git push origin vX.Y.Z`)→ **三条流水线并行触发**:
  - release-apk.yml:三 ABI APK + update.json(指向 arm64)→ GitHub Release,回写 `updates/update.json` 到 main
  - release-ios.yml:unsigned IPA(GitHub Release)+ TestFlight 签名直传
  - release-play.yml:签名 AAB → **Google Play internal(内部测试)轨道**(SA 上传,secret 未配时只产 AAB artifact)
- **versionCode = `date +%s`**:任何本地构建想覆盖安装到真机,versionCode 必须大于
  真机当前值(dumpsys package 可查);debug 默认 versionCode=1 会被 MIUI 拒(降级)
- **签名**:`zhouerfuqi.keystore`(密码 zhouerfuqi2026/alias zhouerfuqi,公开是有意为之,
  见 README);debug 构建也用该签名 → dev 版可直接覆盖 release 版保留数据

### 4.1 Google Play 流水线(release-play.yml)

- **凭据**:SA `github-actions-upload@beecount-481512.iam.gserviceaccount.com`,
  JSON 放 `~/Documents/googleplay/`(账号级材料库,含新 app 授权 checklist),
  仓库 secret `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`(JSON 原文,非 base64)
- **授权**(2026-11-16 完成):Play Console → 用户和权限 → SA → 应用权限「添加应用」→
  周而复起 → **管理员(所有权限)**;app 记录 ID `4972685046500351852`,
  包名在创建应用时即锁定 `com.tntlikely.zhouerfuqi`(新版表单带可用性检查)
- **轨道**:`alpha`(封闭测试,2026-11-17 由 internal 改入——个人新账号必须完成
  **12 名测试人员参与 × 14 天**的封闭测试才能申请正式上架);上传 = Play Developer API
  edits 流(insert edit → bundle upload → tracks.update → commit),脚本内嵌 workflow
- **⚠️ API 403 的真正根因(2026-11-18 定案)**:SA 的**应用权限没加全**——「用户和权限 →
  SA → 应用权限」里周而复起没在授权列表(曾误诊为「新 App 首发封锁」,实测 6KB gateway
  发布上线后依旧 403,直到在 UI 补上该 App 的应用权限,`edits.insert` 立即 200)。
  教训:新 App 授权后**必须回 UI 逐项核对应用权限列表**,别只看账号权限页有效
- **gateway 解锁策略**:64MB 真包 Console 传输必死时,先造 6KB 占位包(同包名同签名,
  targetSdk ≥36)走 UI 发布解锁通道;正式包随后由 CI 经 API 替换(versionCode 时间戳必更大)
- **封闭测试轨道路径**:测试 → 封闭式测试 → 管理轨道 → 创建新的发布版本;
  track ID `4698989483075961257`(Alpha);传完存草稿后需选测试人员(邮箱名单)再发布
- **商品详情 + 11 项声明全部完成**(2026-11-17,CDP 自动化填写):
  - 商品详情:应用名称/简短说明(30 字)/完整说明(425 字)/图标 512(design/logo.svg 渲染)/
    置顶大图 1024×500(Chrome SVG 渲染产图)/手机截图 ×2(真机 adb 截图,裁状态栏,9:16)
  - 声明:隐私政策(仓库 `docs/privacy.md`)/无广告/无需登录/IARC 分级(全「所有人」)/
    目标受众(13+/非儿童)/数据安全(不收集不分享)/无广告 ID/非政府/无金融/无健康功能/
    交易者身份沿用账号
  - 资产源:`/tmp/zf-assets/`(临时!正式产物已进仓库:icon-1024=app.json icon + iOS appiconset;
    launcher webp 已重产;特图与截图只在 Play 后台,如需再产出 design/ 有源文件)
- **手动触发**:workflow_dispatch,`upload=true` 才上传(默认只验构建 + 产 AAB artifact)
- **⚠️ 上架正式版前的产品级待办**:`REQUEST_INSTALL_PACKAGES` 权限(自更新安装器用)
  在 Play 分发属于敏感权限,自更新 APK 安装与 Play 政策冲突——上架前需
  给 zf-update 加 Play 构建开关(运行时 flag 或 flavor)并从 manifest 移除该权限,见 §7

## 5. 真机调试(MIUI/HyperOS 流程)

1. 亮屏:`adb shell input keyevent KEYCODE_WAKEUP` + `keyevent 82`
2. 后台启动安装,4.5s/6s 各点一次「继续安装」:`adb shell input tap 340 2520`
3. ICP 备案/未验证应用确认:继续(869,2475)→ 仍然安装(340,2518)
4. 验证:`adb shell dumpsys package com.tntlikely.zhouerfuqi | grep version`
5. 系统闹钟:`adb shell dumpsys alarm | grep 'com.tntlikely.zhouerfuqi}'`
6. 日历深链:`adb shell am start -a android.intent.action.VIEW -d "zhouerfuqi://calendar"`

## 6. 已踩坑清单(重要,别再踩)

| 坑 | 结论/修法 |
| --- | --- |
| pnpm 隔离导致 babel-preset-expo 不可解析 | `nodeLinker: hoisted`(pnpm-workspace.yaml) |
| Expo SDK 58 模板未设 ndkVersion,与库默认 27 不一致 | app/build.gradle 显式 `ndkVersion "28.2.13676358"` |
| Groovy `(findProperty()?:'1').toInteger()` 报 Value is null | 用 hasProperty + toString |
| MIUI 拒绝版本降级(`-d` 也没用) | 本地构建必须带更大的 `-PappVersionCode` |
| debug/release 签名不同无法覆盖安装 | debug buildType 挂 release 签名 |
| **MIUI 静默丢弃非白名单应用的 `setExactAndAllowWhileIdle`** | 用 `setAlarmClock`(豁免类);这是保活向导存在的根因 |
| force-stop 会清空该应用全部系统闹钟 | 系统语义;恢复依赖打开 app/boot 重排,不是 bug |
| Android 12+ 无法向 non-exported receiver adb 广播 | 触发链验证用系统 alarm 真实触发(03:30)或临时导出 |
| expo-file-system SDK 58 | 用 `expo-file-system/legacy`,字段名 totalBytesWritten/totalBytesExpectedToWrite |
| notify-kit trigger 形态 | `alarmManager: { type: AlarmType.SET_ALARM_CLOCK }`(非 notifee 旧形) |
| RN 空占位格无宽度 → 月历整月左移 | 空白格复用 `styles.day`(同宽);已修 |
| 大小周语义 | 奇偶只作用于锚点星期几;周一~五每周响(core 已改,设计稿已同步) |
| Metro 端口被占/CI 模式 | 旧进程 kill 后重启;绝不带 CI=1 起 dev Metro |
| 本机 brew CocoaPods 报 Unicode Normalization ASCII-8BIT | shell 必须带 `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` 再 `pod install` |
| xcodebuild `name:iPhone 17 Pro` 解析失败(设备明明 booted) | CoreSimulator 状态竞态;destination 改用 `-destination 'id=<UDID>'` |
| Xcode 26 产物代码在 `app.debug.dylib` 不在 `app` 主二进制 | 查符号/链接用 `otool -L app.debug.dylib`;AlarmKit weak 链接验证同样看 dylib |
| iOS 上 import Android-only expo 模块即崩 | `requireNativeModule` 必须懒加载 + Platform 守卫(zf-alarm/zf-update/zf-alarm-ios 三处 TS 侧均已处理) |
| dev-launcher 卡「Searching for development servers…」 | 用 `simctl launch booted <bundle> --initialUrl "http://localhost:8081"` 直连;`openurl` 会弹确认框,osascript 无权限点不掉 |
| `UNAuthorizationOptions` 没有 `.timeSensitive` | 时间敏感是 `UNNotificationInterruptionLevel`,不是授权选项 |
| AlarmKit iOS 26.1 起 `stopButton` 已废弃 | 26.1+ 用 `AlarmPresentation.Alert(title:)`(系统自带停止按钮);26.0 走 deprecated 构造 |
| release-apk.yml 的 workflow 取自 tag 所在 commit | 打 tag 前确保修复已在 main;旧 tag 上的 workflow 不会用 main 的新逻辑 |
| pnpm shim 的 `exec` 子命令没走内置 node | 直接 `node ../../node_modules/typescript/bin/tsc --noEmit` 等价替代 |
| pnpm 11 要 node:sqlite(Node 22.13+) | PATH 漂到 nvm node 20 时 shim 直接崩(`ERR_UNKNOWN_BUILTIN_MODULE`);用 DSH node24 显式跑:`~/.dsh/.../node/bin/node ~/.dsh/.../pnpm.mjs add pkg@ver`(add 必须带 `name@ver`,裸版本号会被当包名) |
| iOS 增量构建可能跳过 RN 打包阶段 | main.jsbundle 时间戳不更新、改动"看起来没生效";`rm -rf build/dd/Build/Products/Release-iphonesimulator/app.app build/dd/Build/Intermediates.noindex` 强制重打 |
| 模拟器点击忽然失效 | 别的窗口盖到了最前——`osascript activate Simulator` 后再 cliclick;AX 内容区坐标(1694,342,440×956)需重读确认 |
| HyperOS 拦 adb 合成手势解锁 | 锁屏滑动用 input swipe 无效(安全策略);首次解锁只能靠人,BOOT 重排验收等解锁后取数 |
| 自动化 Chrome 登 Google 被拒「此浏览器或应用可能不安全」 | chrome-devtools-mcp 的 Chrome 带 `--enable-automation` 风控必拦;起独立 profile 的普通 headed Chrome(`--user-data-dir=~/.cache/zf-play-chrome-profile --remote-debugging-port=9223`,无自动化标记),人工登录一次后 CDP 全程接管 |
| Node undici WebSocket 连 Chrome CDP 握手即挂(1006/TypeError) | 用 `ws` 包(repo hoisted node_modules 里现成)+ node20;HTTP 面(/json/list、/json/new、/json/close)fetch 就够 |
| Play Console 新版「创建应用」直接填包名 | 带「检查可用性」,创建即锁定;不再靠首个 AAB 定包名 |
| Play Console Angular UI 自动化 | DOM 选择器常绕不进 overlay;`Input.dispatchMouseEvent` 按**截图 CSS 像素坐标**点击最稳(截图=视口坐标,无需除 DPR) |
| Play 上传 SA 是按 app 授权,非账号级 | 新 app 必须手动「用户和权限 → SA → 添加应用」;材料库 googleplay/README 有完整 checklist |
| **expo 没配 icon 字段的连锁坑** | iOS appiconset 是全白图、Android launcher 是 Expo 机器人——prebuild 兜底不报错;修法:`app.json` 加 `icon` + 手动替换 appiconset 1024 PNG + 重产 mipmap webp(cwebp),已做 |
| **shell 环境变量带分号的坑** | `VAR=x; cmd` 不会把 VAR 传给 cmd(是 shell 本地变量);必须 `VAR=x cmd` 同行或 export——CDP_PORT=9224 那次差点全部打到 9223 |
| SVG→PNG 无 rsvg/magick 时的产图法 | 专用 Chrome 打开自包含 HTML(内联 SVG)→ `Emulation.setDeviceMetricsOverride` + `Page.captureScreenshot{clip}` 像素级截取;轮询 `document.title===RENDER_READY_m` 防止截在注入前 |
| Play Console 资源库上传 | 每个字段「添加资源」开右侧面板;文件塞 `input[type=file]` 后**必须手动 dispatchEvent change**(CDP setFileInputFiles 不触发 Angular);资源入库后点缩略图选中 → 底部「添加」;截图上传在手机字段面板里会**自动挂到字段** |
| IARC/目标受众向导自动化 | radiogroup 枚举 → 无 checked 的组点 `input[1]`(注意选项顺序不定,先枚举 label 再点);下一步按钮 disabled 可能是旧引用,scrollTo 后重取 |
| **`google.play` 直连坑(大坑)** | 未登录访问 play.google.com/console 会重定向到 `google.play/business` 营销页;`google.play` 不在路由器 mihomo 的 geosite-google 规则里,落 Final→Direct 被墙 → Chrome 报 ERR_CONNECTION_CLOSED,表象极像「节点坏了/ECH/PQ 握手」,实则换任何节点都挂。排障:`curl 192.168.3.202:9090/logs?level=debug` 看 mihomo 实时日志(9090 无鉴权,PUT /proxies/<组> 可切节点)。规避:登录后再进 console |
| Play Console SPA 陈旧视图 | URL 换了 app ID 但视图残留上一个 app(BeeDNS 页面配周而复起的 URL)——**document.title 才是真上下文**;先进 app-dashboard 等标题正确再深链,别信 innerText |
| Chrome 大文件上传卡 0 B | Play Console 传 64MB AAB 可能卡 `0 B of 63.9 MB`(死 socket);取消后**立刻重传大概率就动**(新 socket)。监控进度用 `\s*` 匹配——数字与单位间是不换行空格 U+202F,普通空格正则永远不中 |
| **gateway 解锁策略(核心)** | 新 App API 403 封锁的绕行:先造 **6KB 占位包**(同包名同签名,versionCode 1,targetSdk **必须 ≥36**——35 会被新规拦)传 Console → 发布解锁 API → CI 传真包替换。占位包上传**秒级**(64MB 真包传输层在家宽环境基本必死)。占位构建工程可复用:`/tmp/zf-gateway`(会丢,重建 10 分钟) |
| 「卡 0 B」其实是传完了 | 报错「已有版本使用了版本代码 N」= **服务器已收到**(UI 进度条从不刷新);查证方式:刷新 prepare 页 → 从内容库添加 → 看库里版本号。**查库时刷新页面会掐死在传的上传**——先确认无 UI 上传行再刷新 |
| 商品详情是两步流程 | 资源 → 评价(AI 资源声明)。最后一步不点完(选「不为资源添加标签」),信息中心「设置商品详情」任务永远不打勾 |
| 敏感权限声明两表单 | 全屏 intent + 精确闹钟(2025+ 闹钟类必填):核心功能选「闹钟」,全屏 intent 的「安装时预授权」选「是」;表单入口在**发布审核页的错误条目**里(「前往声明表单」),不在应用内容页 |
| 送审流程(2026 新版) | 发布审核页保存后 → 弹「要前往发布概览吗」→ 转到概览 → **「提交 N 项更改以供审核」**(蓝按钮)→ 确认 → 「正在审核中的更改」。审核通过上线后 API 才解锁(提交即解锁 ❌,探针验证过) |
| 本地 Gradle 构建 RN 断网方案 | Maven Central 大文件传输必死:①手动下载 aar(sha1 校验)注入 `~/.gradle/caches/modules-2/files-2.1/<group>/<module>/<ver>/<sha1>/` ②init script(`--init-script`)全仓库挂 **maven.aliyun.com/repository/{central,google}**(google 仓库里才有 aapt2)③本地 maven 仓库喂 react-android(三件套 aar+pom+module)。react-android 0.88.1 = **171MB**(阿里云直连 12 秒) |
| Chrome 会话持久化 | pkill TERM 后 cookie 大概率丢;登录后立刻 `sqlite3 Default/Network/Cookies ".backup …/Cookies.bak"` 快照到材料库 `~/Documents/googleplay/chrome-session-backup/`(同机钥匙串密钥可解密,恢复=关 Chrome→cp 回→启动);守卫等待期间每 2h 轮询会话快照是否过期 |

## 7. 待办与下一步

1. ~~明早 03:30 刷新器首跑~~ ✅ **已收**(2026-11-16 03:30:00.020 真机 logcat
   `*walarm*:expo.modules.zfalarm.REFRESHER` 触发;次日 03:30 自续期 + horizon 响铃滚动重排在位;
   A7 → PASS,见 `.docs/acceptance-20261115.md`)
2. **设备重启验收**(A9):`adb reboot` 已执行(2026-11-16,手机休眠中电量 100%);
   HyperOS 拦 adb 合成滑动解锁(锁屏停在圆环页)→ BOOT 广播等**首次解锁**才放行,
   解锁后查 `adb shell "dumpsys alarm | grep -c 'com.tntlikely.zhouerfuqi}'"`(应 44+)+ logcat resync 即收尾
3. **真机 7 天锁屏过夜**:装 0.1.3 → 保活向导 → 连续观察(真正的产品验收)
4. **应用内更新 0.1.2→0.1.3**:真机上「设置 → 检查更新」(链路已验,这次是真实升级)
5. **R8/minify**(可选):dex 再省 ~5MB,需回归(反射库风险)
6. **Google Play 收尾**:
   - ~~`REQUEST_INSTALL_PACKAGES` Play 合规~~ ✅(2026-11-18)release-play.yml 已加
     「Strip REQUEST_INSTALL_PACKAGES」步骤(Play 构建剥权限,APK 渠道保留);
     本地出合规包的方法:`sed -i '/REQUEST_INSTALL_PACKAGES/d' app/src/main/AndroidManifest.xml` 后构建
   - ~~商品详情 + 11 项声明~~ ✅(2026-11-17,见 §4.1)
   - **封闭测试启动**:2026-11-18 已提交 Google 审核(gateway 0.0.1 + 全部商店设置共 16 项更改,
     发布概览页可见「正在审核中的更改」)→ 审核通过即上线,14 天倒计时开始;
     审核通过后 API 解锁(探针 workflow `play-api-probe.yml` 验证)→ CI 传 0.2.0 正式包
7. **Google Play CI 链路**:
   release-play.yml 构建 24min 绿 ✅、SA 授权 ✅、alpha 轨道 ✅、合规剥离 ✅;
   **API 解锁前最后一步 = gateway 审核通过**(0.0.1 占位包已送审 ⏳);
   凭据沉淀 `~/Documents/googleplay/`(含 chrome-session-backup 会话快照)

## 8. iOS(M2)进展

**已完成(2026-11-15,模拟器闭环)**:

1. ✅ `expo prebuild -p ios` 生成 ios/ 并**已提交**(与 android 同策略;.gitignore 已放开)
2. ✅ `modules/zf-alarm-ios`(Swift/Expo Modules):
   - 主路径 AlarmKit(iOS 26+):授权(`requestAuthorization`)、`schedule(id:configuration:)` 一次性 `.fixed(Date)` 响铃、UUID 映射存 UserDefaults、取消双后端兜底
   - 降级路径 UNUserNotificationCenter time-interval 触发器(interruptionLevel = timeSensitive;iOS 只保留最近 64 条 pending,自动裁最远,恰好是想要的语义)
   - AlarmKit 弱链接(podspec `weak_frameworks`),iOS 16.4+ 可装,旧系统运行时自动降级
   - API 签名全部对照 Xcode 26.6 SDK swiftinterface 核实(不是凭记忆)
3. ✅ TS 网关 `src/gateway/alarmKit.ts` + 平台装配;引擎/物化/registry 层零改动复用
4. ✅ 模拟器验证(iPhone 17 Pro / iOS 26.5):五屏渲染 ✓、`zhouerfuqi://calendar` 深链 ✓、
   AlarmKit 授权通过 ✓、**44 枚物化响铃全部落 AlarmKit(零降级)** ✓、大周/小周锚点渲染 ✓
5. ✅ iOS 无 MIUI 式 7 天钳制 → 不需要每日刷新器;`scheduleRefresher` 在 iOS 为 no-op

**App Store Connect / 签名体系(2026-11-16 配齐)**:

| 项 | 值 |
| --- | --- |
| Team ID | `JS3KDL8437`(xiao sun);Issuer ID `24f6ad22-b646-4b07-b054-b5acd6f48879` |
| Bundle ID | `com.tntlikely.zhouerfuqi`(Identifier 已注册;**App 记录已建**,ASC App ID 6835119700,SKU zhouerfuqi,主语言简体中文) |
| 分发证书 | 复用账号级 `~/Documents/apple/apple_distribution.p12`(serial 29E5BDCC…,到期 **2027-10-30**);曾误建过一张重复证书已撤销 |
| API Key | 专用 `zhouerfuqi-ci`(Key ID `3W6NQ7Y8QJ`,App 管理权限,不与 BeeCount 共用的 564N382695 混用);.p8 存 `~/Documents/apple` 惯例之外另存本仓 `.tools/asc/`(gitignored) |
| 描述文件 | `zhouerfuqi-appstore`(profileId M5RWDRDU58,UUID 75e59c34-…,到期随证书 2027-10-30) |
| GitHub Secrets | `APPLE_API_ISSUER_ID` / `APPLE_API_KEY_ID` / `APPLE_API_KEY_CONTENT` / `APPLE_CERTIFICATE_P12`(base64)/ `APPLE_CERTIFICATE_PASSWORD` / `APPLE_PROVISIONING_PROFILE`——命名对齐 `~/Documents/apple/README.md` 惯例 |

**CI(`release-ios.yml`,与 release-apk 同源 tag v* 触发)——已于 v0.2.0 全绿验证**:

- `unsigned-ipa` job ✅:macos-26 runner,Release 归档(CODE_SIGNING_ALLOWED=NO)→ Payload 打包 → tag 时挂 GitHub Release / 手动跑出 artifact
- `testflight` job ✅(仅 tag):临时钥匙串导入 `APPLE_CERTIFICATE_P12`(**必须 set-keychain-settings 禁 5 分钟自动锁,否则归档中途 errSecInternalComponent**)→ Manual 签名归档 → printf 生成 export.plist → `xcodebuild -exportArchive` 出 ipa → `altool --upload-app` + API key 直传 TestFlight
- v0.2.0 实测:ASC 两枚构建全 VALID(CI 1794765885 + 本地验证 1794758803)
- **外测公开链接(2026-11-18 Apple Beta 审核 APPROVED,已生效)**:
  https://testflight.apple.com/join/9vNcHgha(外测组「公开内测 Public Beta」,限 1 万人)。
  注意送审前置坑:Beta App 描述(betaAppLocalizations,双语)+ 反馈邮箱 + 审核联系人
  (含电话)必须齐,加密合规值已设时 PATCH 会 409 忽略即可;全部操作可走
  `asc-beta-link.yml` 工作流(本地连不上 ASC API 时用它)
- **⚠️ ASC API 域名已迁移**:api.appstoreconnect.com 全局 NXDOMAIN(CI 也解析不了),
  现用 **api.appstoreconnect.apple.com**
- **版本号**:Expo 把 CFBundleShortVersionString/CFBundleVersion 写死在 Info.plist,CLI build settings 压不过 → CI 归档前 `plutil -replace` 直改(build 号 = 时间戳,与 Android versionCode 同策略)

**iOS 发布链路调试坑(每条都真踩过)**:

| 坑 | 结论 |
| --- | --- |
| GitHub secret 只收 UTF-8 | 二进制 .mobileprovision 直接 `gh secret set < file` 会让 workflow **startup_failure**(1 秒红);必须 base64 存、CI 解码 |
| YAML 块内 heredoc | `run: \|` 里 `<<'EOF'` 的结束标记带缩进 bash 不认 → 后续命令全被吞进文档内容,**步骤假绿无产物**;用 `printf '%s\n'` 逐行生成替代 |
| runner 的 plutil | macOS runner plutil 不支持 `-insert key -dict -key …` 嵌套;嵌套 dict 直接写进 printf 的 XML 行 |
| find-identity 提取身份名 | `/valid/` 会匹配到摘要行;用 `sed -n 's/.*"\(.*\)".*/\1/p'` |
| Xcode 26 exportArchive | 不再支持 `-authenticationKey*` 参数(本地验证过才发的 CI);上传走 altool 两步法 |
| method 名 | `app-store` 已弃用 → `app-store-connect` |
| Chrome 136+ | 默认 user-data-dir 上 `--remote-debugging-port` 被静默忽略(端口不起);CDP 要么复制 profile 要么新 profile |
| ASC API 问卷/截图上传 | 年龄问卷 PATCH `/v1/ageRatingDeclarations/{id}`(挂在 appInfos 子路径上报 method 错);字段混型:多数枚举 NONE,但 `messagingAndChat/socialMedia/gambling/lootBox/advertising` 等是 **boolean**,`kidsAgeBand` 只接受 FIVE_AND_UNDER+ 不传即 NONE;首版 `whatsNew` 不可编辑(409) |
| ASC 截图 API | displayType 无 6.9 档,`APP_IPHONE_67` 收纳 1320×2868;uploadOperations 的 requestHeaders 是 `[{name,value}]` 列表;commit 只 PATCH `uploaded:true`(sourceFileHash 不是该资源属性);审核详情 `appStoreReviewDetails` 挂 **appStoreVersion** 关系,不是 app |
| ASC 定价/销售范围 | API 完全不开放(`/v1/appAvailabilities`、`/v1/appPrices` 都 404),只能网页端点 |
| 模拟器截图自动化 | 辅助功能权限可用时:`osascript` 读 Simulator AX 树拿到内容区(pos/size 即设备点尺寸),`cliclick`(brew)按 PNG 坐标÷3 换算点击;iOS 系统弹窗对 Return 键无响应,必须真点击;`simctl openurl` 自定义 scheme 每次弹确认框且会排队叠加 |

**剩余(真机阶段)**:

1. 你的 iPhone 装 **TestFlight**(App Store 搜 TestFlight,登录同一 Apple ID)→ 加入周而复起内部测试 → 验收 AlarmKit 响铃 UI/声音(0.2.0 两枚构建已在 TestFlight)
2. ~~通知降级路径的点击路由~~ ✅ **已完成并模拟器端到端验证**(2026-11-16):ZfAlarmIosModule 实现 UNUserNotificationCenterDelegate(前台 willPresent 保留横幅+声音;点击落 UserDefaults 单一事实源 + sendEvent 敲门,JS 两条路径都「consume 才路由」不重复跳页);simctl push 横幅点击 → 响铃页实测通过
3. 设置页「试响」在 iOS 走 AlarmKit(90 秒后系统闹钟 UI);锁屏场景真机确认
4. **App Store 上架资料(2026-11-16 已备齐至「随时可提交」)**:商店文案(描述 390 字/关键词/推广文本/support URL=仓库)✅、版本号 0.2.0+版权 ✅、CI build 1794765885 已挂到商店版本 ✅、年龄问卷全 NONE(4+)✅、审核备注(闹钟测试说明)✅、6.9" 截图×3(首页/月历/设置,模拟器 Release 构建 + cliclick 点击授权弹窗后截图,API 上传)✅。**剩余只有你能做的**:① ASC 网页「定价与销售范围」选免费+销售范围(API 不开放此段;若上中国大陆需 ICP 备案号,175 地区列表里没有 CN,大陆是单独开关);② 审核联系人(姓名/电话/邮箱,`appStoreReviewDetails` 已建只差联系人);③ 点「提交以供审核」
5. 模拟器上发现:设置页「权限状态」显示 `通知 ✗ · 精确闹钟 需检查`(模拟器上权限弹窗点过一轮后 UN/AlarmKit 都停在拒绝态,simctl push 能弹 banner 但不算数)——真机 TestFlight 首启会重新弹授权,验收时顺带核对该行是否与系统一致

> Android 侧仍建议先真机跑稳一周(见 §7 待办)。
