---
id: java-resource-reachability
title: Java GC 도달성·외부 자원·클래스 로더 수명
topic: 언어·런타임
summary: 순환과 root 보유를 구분하고 try-with-resources·suppressed 오류·Cleaner·재배포 registry·metaspace 관측을 설명합니다.
questionIds: [java-gc-reachability, java-gc-root-leak-classification, java-cleaner-explicit-close, java-classloader-leak]
---

# Java GC 도달성·외부 자원·클래스 로더 수명

## 서로 가리켜도 외부에서 도달하지 못하면 수집 가능할 수 있습니다

A.next=B, B.next=A인 두 객체만 남고 스레드 스택이나 전역 registry 같은 GC root에서 두 객체로 가는 참조가 끊겼다고 합시다. 추적 GC는 서로 몇 번 가리키는지가 아니라 root에서 따라갈 수 있는지를 보므로, 이 순환은 수집 대상이 될 수 있습니다. 반대로 순환이 없어도 살아 있는 스레드나 전역 registry가 객체를 계속 참조하면 객체는 남습니다.

수집 가능하다는 것은 즉시 또는 정해진 시간까지 수집된다는 뜻이 아닙니다. System.gc 요청도 필요한 파일·연결 반환의 완료 보장이 아닙니다. 메모리 객체의 수명과 OS 자원의 적시 반납을 나눠야 합니다.

## 큰 객체보다 그것을 붙잡은 소유자를 찾습니다

| 보유 경로 | 조사 대상 | 수정 방향 |
| --- | --- | --- |
| 살아 있는 thread stack | 끝나지 않은 작업·지역 참조 | 대기 종료·작업 상한 |
| static·전역 registry | 캐시·listener 등록 | 용량·만료·등록 해제 |
| ThreadLocal value | 장수 worker의 옛 요청 | 실행 범위 remove·복원 |
| JNI handle | native의 강한 참조 | native 소유·해제 계약 |
| class loader 경로 | 옛 앱 타입·thread context loader | 재배포 종료·registry 정리 |

static 필드가 보인다는 사실만으로 영구 누수라고 결론내리지 말고, 그 필드를 가진 클래스·클래스 로더가 root에서 객체까지 이어지는 살아 있는 경로를 먼저 찾습니다. heap dump에서는 root 경로로 누가 객체를 붙잡는지, dominator로 특정 노드가 함께 보유하는 하위 객체 범위를, retained size로 그 노드를 유지할 때 따라오는 메모리 규모를 나눠 봅니다. 기능이 끝난 뒤에도 그 보유 경로가 필요한지 설계와 대조하고, 정상 캐시라도 만료·용량 제한 없이 계속 보유하면 메모리 용량 문제가 됩니다.

## 파일과 연결은 Try-with-resources로 범위를 드러냅니다

AutoCloseable 자원을 try-with-resources 괄호 안에 넣으면 블록이 정상 종료되거나 본문에서 예외가 나도 범위를 빠져나갈 때 close가 호출됩니다. 자원을 여러 개 선언하면 선언한 역순으로 닫히고, 본문과 close가 모두 실패하면 close 오류는 보통 본문 예외에 suppressed로 붙습니다. 따라서 로그와 오류 전달에서 주 예외만 남기지 말고 suppressed 오류도 함께 확인해야 자원 정리 실패를 놓치지 않습니다.

```java
try (var in = java.nio.file.Files.newInputStream(path)) {
    consume(in);
}
```

path와 consume은 호출 환경에서 제공합니다. 이 구조는 핸들 정리를 표현하지만 consume의 외부 변경을 롤백하지 않습니다. 쓰기 저장의 flush·close·내구화 성공을 호출자가 알아야 한다면 명시 commit API와 오류 계약이 필요합니다. 강제 프로세스 종료에서 정상 정리를 기대하지 않습니다.

```diagram
{"title":"힙 수집과 자원 반납의 책임을 분리합니다","caption":"화살표는 별개의 종료 경로입니다. 정상 자원 소유자는 사용 범위 끝에서 close하고 GC는 이후 도달 불가능한 래퍼의 메모리를 수집할 수 있습니다.","rows":[[{"id":"owner","label":"자원 소유 객체 사용"}],[{"id":"close","label":"명시 close·오류 처리"}],[{"id":"unreachable","label":"래퍼가 도달 불가능해짐"}],[{"id":"gc","label":"GC의 메모리 수집 가능"}]],"edges":[{"from":"owner","to":"close","label":"사용 범위 종료"},{"from":"close","to":"unreachable","label":"남은 참조 종료"},{"from":"unreachable","to":"gc","label":"시점은 GC 정책"}]}
```

## Cleaner는 놓친 정리의 안전망입니다

Cleaner의 자동 실행 시점은 명시 close처럼 통제되지 않으므로 필수 연결·파일 반납을 맡기지 않습니다. 정리 action이 원래 객체를 강하게 캡처하면 그 객체의 수집을 막을 수 있으므로 필요한 별도 자원 상태만 보유하도록 설계합니다. 중복 close·clean 호출은 자원을 두 번 해제하지 않도록 하나의 상태 전이로 처리합니다.

정리 실패는 호출자에게 정상 결과처럼 숨기지 말고 자원 특성에 맞는 진단 경로를 둡니다. Cleaner나 finalization에 중요한 내구 commit을 맡기지 않습니다. finalization은 오래전부터 권장되지 않았으며 최신 JDK의 제거·비활성 정책도 확인해야 합니다. WeakReference·SoftReference도 정확한 캐시 TTL·용량·필수 데이터 보존을 제공하는 도구가 아닙니다.

## 재배포는 옛 Class Loader의 접근 경로를 끊어야 합니다

앱이 등록한 listener가 프로세스 전역 registry에 남으면 그 callback의 클래스와 로더가 계속 연결될 수 있습니다. 종료하지 않은 executor·timer·thread context class loader·ThreadLocal도 옛 앱의 타입 집합을 붙잡을 수 있습니다. 앱 변수 하나에 null을 넣어도 다른 root 경로는 남습니다.

종료에서 새 작업 차단·기존 작업 종결·listener 해제·worker 종료·전역 등록 해제를 순서대로 수행합니다. 로더별 클래스 수·살아 있는 로더·metaspace·일반 heap·native 메모리를 구분합니다. 클래스 언로드는 단일 System.gc 호출 직후 반드시 일어나는 사건이 아니므로 반복 재배포의 추세와 실제 강한 참조를 함께 봅니다.

## 기능 종료와 보유 경로의 소멸을 대조합니다

작은 합성 앱을 여러 번 load·사용·close하고 이전 loader가 수집 가능한 상태가 되는지 확인합니다. heap dump·thread dump·클래스 로딩 지표를 연결하고, 열린 FD·DB 풀 사용량은 별도 카운터로 측정합니다. close 실패·본문 예외·Cleaner 누락 경로도 검사합니다.

Homebrew OpenJDK 21.0.12.1의 `scripts/VerifyJavaStudy.java`로 본문 오류와 close 오류가 겹칠 때 suppressed 정리 오류가 남는 사례를 확인했습니다. heap dump·재배포·Cleaner·클래스 언로드 실험은 실행하지 않았습니다. 이 노트는 수집 시각의 실제 측정 결과를 제시하지 않습니다.
