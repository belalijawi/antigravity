#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(PendingIntentsBridge, NSObject)

RCT_EXTERN_METHOD(
  consumePendingLogs:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject
)

RCT_EXTERN_METHOD(
  ackPendingLogs:(NSArray *)entries
  resolver:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject
)

@end
