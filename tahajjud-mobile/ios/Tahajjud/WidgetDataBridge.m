#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(WidgetDataBridge, NSObject)

RCT_EXTERN_METHOD(
  writeWidgetData:(NSString *)nextPrayer
  nextPrayerTime:(double)nextPrayerTime
  streak:(nonnull NSNumber *)streak
  tahajjudStart:(double)tahajjudStart
)

@end
