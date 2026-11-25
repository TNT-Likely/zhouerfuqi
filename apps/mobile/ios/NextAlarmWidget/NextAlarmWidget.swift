import SwiftUI
import WidgetKit

private let appGroup = "group.com.tntlikely.zhouerfuqi"
private let planKey = "zf.next.alarms.v1"

private struct PlannedAlarm: Decodable {
  let epochMs: Double
  let date: String
  let time: String
  let title: String

  var timestamp: Date { Date(timeIntervalSince1970: epochMs / 1000) }
}

private struct NextAlarmEntry: TimelineEntry {
  let date: Date
  let alarm: PlannedAlarm?
}

private struct NextAlarmProvider: TimelineProvider {
  func placeholder(in context: Context) -> NextAlarmEntry {
    NextAlarmEntry(date: .now, alarm: PlannedAlarm(epochMs: 0, date: "明天", time: "06:40", title: "上班 · 第一道"))
  }

  func getSnapshot(in context: Context, completion: @escaping (NextAlarmEntry) -> Void) {
    completion(context.isPreview ? placeholder(in: context) : entry(at: .now, alarms: readPlan()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<NextAlarmEntry>) -> Void) {
    let now = Date()
    let alarms = readPlan().filter { $0.timestamp > now }
    let updates = Set(alarms.map(\.timestamp)).sorted()
    let entries = [entry(at: now, alarms: alarms)] + updates.map { entry(at: $0, alarms: alarms) }
    completion(Timeline(entries: entries, policy: .never))
  }

  private func entry(at date: Date, alarms: [PlannedAlarm]) -> NextAlarmEntry {
    NextAlarmEntry(date: date, alarm: alarms.first { $0.timestamp > date })
  }

  private func readPlan() -> [PlannedAlarm] {
    guard let json = UserDefaults(suiteName: appGroup)?.string(forKey: planKey),
          let data = json.data(using: .utf8) else { return [] }
    return (try? JSONDecoder().decode([PlannedAlarm].self, from: data)) ?? []
  }
}

private struct NextAlarmView: View {
  let entry: NextAlarmEntry

  private var fill: LinearGradient {
    LinearGradient(colors: [Color(red: 0.10, green: 0.20, blue: 0.33), Color(red: 0.04, green: 0.08, blue: 0.16)],
      startPoint: .topLeading, endPoint: .bottomTrailing)
  }

  private var face: some View {
    VStack(alignment: .leading, spacing: 4) {
      Label("下次计划响铃", systemImage: "alarm")
        .font(.caption2.weight(.semibold))
        .foregroundStyle(Color(red: 0.72, green: 0.83, blue: 0.98))
      if let alarm = entry.alarm {
        Text(alarm.time)
          .font(.system(size: 34, weight: .bold, design: .rounded).monospacedDigit())
          .minimumScaleFactor(0.70)
          .lineLimit(1)
        Text(alarm.title).font(.caption.weight(.semibold)).lineLimit(2)
        Text(alarm.date).font(.caption2)
      } else {
        Text("近期暂无计划").font(.callout.weight(.semibold))
      }
    }
    .foregroundStyle(.white)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    .widgetURL(URL(string: "zhouerfuqi://"))
    .accessibilityElement(children: .combine)
  }

  var body: some View {
    if #available(iOSApplicationExtension 17.0, *) {
      face.containerBackground(for: .widget) { fill }
    } else {
      face.padding(14).background(fill)
    }
  }
}

@main
struct NextAlarmWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "ZhouerfuqiNextAlarm", provider: NextAlarmProvider()) { entry in
      NextAlarmView(entry: entry)
    }
    .configurationDisplayName("下一次响铃")
    .description("在桌面查看周而复起的下一次计划响铃。")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}
