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

- **发布 = 推 tag**(`git tag vX.Y.Z && git push origin vX.Y.Z`)→ release-apk.yml 自动出
  三 ABI APK + update.json(指向 arm64)并回写 `updates/update.json` 到 main
- **versionCode = `date +%s`**:任何本地构建想覆盖安装到真机,versionCode 必须大于
  真机当前值(dumpsys package 可查);debug 默认 versionCode=1 会被 MIUI 拒(降级)
- **签名**:`zhouerfuqi.keystore`(密码 zhouerfuqi2026/alias zhouerfuqi,公开是有意为之,
  见 README);debug 构建也用该签名 → dev 版可直接覆盖 release 版保留数据

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

## 7. 待办与下一步

1. **明早 03:30**:查 `adb logcat -d | grep ZfAlarm`(`resync task starting`)+
   闹钟滚动重排证据 → 补进验收报告 A7
2. **设备重启验收**(A9):`adb reboot` 后确认 BOOT_COMPLETED → 重排
3. **真机 7 天锁屏过夜**:装 0.1.3 → 保活向导 → 连续观察(真正的产品验收)
4. **应用内更新 0.1.2→0.1.3**:真机上「设置 → 检查更新」(链路已验,这次是真实升级)
5. **R8/minify**(可选):dex 再省 ~5MB,需回归(反射库风险)

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

**剩余(真机阶段)**:

1. 你的 iPhone 装 **TestFlight**(App Store 搜 TestFlight,登录同一 Apple ID)→ 加入周而复起内部测试 → 验收 AlarmKit 响铃 UI/声音(0.2.0 两枚构建已在 TestFlight)
2. 通知降级路径的点击路由:降级通知是原生 UN 直连,未接 notify-kit 事件路由(点按仅打开 app,不跳响铃页)——如需跳转,在 ZfAlarmIosModule 实现 UNUserNotificationCenterDelegate 或改走 notify-kit
3. 设置页「试响」在 iOS 走 AlarmKit(90 秒后系统闹钟 UI);锁屏场景真机确认
4. ASC App Store 页面资料(截图/描述/审核信息)仅上架 App Store 时需要;TestFlight 不需要

> Android 侧仍建议先真机跑稳一周(见 §7 待办)。
