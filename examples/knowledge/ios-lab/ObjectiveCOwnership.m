#import <Foundation/Foundation.h>

@interface Speaker : NSObject
- (NSString *)message;
@end
@implementation Speaker
- (NSString *)message { return @"base"; }
@end
@interface ChildSpeaker : Speaker
@end
@implementation ChildSpeaker
- (NSString *)message { return @"child"; }
@end

@interface Owner : NSObject
@property(nonatomic, strong) NSObject *strongObject;
@property(nonatomic, assign) NSObject *assignObject;
@property(nonatomic, weak) NSObject *weakObject;
@property(nonatomic, unsafe_unretained) NSObject *unsafeObject;
@end

@implementation Owner
@end

int main(void) {
    @autoreleasepool {
        Speaker *speaker = [ChildSpeaker new];
        NSCAssert([[speaker message] isEqualToString:@"child"], @"dynamic dispatch");
        NSCAssert(![speaker respondsToSelector:NSSelectorFromString(@"missingMethod")], @"optional selector guard");
        NSLog(@"PASS Objective-C dynamic dispatch and selector guard");
        Owner *owner = [Owner new];
        NSObject *object = [NSObject new];

        owner.strongObject = object;
        owner.assignObject = object;
        owner.weakObject = object;
        owner.unsafeObject = object;

        NSLog(@"strong=%@ assign=%p weak=%@ unsafe=%p",
              owner.strongObject,
              owner.assignObject,
              owner.weakObject,
              owner.unsafeObject);

        object = nil;
        NSLog(@"weak after owner-owned strong remains=%@", owner.weakObject);

        owner.strongObject = nil;
        NSLog(@"weak after final strong release=%@", owner.weakObject);
        NSLog(@"assign/unsafe pointers are non-owning and do not become nil automatically");
    }
    return 0;
}
