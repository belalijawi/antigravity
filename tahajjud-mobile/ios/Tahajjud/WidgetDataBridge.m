#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(WidgetDataBridge, NSObject)

RCT_EXTERN_METHOD(
  writeWidgetData:(NSString *)nextPrayer
  nextPrayerTime:(double)nextPrayerTime
  streak:(nonnull NSNumber *)streak
  tahajjudStart:(double)tahajjudStart
  loggablePrayer:(NSString *)loggablePrayer
  prayerTimesJSON:(NSString *)prayerTimesJSON
  todayDateStr:(NSString *)todayDateStr
  loggedToday:(NSArray *)loggedToday
)

RCT_EXTERN_METHOD(
  writeDuaWidgetData:(NSString *)title
  arabic:(NSString *)arabic
  translation:(NSString *)translation
)

@end
