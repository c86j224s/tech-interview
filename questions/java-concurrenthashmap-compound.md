---
id: "java-concurrenthashmap-compound"
title: "ConcurrentHashMap에서 get 후 값이 없으면 put합니다. 스레드 안전한 map인데 중복 생성은 왜 생기나요?"
answerMinutes: 5
followups: [{"id": "transaction-and-lost-update", "prompt": "각 요청을 transaction으로 묶어도 읽기와 쓰기 사이의 경쟁이 남는다면 어떤 원자 조건을 추가하나요?"}, {"id": "java-synchronized-volatile", "prompt": "값의 가시성과 읽기·계산·쓰기 전체의 원자성은 어떤 동기화가 각각 필요한가요?"}, {"id": "cache-stampede-singleflight", "prompt": "동일 키의 원본 조회를 합쳐도 대기자·실패·분산 인스턴스의 남은 호출은 어떻게 제한하나요?"}]
difficulty: "중하"
category: "언어·런타임"
tags: ["Java", "언어·런타임"]
related: ["transaction-and-lost-update", "java-synchronized-volatile", "cache-stampede-singleflight"]
---

# ConcurrentHashMap에서 get 후 값이 없으면 put합니다. 스레드 안전한 map인데 중복 생성은 왜 생기나요?

## 구두 답변

개별 연산의 동시성 안전성과 여러 연산을 합친 check-then-act의 원자성은 다릅니다. 두 스레드가 모두 부재를 읽고 각각 생성할 수 있으므로 필요한 복합 연산을 원자적 API나 별도 락으로 표현해야 합니다.

### 동작 원리와 전제

putIfAbsent·computeIfAbsent 같은 API는 적용 범위와 callback 계약을 확인해 사용합니다. mapping 함수 안에 긴 외부 I/O나 재진입·다른 키의 복잡한 변경을 넣으면 경합·교착·예상 밖 비용이 생길 수 있습니다.

### 선택과 실패 처리

map에 저장된 객체의 필드를 여러 스레드가 수정하는 것은 map 자체의 보호와 별개입니다. 원자 카운터나 불변 값 교체, 객체별 동기화를 선택합니다. null 허용 여부와 iteration의 일관성도 일반 HashMap과 같지 않습니다.

### 구체적인 사례와 검증

값을 읽어 1 더한 뒤 put하는 두 호출은 동시에 같은 옛 값을 읽을 수 있습니다. map이 손상되지 않아도 카운터 증가가 유실되는 논리 경쟁입니다. compute나 atomic value를 쓰더라도 그 callback 안에서 외부 알림을 보내면 예외·재시도·별도 상태 변경의 원자성이 달라집니다. 저장할 값 계산을 짧고 부수 효과가 적게 유지하는 편이 안전합니다. cache 생성 함수가 긴 네트워크 요청이면 같은 키의 대기와 실패 후 재시작을 명시적으로 관리하는 singleflight 구조가 필요할 수 있습니다. 동시성 컬렉션은 내부 구조를 보호하는 도구이지 전체 업무 transaction은 아닙니다.

동시 생성·callback 실패·삭제 후 재생성·가변 value를 시험합니다. 한 번만 객체가 저장됐다는 것과 생성 과정의 외부 효과가 한 번만 실행됐다는 것을 구분합니다. 요청 멱등성은 데이터 구조 밖의 효과까지 설계해야 합니다.

## 득점 포인트

- 핵심 구분: 개별 연산의 동시성 안전성과 여러 연산을 합친 check-then-act의 원자성은 다릅니다.
- 선택 조건: map에 저장된 객체의 필드를 여러 스레드가 수정하는 것은 map 자체의 보호와 별개입니다.
- 검증 기준: 동시 생성·callback 실패·삭제 후 재생성·가변 value를 시험합니다.

## 감점 포인트

- ConcurrentHashMap의 get과 put을 묶으면 자동으로 원자적이라고 한다.

## 더 파고들 거리

- 각 요청을 transaction으로 묶어도 읽기와 쓰기 사이의 경쟁이 남는다면 어떤 원자 조건을 추가하나요?
- 값의 가시성과 읽기·계산·쓰기 전체의 원자성은 어떤 동기화가 각각 필요한가요?
- 동일 키의 원본 조회를 합쳐도 대기자·실패·분산 인스턴스의 남은 호출은 어떻게 제한하나요?
