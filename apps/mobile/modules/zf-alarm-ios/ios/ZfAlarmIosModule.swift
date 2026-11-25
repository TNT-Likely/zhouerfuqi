import Foundation
import UserNotifications
import ExpoModulesCore
import AlarmKit
import WidgetKit

/// 降级通知(UNUserNotificationCenter)的前台展示 + 点击路由。
/// 点击:JS 已监听 → sendEvent 即时路由;JS 未就绪(冷启动)→ 落 UserDefaults,
/// 由 consumeLastNotificationTap 在 JS 挂载后消费,两条路都不丢。
final class ZfNotificationDelegate: NSObject, UNUserNotificationCenterDelegate {
  static let shared = ZfNotificationDelegate()
  weak var module: ZfAlarmIosModule?
  private static let tapKey = "zf.alarm.tap.v1"

  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    willPresent notification: UNNotification
  ) async -> UNNotificationPresentationOptions {
    // 没有这个实现,设置了 delegate 后前台反而吞横幅——显式保留横幅+声音
    return [.banner, .sound]
  }

  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    didReceive response: UNNotificationResponse
  ) async {
    let content = response.notification.request.content
    let tap: [String: String] = [
      "id": response.notification.request.identifier,
      "timeLabel": (content.userInfo["zfTimeLabel"] as? String) ?? "",
      "title": content.title,
    ]
    // 单一事实源:先落盘,再敲门。JS 在就绪时消费并清除,未就绪由挂载后 consume 兜底,
    // 两条路径都走「consume 才路由」,天然不会重复跳页。
    UserDefaults.standard.set(tap, forKey: Self.tapKey)
    module?.sendEvent("zfNotificationTap", tap)
  }

  /// JS 挂载后取走冷启动期间落下的点击(取走即清,防重复路由)
  static func consumePendingTap() -> [String: String]? {
    let v = UserDefaults.standard.dictionary(forKey: tapKey) as? [String: String]
    if v != nil { UserDefaults.standard.removeObject(forKey: tapKey) }
    return v
  }
}

/// iOS 闹钟网关:
/// 主路径 AlarmKit(iOS 26+,系统级闹钟 UI,与系统时钟同源);
/// 降级路径 UNUserNotificationCenter time-interval 触发器(时间敏感级)。
/// 与 Android 的 zf-alarm(setAlarmClock)语义对齐:上层只认 AlarmGateway 接口。
public class ZfAlarmIosModule: Module {
  private let alarmScheduler = ZfIosAlarmScheduler()

  public func definition() -> ModuleDefinition {
    let scheduler = alarmScheduler
    Name("ZfAlarmIos")
    Events("zfNotificationTap")

    Function("updateWidgetPlan") { (json: String) in
      guard let defaults = UserDefaults(suiteName: "group.com.tntlikely.zhouerfuqi") else { return }
      let language = Bundle.main.preferredLocalizations.first ?? "en"
      guard defaults.string(forKey: "zf.next.alarms.v1") != json ||
            defaults.string(forKey: "zf.next.alarms.language") != language else { return }
      defaults.set(json, forKey: "zf.next.alarms.v1")
      defaults.set(language, forKey: "zf.next.alarms.language")
      WidgetCenter.shared.reloadTimelines(ofKind: "ZhouerfuqiNextAlarm")
    }

    OnCreate {
      ZfNotificationDelegate.shared.module = self
      UNUserNotificationCenter.current().delegate = ZfNotificationDelegate.shared
    }

    /// 冷启动期间落下的降级通知点击({id, timeLabel, title}),取走即清;无则 null
    Function("consumeLastNotificationTap") { () -> [String: String]? in
      ZfNotificationDelegate.consumePendingTap()
    }

    /// AlarmKit 是否在本机可用(iOS 26+)
    Function("isAlarmKitAvailable") { () -> Bool in
      if #available(iOS 26.0, *) { return true }
      return false
    }

    /// 请求权限:通知(降级路径)+ AlarmKit(主路径)。返回 { notifications, exactAlarms }
    AsyncFunction("requestPermissions") { () async throws -> [String: Bool] in
      let center = UNUserNotificationCenter.current()
      var settings = await center.notificationSettings()
      if settings.authorizationStatus == .notDetermined {
        _ = (try? await center.requestAuthorization(options: [.alert, .sound])) ?? false
        settings = await center.notificationSettings()
      }
      let notifications: Bool = [.authorized, .provisional, .ephemeral].contains(settings.authorizationStatus)

      var exactAlarms = false
      if #available(iOS 26.0, *) {
        if let state = try? await AlarmManager.shared.requestAuthorization() {
          exactAlarms = state == .authorized
        }
      }
      return ["notifications": notifications, "exactAlarms": exactAlarms]
    }

    /// 只读状态查询(不弹授权框)
    AsyncFunction("status") { () async throws -> [String: Bool] in
      let settings = await UNUserNotificationCenter.current().notificationSettings()
      let notifications: Bool = [.authorized, .provisional, .ephemeral].contains(settings.authorizationStatus)
      var exactAlarms = false
      if #available(iOS 26.0, *) {
        exactAlarms = AlarmManager.shared.authorizationState == .authorized
      }
      return ["notifications": notifications, "exactAlarms": exactAlarms]
    }

    AsyncFunction("pruneOrphanedAlarms") {
      scheduler.pruneOrphanedAlarms()
    }

    AsyncFunction("scheduleAlarm") { (id: String, epochMs: Double, title: String, body: String) async throws -> String in
      try await scheduler.schedule(id: id, epochMs: epochMs, title: title, body: body)
    }

    AsyncFunction("cancelAlarm") { (id: String) throws -> Bool in
      try scheduler.cancel(id: id)
    }
  }
}
