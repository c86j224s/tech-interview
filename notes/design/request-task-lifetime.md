---
id: request-task-lifetime
title: 요청 Deadline·취소·Fan-out의 실제 종료
topic: 설계
summary: 응답과 실행 수명을 나누고 남은 예산·필수/선택 결과·단일 응답 전이·다중 오류·잔존 자식 소유·독립 내구 job을 설명합니다.
questionIds: [deadline-cancellation-propagation, cancellation-completion-single-result, structured-concurrency-fanout, fanout-multiple-error-report, request-independent-durable-job]
---

# 요청 Deadline·취소·Fan-out의 실제 종료

## 기다림이 끝났다고 실행이 끝난 것은 아닙니다

전체 요청 1초 중 인증 0.2초·조회 0.5초를 사용했다면 다음 호출에는 0.3초 이하만 남습니다. queue·retry·직렬화·정리도 같은 예산을 사용합니다. 각 단계마다 새 1초를 주면 전체 시간이 계속 늘어납니다. 자식 deadline은 부모 잔여와 자식 자체 상한 중 짧은 값으로 제한합니다.

한 process의 경과는 monotonic clock을 쓰되 그 절대값을 다른 host에 그대로 보내지 않습니다. RPC의 상대 timeout/deadline 계약과 전송 시간·clock skew 처리를 확인합니다. 외부 client가 무한히 긴 기한을 보내도 server 자체 상한을 적용합니다.

## 필수와 선택 결과부터 정합니다

프로필·권한은 필수이고 추천은 선택이라면 권한 실패에서 정상 결과를 만들 수 없습니다. 불필요한 자식을 취소하고 실제 종료를 추적합니다. 추천 실패는 필수 결과로 응답할 수 있지만 누락·실패율을 따로 남깁니다. HTTP 200만 세면 품질 저하를 숨깁니다.

Promise.all의 빠른 rejection처럼 첫 오류 반환은 형제 취소·종료를 보장하지 않을 수 있습니다. 구조화된 동시성은 자식 수명을 부모 범위에서 관리하는 원칙이고 단순 future 배열보다 강합니다. 부모 100개×fan-out 20개면 2000개 물리 작업이 생기므로 부모별·서비스 전체·하위 자원별 한도가 모두 필요합니다.

```diagram
{"title":"응답 정책과 자식 정리는 별도로 확정합니다","caption":"화살표는 작업 흐름입니다. 필수 실패로 응답을 결정해도 남은 자식의 취소·실제 종료·자원 회수 책임은 남습니다.","rows":[[{"id":"parent","label":"부모 요청·전체 deadline"}],[{"id":"required","label":"필수 · 프로필·권한"},{"id":"optional","label":"선택 · 추천"}],[{"id":"decision","label":"성공·부분 성공·대표 실패"}],[{"id":"cleanup","label":"자식 종료 확인·잔존 소유·자원 반환"}]],"edges":[{"from":"parent","to":"required","label":"필수 조건"},{"from":"parent","to":"optional","label":"제한된 부가 작업"},{"from":"required","to":"decision","label":"유효 응답 판정"},{"from":"optional","to":"decision","label":"누락 명시"},{"from":"decision","to":"cleanup","label":"정리 생략 금지"}]}
```

## 단일 응답의 승자와 실제 효과의 사실을 나눕니다

Pending에서 Completed 또는 Cancelled로 CAS/lock 안에서 한 번만 바꾸고 승자만 사용자 결과를 전달합니다. 두 callback이 각각 `if (!done)`을 읽고 나중에 done을 쓰면 둘 다 전달할 수 있습니다.

```text
onCompletion(result):
  recordObservedEffect(result)
  if CAS(replyState, Pending, Completed): deliver(result)
  releaseResourcesOnlyAfterActualCompletion()

onCancellation():
  if CAS(replyState, Pending, Cancelled): deliverCancellation()
  requestChildCancellation()
```

이는 개념 모델입니다. 실제로는 결과 기록의 내구성·callback 예외·한 번만 반환할 resource owner를 구현해야 합니다. 취소가 이긴 뒤 예약 성공이 도착해도 그 사실을 버리지 않고 대사·사용자 안내에 남깁니다. 취소 응답은 이미 commit한 결제의 rollback이 아닙니다.

## 첫 도착 오류가 반드시 원인은 아닙니다

DB 실패가 형제를 취소해 만든 Cancelled와 원래 DB error를 구분합니다. 사용자에게는 업무상 필요한 대표 결과, 진단에는 나머지 실패·cleanup 실패·부분 성공 ID를 남깁니다. 내부 stack·secret은 노출하지 않고 trace로 연결합니다. 동시에 두 필수 호출이 실패하는 경우도 첫 번째 문자열 하나로 모든 정보를 지우지 않습니다.

## 취소 불가능한 작업은 소유권을 버리지 않습니다

OS가 송신 buffer를 읽거나 DB driver가 protocol을 정리하는 중에는 사용자 응답 종료만으로 pool에 반환할 수 없습니다. 실제 종료·재사용 가능 상태를 확인하고 불명확한 연결은 폐기합니다. 자식이 취소를 무시하면 부모가 제시간에 반환하면서 자식도 그 전에 반드시 종료됐다고 동시에 약속할 수 없습니다. 격리 실행 한도 또는 별도 감독자의 명시적 소유·최대 수명·잔존 관측이 필요합니다.

반드시 이어야 하는 job은 접수 의도를 내구화한 뒤 ID를 반환하고 독립 worker가 lease·deadline·retry·멱등·결과 조회를 소유합니다. detached thread만으로는 process restart 내구성이 없습니다. 중요 실행 전에 현재 권한 철회·취소 조건도 재검사합니다.

## 응답 외에 남은 실행을 검증합니다

제출 전 취소·실행 중·commit 뒤·동시 완료·여러 오류·선택 작업 잔존을 시험합니다. 사용자 응답 횟수·원장·남은 작업·buffer·connection·취소 후 종료 시간을 봅니다. 이 노트는 수명 설계이며 실제 외부 API 취소 시험 결과는 아닙니다.
