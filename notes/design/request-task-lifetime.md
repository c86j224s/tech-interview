---
id: request-task-lifetime
title: 요청 Deadline·취소·Fan-out의 실제 종료
topic: 설계
summary: 응답과 실행 수명을 나누고 남은 예산·필수/선택 결과·단일 응답 전이·다중 오류·잔존 자식 소유·독립 내구 job을 설명합니다.
questionIds: [deadline-cancellation-propagation, cancellation-completion-single-result, structured-concurrency-fanout, fanout-multiple-error-report, request-independent-durable-job]
---

# 요청 Deadline·취소·Fan-out의 실제 종료

이 노트는 요청의 응답 수명과 실제 작업·자원 수명을 별도 상태로 모델링합니다. deadline과 취소는 더 이상 기다리지 않겠다는 신호일 수 있지만 이미 송신·커밋·외부 효과가 끝났다는 뜻은 아니므로, 사용자 응답·자식 종료·내구 작업의 소유자를 각각 확정해야 합니다.

## 대기 종료와 실제 실행 종료의 분리

전체 요청 1초 중 인증 0.2초·조회 0.5초를 사용했다면 다음 호출에는 0.3초 이하만 남습니다. queue·retry·직렬화·정리도 같은 예산을 사용합니다. 각 단계마다 새 1초를 주면 전체 시간이 계속 늘어납니다. 자식 deadline은 부모 잔여와 자식 자체 상한 중 짧은 값으로 제한합니다.

한 process의 경과는 monotonic clock을 쓰되 그 절대값을 다른 host에 그대로 보내지 않습니다. RPC의 상대 timeout/deadline 계약과 전송 시간·clock skew 처리를 확인합니다. 외부 client가 무한히 긴 기한을 보내도 server 자체 상한을 적용합니다.

deadline은 더 기다릴 수 있는 예산의 끝이고 cancellation은 작업에 중단을 요청하는 신호이며, 둘 다 이미 발생한 외부 효과를 취소했다는 확인이 아닙니다. 따라서 호출자는 남은 예산을 자식에게 전달하고, 자식은 취소를 관찰하는 지점과 실제 종료 시점을 보고해야 합니다. 이 구분이 있어야 응답을 빨리 반환하면서도 connection·buffer·child task를 조기에 재사용하지 않습니다.

## 필수 결과와 선택 결과의 우선 결정

프로필·권한은 필수이고 추천은 선택이라면 권한 실패에서 정상 결과를 만들 수 없습니다. 불필요한 자식을 취소하고 실제 종료를 추적합니다. 추천 실패는 필수 결과로 응답할 수 있지만 누락·실패율을 따로 남깁니다. HTTP 200만 세면 품질 저하를 숨깁니다.

Promise.all의 빠른 rejection처럼 첫 오류 반환은 형제 취소·종료를 보장하지 않을 수 있습니다. 구조화된 동시성은 자식 수명을 부모 범위에서 관리하는 원칙이고 단순 future 배열보다 강합니다. 부모 100개×fan-out 20개면 2000개 물리 작업이 생기므로 부모별·서비스 전체·하위 자원별 한도가 모두 필요합니다.

```diagram
{"title":"응답 정책과 자식 정리는 별도로 확정합니다","caption":"화살표는 작업 흐름입니다. 필수 실패로 응답을 결정해도 남은 자식의 취소·실제 종료·자원 회수 책임은 남습니다.","rows":[[{"id":"parent","label":"부모 요청·전체 deadline"}],[{"id":"required","label":"필수 · 프로필·권한"},{"id":"optional","label":"선택 · 추천"}],[{"id":"decision","label":"성공·부분 성공·대표 실패"}],[{"id":"cleanup","label":"자식 종료 확인·잔존 소유·자원 반환"}]],"edges":[{"from":"parent","to":"required","label":"필수 조건"},{"from":"parent","to":"optional","label":"제한된 부가 작업"},{"from":"required","to":"decision","label":"유효 응답 판정"},{"from":"optional","to":"decision","label":"누락 명시"},{"from":"decision","to":"cleanup","label":"정리 생략 금지"}]}
```

