Pod::Spec.new do |s|
  s.name           = 'ZfAlarmIos'
  s.version        = '1.0.0'
  s.summary        = '周而复起 iOS 闹钟网关:AlarmKit(iOS 26+)主路径 + UNUserNotificationCenter 通知降级'
  s.description    = s.summary
  s.author         = 'TNT-Likely'
  s.homepage       = 'https://github.com/TNT-Likely/zhouerfuqi'
  s.license        = { :type => 'MIT' }
  s.platforms      = { :ios => '16.4' }
  s.source         = { :path => __dir__ }
  s.source_files   = 'ios/**/*.{swift,h,m,mm}'
  s.swift_version  = '5.0'
  s.dependency 'ExpoModulesCore'
  # iOS 26 才有 AlarmKit;weak link 保证 16.4+ 全版本可安装、旧系统运行时走通知降级
  s.weak_frameworks = ['AlarmKit']
end
