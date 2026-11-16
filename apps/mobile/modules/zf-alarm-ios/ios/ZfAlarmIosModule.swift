import Foundation
import UserNotifications
import SwiftUI
import os
import ExpoModulesCore
import AlarmKit

private let logger = Logger(subsystem: "com.tntlikely.zhouerfuqi", category: "ZfAlarmIos")

/// AlarmKit 要求的元数据载体(AlarmMetadata = Codable + Hashable + Sendable)。
/// 物化注册表的字符串 id 借它透传,系统告警 UI 侧可还原关联关系。
@available(iOS 26.0, *)
struct ZfAlarmMetadata: AlarmMetadata {
  let alarmKey: String
}

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
  /// AlarmKit 只认 UUID;这里持久化 物化 id → AlarmKit UUID 的映射以便取消。
  private static let mapKey = "zf.alarm.idmap.v1"

  private var idMap: [String: String] {
    get { (UserDefaults.standard.dictionary(forKey: Self.mapKey) as? [String: String]) ?? [:] }
    set { UserDefaults.standard.set(newValue, forKey: Self.mapKey) }
  }

  public func definition() -> ModuleDefinition {
    Name("ZfAlarmIos")
    Events("zfNotificationTap")

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

    /// 注册一枚一次性响铃。返回实际落到的后端:"alarmkit" | "notification" | "skipped"(已过期)。
    AsyncFunction("scheduleAlarm") { [weak self] (id: String, epochMs: Double, title: String, body: String) async throws -> String in
      guard let self else {
        throw NSError(domain: "ZfAlarmIos", code: 0, userInfo: [NSLocalizedDescriptionKey: "module released"])
      }
      let fireDate = Date(timeIntervalSince1970: epochMs / 1000.0)
      guard fireDate.timeIntervalSinceNow > 0.5 else { return "skipped" }

      if #available(iOS 26.0, *) {
        do {
          return try await self.scheduleWithAlarmKit(id: id, date: fireDate, title: title)
        } catch {
          // 授权被拒 / 达到系统上限 / 其他:静默落通知降级
          logger.warning("AlarmKit schedule failed, fallback to notification: \(error.localizedDescription, privacy: .public)")
        }
      }
      try await self.scheduleWithNotifications(id: id, date: fireDate, title: title, body: body)
      return "notification"
    }

    /// 取消一枚响铃:双后端都尝试(命中任一即视为成功)。
    AsyncFunction("cancelAlarm") { [weak self] (id: String) -> Bool in
      guard let self else { return false }
      var ok = false
      if #available(iOS 26.0, *) {
        if let uuidStr = self.idMap[id], let uuid = UUID(uuidString: uuidStr) {
          try? AlarmManager.shared.cancel(id: uuid)
          self.idMap[id] = nil
          ok = true
        }
      }
      UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [id])
      return ok
    }
  }

  /// 主路径:AlarmKit 固定时刻闹钟。
  @available(iOS 26.0, *)
  private func scheduleWithAlarmKit(id: String, date: Date, title: String) async throws -> String {
    let manager = AlarmManager.shared
    guard manager.authorizationState == .authorized else {
      throw NSError(domain: "ZfAlarmIos", code: 1, userInfo: [NSLocalizedDescriptionKey: "AlarmKit not authorized"])
    }

    // 主题色:雾蓝(亮色 #4A7DB5),与设计稿 v0.3 主色一致
    let tint = Color(red: 74 / 255, green: 123 / 255, blue: 181 / 255)

    // 26.1 起系统自带停止按钮(stopButton 已废弃);26.0 仍需显式声明
    let alert: AlarmPresentation.Alert
    if #available(iOS 26.1, *) {
      alert = AlarmPresentation.Alert(title: LocalizedStringResource(stringLiteral: title))
    } else {
      let stop = AlarmButton(text: "停止", textColor: .white, systemImageName: "stop.circle.fill")
      alert = AlarmPresentation.Alert(title: LocalizedStringResource(stringLiteral: title), stopButton: stop)
    }

    let attributes = AlarmAttributes(
      presentation: AlarmPresentation(alert: alert),
      metadata: ZfAlarmMetadata(alarmKey: id),
      tintColor: tint
    )
    let config: AlarmManager.AlarmConfiguration<ZfAlarmMetadata> =
      .alarm(schedule: .fixed(date), attributes: attributes)

    let alarm = try await manager.schedule(id: UUID(), configuration: config)
    var map = idMap
    map[id] = alarm.id.uuidString
    idMap = map
    return "alarmkit"
  }

  /// 降级路径:时间敏感级本地通知。
  /// iOS 系统只保留最近触发的 64 条 pending,超限时自动裁最远的——恰好是想要的降级语义。
  private func scheduleWithNotifications(id: String, date: Date, title: String, body: String) async throws {
    let content = UNMutableNotificationContent()
    content.title = title
    content.body = body
    content.sound = .default
    content.interruptionLevel = .timeSensitive
    // 点击路由用:响铃页直接显示计划时刻(HH:mm)
    let fmt = DateFormatter()
    fmt.dateFormat = "HH:mm"
    content.userInfo["zfTimeLabel"] = fmt.string(from: date)

    let trigger = UNTimeIntervalNotificationTrigger(timeInterval: date.timeIntervalSinceNow, repeats: false)
    try await UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: id, content: content, trigger: trigger))
  }
}