판정 순서는 먼저 필수 자식의 성공 여부를 확정하고 그 다음 선택 결과의 누락을 표현하는 방식이 안전합니다. 예를 들어 권한이 실패했는데 추천이 성공했다면 추천 데이터가 정상 업무 응답처럼 노출되어서는 안 되며, 반대로 추천만 timeout이면 필수 결과와 “추천 미완료”를 분리할 수 있습니다. 각 결과에 필수/선택, deadline, 취소 원인을 구조화해 기록하면 부분 성공을 HTTP 상태 하나로 잃지 않습니다.

## 단일 응답 승자와 실제 작업 효과의 별도 추적

완료·취소 두 경로가 동시에 들어와도 `replyState`를 Pending에서 Completed 또는 Cancelled로 CAS/lock 안에서 한 번만 바꾸고, 상태를 바꾼 승자만 사용자 결과를 전달하게 합니다. 예를 들어 두 callback이 각각 `if (!done)`을 읽은 뒤 나중에 done을 쓰면 둘 다 아직 미완료라고 판단해 응답을 보낼 수 있습니다. 이 단일 응답 규칙은 사용자에게 한 번만 결과를 주는 경계이고, 실제 작업이 끝났는지와 자원 회수 시점은 별도로 추적해야 합니다.

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

상태 추적은 `Pending → Completed|Cancelled` 전이와 `actualCompletion`을 별도 필드로 두는 방식으로 읽을 수 있습니다. 취소가 먼저 승리한 뒤 결제 완료 callback이 도착하면 사용자 응답은 바뀌지 않지만, 실제 효과와 후속 대사가 기록되어야 합니다. 반대로 callback이 먼저 완료를 확정하면 이후 취소는 응답을 다시 덮지 않고 이미 끝난 효과를 취소하지도 않습니다.

## 첫 도착 오류와 실제 원인의 분리

DB 실패가 형제를 취소해 만든 Cancelled와 원래 DB error를 구분합니다. 사용자에게는 업무상 필요한 대표 결과, 진단에는 나머지 실패·cleanup 실패·부분 성공 ID를 남깁니다. 내부 stack·secret은 노출하지 않고 trace로 연결합니다. 동시에 두 필수 호출이 실패하는 경우도 첫 번째 문자열 하나로 모든 정보를 지우지 않습니다.

## 취소 불가능 작업의 소유권 유지

OS가 아직 송신 buffer를 읽거나 DB driver가 protocol을 정리하는 중이라면, 사용자 응답을 끝냈다는 이유만으로 connection을 pool에 돌려보내지 않습니다. 실제 종료와 재사용 가능 상태를 확인하고, 어느 쪽인지 불명확한 연결은 폐기합니다. 자식이 취소를 무시하는 상황에서는 부모가 제시간에 응답을 반환해도 자식이 먼저 끝났다고 약속할 수 없으므로, 격리 실행 한도 또는 별도 감독자에게 명시적 소유·최대 수명·잔존 관측을 둡니다.

반드시 이어야 하는 job은 접수 의도를 내구화한 뒤 ID를 반환하고 독립 worker가 lease·deadline·retry·멱등·결과 조회를 소유합니다. detached thread만으로는 process restart 내구성이 없습니다. 중요 실행 전에 현재 권한 철회·취소 조건도 재검사합니다.

## 응답 이후 잔존 실행의 검증

제출 전 취소·실행 중·commit 뒤·동시 완료·여러 오류·선택 작업 잔존을 시험합니다. 사용자 응답 횟수·원장·남은 작업·buffer·connection·취소 후 종료 시간을 봅니다. 이 노트는 수명 설계이며 실제 외부 API 취소 시험 결과는 아닙니다.

검증 표에는 사용자 응답 횟수, 자식의 실제 종료 시각, pool 반환 시각, 외부 효과의 확정 여부를 각각 둡니다. “cancel 호출이 반환됨”만으로 자식 종료를 판정하지 말고, 취소를 무시하는 자식은 격리·감독 한도 초과로 분류합니다. 내구 job 경로는 process restart 뒤에도 같은 논리 ID로 한 번의 효과와 결과 조회가 가능한지 별도 시험해야 합니다.
