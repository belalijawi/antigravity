#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(DhikrIntentsBridge, NSObject)

RCT_EXTERN_METHOD(
  consumePendingDhikrTaps:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject
)

RCT_EXTERN_METHOD(
  ackPendingDhikrTaps:(NSDictionary *)amounts
  resolver:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject
)

@end
