---
id: "js-abortcontroller-lifetime"
title: "fetch를 AbortController로 취소하면 서버의 주문 생성도 취소되나요?"
answerMinutes: 5
followups: [{"id": "deadline-cancellation-propagation", "prompt": "상위 응답이 timeout된 뒤에도 하위 작업이 남는다면 취소 요청과 실제 종료를 어떻게 확인하나요?"}, {"id": "request-timeout-idempotency", "prompt": "성공 응답을 잃은 변경을 다시 실행하기 전에 어떤 논리 키와 결과 조회가 필요한가요?"}, {"id": "js-event-listener-cleanup", "prompt": "화면이 사라진 뒤 callback·timer가 남지 않게 등록·해제를 어떤 소유권에 묶나요?"}]
difficulty: "중하"
category: "언어·런타임"
tags: ["JavaScript", "언어·런타임"]
related: ["deadline-cancellation-propagation", "request-timeout-idempotency", "js-event-listener-cleanup"]
---

# fetch를 AbortController로 취소하면 서버의 주문 생성도 취소되나요?

## 구두 답변

AbortController는 지원하는 API에 중단 신호를 전달하는 수단이며 브라우저의 대기·읽기 중단과 서버의 외부 변경 rollback은 다릅니다. 서버가 이미 주문을 저장했다면 클라이언트 취소 뒤에도 결과가 남을 수 있습니다.

### 동작 원리와 전제

signal을 관련 하위 작업에 전달하고 늦은 응답이 새 화면 상태를 덮지 않도록 요청 세대를 비교합니다. 이전 검색을 취소한 뒤 새 검색을 시작해도 취소를 지원하지 않는 변환 작업은 계속될 수 있습니다. 취소 오류와 네트워크 오류를 구분합니다.

### 선택과 실패 처리

같은 controller는 abort 후 다시 초기 상태로 되돌아가지 않으므로 새 작업 수명에는 새 controller를 씁니다. 이벤트 listener와 timer도 정리해야 합니다. 변경 요청의 재시도는 논리 ID와 결과 조회를 사용합니다.

### 구체적인 사례와 검증

사용자가 검색어를 A에서 B로 바꾸고 A 요청을 abort해도 A의 후속 CPU 변환이나 캐시 조회가 완료될 수 있습니다. 결과 적용 시 현재 요청 ID와 일치하는지 확인하면 화면 역행을 막을 수 있습니다. 이것은 서버의 변경 취소와 다른 문제입니다. 주문 요청을 abort한 경우에는 서버가 이미 생성한 주문을 조회할 논리 ID를 유지해야 합니다. 화면 unmount 시 listener·timer·worker까지 어떤 작업을 정리할지 소유 범위를 정의합니다. controller를 공유하면 한 기능의 취소가 다른 기능까지 중단할 수 있어 같은 수명을 가진 작업끼리만 묶어야 합니다.

응답 직전 취소·본문 스트림 중단·새 요청 전환·서버 commit 후 연결 종료를 시험합니다. 화면에는 취소됐지만 서버 결과가 불확실한 상태를 정확히 표시합니다. 취소는 사용자 경험과 자원 회수에 유용하지만 업무 원자성의 보장은 아닙니다.

## 득점 포인트

- 핵심 구분: AbortController는 지원하는 API에 중단 신호를 전달하는 수단이며 브라우저의 대기·읽기 중단과 서버의 외부 변경 rollback은 다릅니다.
- 선택 조건: 같은 controller는 abort 후 다시 초기 상태로 되돌아가지 않으므로 새 작업 수명에는 새 controller를 씁니다.
- 검증 기준: 응답 직전 취소·본문 스트림 중단·새 요청 전환·서버 commit 후 연결 종료를 시험합니다.

## 감점 포인트

- fetch abort가 서버 transaction과 모든 후속 계산을 롤백한다고 한다.

## 더 파고들 거리

- 상위 응답이 timeout된 뒤에도 하위 작업이 남는다면 취소 요청과 실제 종료를 어떻게 확인하나요?
- 성공 응답을 잃은 변경을 다시 실행하기 전에 어떤 논리 키와 결과 조회가 필요한가요?
- 화면이 사라진 뒤 callback·timer가 남지 않게 등록·해제를 어떤 소유권에 묶나요?
