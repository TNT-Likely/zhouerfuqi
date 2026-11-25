import AlarmKit
import Foundation
import os
import SwiftUI
import UserNotifications

private let logger = Logger(subsystem: "com.tntlikely.zhouerfuqi", category: "ZfAlarmIos")

@available(iOS 26.0, *)
private struct ZfAlarmMetadata: AlarmMetadata {
  let alarmKey: String
}

/// JS 的调度队列串行调用注册、清理和取消。
final class ZfIosAlarmScheduler {
  private struct Registration {
    let uuid: UUID
    let title: String?
  }

  private static let registrationsKey = "zf.alarm.registrations.v2"
  private static let legacyIdMapKey = "zf.alarm.idmap.v1"
  private let notifications = UNUserNotificationCenter.current()
  private let defaults = UserDefaults.standard

  private var registrations: [String: Registration] {
    get {
      if let saved = defaults.dictionary(forKey: Self.registrationsKey) as? [String: [String: String]] {
        return saved.compactMapValues { entry in
          guard let uuid = entry["uuid"].flatMap(UUID.init(uuidString:)) else { return nil }
          return Registration(uuid: uuid, title: entry["title"])
        }
      }
      let legacy = defaults.dictionary(forKey: Self.legacyIdMapKey) as? [String: String] ?? [:]
      return legacy.compactMapValues { UUID(uuidString: $0).map { Registration(uuid: $0, title: nil) } }
    }
    set {
      defaults.set(newValue.mapValues { registration in
        var entry = ["uuid": registration.uuid.uuidString]
        entry["title"] = registration.title
        return entry
      }, forKey: Self.registrationsKey)
    }
  }

  /// AlarmKit 只返回本 App 的闹钟。旧版重新分配 UUID 时留下了没有映射的条目。
  func pruneOrphanedAlarms() {
    guard #available(iOS 26.0, *) else { return }
    let manager = AlarmManager.shared
    guard manager.authorizationState == .authorized else { return }

    do {
      let tracked = Set(registrations.values.map(\.uuid))
      for alarm in try manager.alarms where !tracked.contains(alarm.id) {
        try cancelIfPresent(alarm.id, in: manager)
      }
    } catch {
      logger.warning("AlarmKit orphan cleanup failed: \(error.localizedDescription, privacy: .public)")
    }
  }

  func schedule(id: String, epochMs: Double, title: String, body: String) async throws -> String {
    let date = Date(timeIntervalSince1970: epochMs / 1000)
    guard date.timeIntervalSinceNow > 0.5 else { return "skipped" }

    if #available(iOS 26.0, *), try await scheduleWithAlarmKit(id: id, date: date, title: title) {
      removeNotifications(for: id)
      return "alarmkit"
    }

    let interval = date.timeIntervalSinceNow
    guard interval > 0 else { return "skipped" }
    let settings = await notifications.notificationSettings()
    guard [.authorized, .provisional, .ephemeral].contains(settings.authorizationStatus) else { return "skipped" }
    let content = UNMutableNotificationContent()
    content.title = title
    content.body = body
    content.sound = .default
    content.interruptionLevel = .timeSensitive
    let formatter = DateFormatter()
    formatter.dateFormat = "HH:mm"
    content.userInfo["zfTimeLabel"] = formatter.string(from: date)

    let trigger = UNTimeIntervalNotificationTrigger(timeInterval: interval, repeats: false)
    try await notifications.add(UNNotificationRequest(identifier: id, content: content, trigger: trigger))
    return "notification"
  }

  func cancel(id: String) throws -> Bool {
    removeNotifications(for: id)
    guard #available(iOS 26.0, *), let registration = registrations[id] else { return false }

    let manager = AlarmManager.shared
    if manager.authorizationState == .authorized {
      try cancelIfPresent(registration.uuid, in: manager)
    }
    registrations[id] = nil
    return true
  }

  private func removeNotifications(for id: String) {
    notifications.removePendingNotificationRequests(withIdentifiers: [id])
    notifications.removeDeliveredNotifications(withIdentifiers: [id])
  }

  @available(iOS 26.0, *)
  private func scheduleWithAlarmKit(id: String, date: Date, title: String) async throws -> Bool {
    let manager = AlarmManager.shared
    guard manager.authorizationState == .authorized else { return false }

    let registration = registrations[id]
    let uuid = registration?.uuid ?? UUID()
    if let registration, let existing = try manager.alarms.first(where: { $0.id == uuid }) {
      if existing.schedule == .fixed(date), registration.title == title {
        return true
      }
      // AlarmKit 拒绝覆盖仍存在的 UUID。只有修改时才替换系统条目。
      try cancelIfPresent(uuid, in: manager)
    }

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
      tintColor: Color(red: 74 / 255, green: 123 / 255, blue: 181 / 255)
    )
    let config: AlarmManager.AlarmConfiguration<ZfAlarmMetadata> =
      .alarm(schedule: .fixed(date), attributes: attributes)

    // 先保存 UUID，避免系统已接收闹钟、进程退出后却找不到这条记录。
    registrations[id] = Registration(uuid: uuid, title: title)
    do {
      _ = try await manager.schedule(id: uuid, configuration: config)
      return true
    } catch {
      logger.warning("AlarmKit schedule failed: \(error.localizedDescription, privacy: .public)")
      // 只有确认没有对应系统闹钟后才降级，避免系统闹钟和通知同时提醒。
      guard manager.authorizationState == .authorized else { return false }
      return try manager.alarms.contains { $0.id == uuid }
    }
  }

  @available(iOS 26.0, *)
  private func cancelIfPresent(_ uuid: UUID, in manager: AlarmManager) throws {
    do {
      try manager.cancel(id: uuid)
    } catch {
      // 单次闹钟可能刚被系统或手表停止，列表里已经没有它。
      if try manager.alarms.contains(where: { $0.id == uuid }) { throw error }
    }
  }
}
