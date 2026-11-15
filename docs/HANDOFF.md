# 周而复起 · 交接文档

> 更新:2026-11-15 · 维护者:TNT-Likely · 仓库:`github.com/TNT-Likely/zhouerfuqi`
> 一句话:开源、本地优先、任意班制的 Android 闹钟(大小周/倒班/手动月历),RN(Expo)+ 原生模块,周一起 iOS。

---

## 1. 项目现状(M1 Android 已闭环)

| 模块 | 状态 |
| --- | --- |
| 规则引擎 `@zhouerfuqi/core`(UTC 日期串运算) | ✅ 14 单测全绿;语义:weekly / everyNWeeks(奇偶仅作用于锚点星期六,周一~五每周)/ everyNDays / customDates;china-smart 节假日(假日跳过、补班响起);customDates 免节假日层 |
| 五屏 UI(设计稿 v0.3) | ✅ 首页(Hero 淡染卡)/ 排班月历编辑器(规则预览/手动排班双模式、月份导航、快捷填充)/ 编辑 / 响铃 / 保活向导;钉钉蓝主色 + 方案 D 暗色(纯黑/#1C1C1E/主题色 30% 边框) |
| 物化响铃 | ✅ 14 天 horizon 物化 one-shot,setAlarmClock(SET_ALARM_CLOCK)系统级;store 变更自动 syncAll |
| 每日刷新器 `modules/zf-alarm` | ✅ 注册成功(明早 03:30 首跑);setAlarmClock 自续期;BOOT/TIME_SET/TIMEZONE_CHANGED → Headless JS 重排 |
| 应用内更新 | ✅ 真机端到端验证过(raw update.json → 下载 → FileProvider 安装 → versionCode 翻转) |
| CI 双流水线 | ✅ ci.yml(测试+typecheck);release-apk.yml(tag v* → 三 ABI APK + update.json,manifest 自动提交 main) |
| ABI 拆分 | ✅ 97MB → arm64 34MB / armv7 26MB / x86_64 34MB |
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
│  ├─ modules/zf-update/     # 应用内更新(FileProvider 安装器)
│  ├─ modules/zf-alarm/      # 每日刷新器 + Headless 服务(Kotlin)
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

## 7. 待办与下一步

1. **明早 03:30**:查 `adb logcat -d | grep ZfAlarm`(`resync task starting`)+
   闹钟滚动重排证据 → 补进验收报告 A7
2. **设备重启验收**(A9):`adb reboot` 后确认 BOOT_COMPLETED → 重排
3. **真机 7 天锁屏过夜**:装 0.1.3 → 保活向导 → 连续观察(真正的产品验收)
4. **应用内更新 0.1.2→0.1.3**:真机上「设置 → 检查更新」(链路已验,这次是真实升级)
5. **R8/minify**(可选):dex 再省 ~5MB,需回归(反射库风险)

## 8. iOS(M2)推进计划

环境已就绪:本机 **Xcode 26.6** + iPhone 17 Pro 模拟器。

1. `expo prebuild -p ios` 生成 ios/(首次)
2. `modules/zf-alarm-ios`(Swift):AlarmKit 授权请求 + one-shot 调度 + 自续期;
   TS 网关复用 `src/scheduler/*`(引擎无平台差)
3. UI 层无需重写(Expo RN 双端);先 iPhone 17 Pro 模拟器验证渲染与降级路径
4. AlarmKit 真机验收需要:**你的 iPhone(iOS 26+)+ 开发者签名**(免费账号 7 天签名可跑)
5. 分发:TestFlight(需付费账号)或本地 ad-hoc

> 建议节奏:先在 Android 上把保活/刷新跑稳一周,再开 iOS(M2 一周内可出可装包)。
