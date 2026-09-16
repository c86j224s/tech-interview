---
id: shutdown-admission
title: 종료 Admission·Drain·장기 스트림의 재개
topic: 설계
summary: 신규 수락과 작업 등록을 원자 관리하고 HTTP/consumer/scheduler 유입·기존 연결·스트림 cursor·커밋/Ack·공유 자원·강제 종료 복구 순서를 설명합니다.
questionIds: [graceful-shutdown, shutdown-child-admission-race, streaming-request-drain-contract]
---

# 종료 Admission·Drain·장기 스트림의 재개

## DB Pool보다 먼저 그 Pool을 사용하는 작업을 정리합니다

주문 저장 요청이 아직 pool connection을 빌린 상태에서 pool을 닫으면 정상 종료 절차가 그 요청을 실패시킵니다. 그래서 서비스 상태를 `Running→Draining→Stopping→Stopped`로 나누고, 종료 신호가 반복되어도 이미 끝낸 정리를 다시 실행하지 않게 합니다. 먼저 새 유입을 닫고 접수한 작업을 완료시키거나 복구 가능한 상태로 기록한 뒤, 작업이 더 이상 사용하지 않는 공유 자원을 닫습니다.

readiness를 내리는 것만으로 모든 유입이 즉시 사라지지 않습니다. endpoint 전파·기존 keep-alive·HTTP/2 stream·message fetch·scheduler·백그라운드 자식 생성은 다른 경로입니다.

## 수락 검사와 Counter 증가는 한 규칙으로 묶습니다

`A`가 `stopping=false`를 읽은 뒤 멈추는 사이 종료자가 `stopping=true`와 `active=0`을 확인하고 pool을 닫으면, `A`가 나중에 `active`를 올리고 닫힌 pool을 사용할 수 있습니다. 따라서 상태 검사와 작업 등록은 별도의 두 단계가 아니라 같은 lock 또는 예상값을 비교해 한 번에 바꾸는 CAS protocol 안에서 처리합니다.

상태 검사와 `active` 증가를 그 protocol 안에서 함께 확정한 뒤에만 작업 실행을 허용해야, 종료자가 `active == 0`을 확인한 직후 새 작업이 생기지 않습니다.

```text
register():
  lock(m)
  if state != Running: unlock(m); return Rejected
  active += 1
  unlock(m)
  return Registration

drain():
  lock(m)
  state = Draining
  waitUntil(active == 0, deadline)  # condition wait는 lock을 풀고 기다림
  unlock(m)
```

작업은 실제 실행에 제출하기 전에 등록하고, 실행되지 않았음이 확실한 submission 실패나 제출 전 취소에서는 그 등록을 한 번 되돌립니다. 이미 실행 중인 작업의 취소 요청만으로는 등록을 제거하지 않습니다.

완료 경계(`finally` 등)에서 작업의 소유자가 `active`를 정확히 한 번 감소시키고, 대기 중인 `drain`에 `notify`합니다. drain 중인 기존 작업이 새 child를 만들어야 한다면 child 등록이 거절되어도 안전하게 끝나도록 설계하거나, 미리 등록된 task tree 범위에서만 child admission을 허용합니다.

그래야 종료자가 `active == 0`을 확인한 직후 새 작업이 생기는 틈이 남지 않습니다.

## 진입 경로별로 Drain합니다

| 경로 | 새 유입 차단 | 기존 작업 처리 |
| --- | --- | --- |
| HTTP | readiness·listener·새 stream 제한 | 남은 deadline 내 완료·안전 retry |
| consumer | 새 fetch/pull 중지 | 효과 commit 후 Ack·미확인 재처리 |
| scheduler | 새 회차·child 생성 중지 | 실행 회차 ID·복구 상태 보존 |
| 장기 stream | 새 연결 차단·종료 안내 | 최종 cursor·부분 결과·재접속 |

```diagram
{"title":"작업 수명 뒤에 공유 자원을 닫습니다","caption":"화살표는 종료 순서입니다. 외부 효과가 불확정인 작업은 기록·대사 경로로 남기고 종료 신호 자체를 rollback으로 해석하지 않습니다.","rows":[[{"id":"admit","label":"readiness·모든 신규 등록 차단"}],[{"id":"drain","label":"진행 작업·stream drain"}],[{"id":"deadline","label":"기한 도달·취소·불확정 기록"}],[{"id":"resources","label":"실제 사용 종료 후 pool close"}],[{"id":"logs","label":"제한된 log flush·종료"}]],"edges":[{"from":"admit","to":"drain","label":"등록 경계 고정"},{"from":"drain","to":"deadline","label":"무한 대기 금지"},{"from":"deadline","to":"resources","label":"자원 수명 확인"},{"from":"resources","to":"logs","label":"의존 정리"}]}
```

## 스트림은 순간 이동하지 않습니다

짧은 요청은 남은 시간 안에 완료할 수 있지만, 끝이 없는 stream은 최대 drain 시간·재개 위치·부분 결과를 정하는 별도 계약이 필요합니다. HTTP/2의 `GOAWAY` 같은 지원 신호는 새 stream을 다른 연결로 유도할 수 있어도, 이미 처리된 변경의 재시도 안전성은 별도입니다. WebSocket도 새 연결에서 세션과 마지막 수신/적용 위치를 복원해야 합니다.

이미 전송한 bytes와 외부 변경은 취소되지 않습니다. 같은 cursor·event ID·논리 요청 key로 누락과 중복을 복구하고 server retention 밖 cursor는 resync 계약으로 처리합니다.

## 내부 기한은 강제 종료 전에 정리를 남길 만큼 짧아야 합니다

앱 내부 deadline을 orchestrator 유예보다 짧게 두고 상태 전파·취소·기록·flush 시간을 예산화합니다. 취소 무시 I/O의 buffer를 아직 사용 중인데 반환해서는 안 됩니다. 종료를 보장할 수 없으면 내구 불확정 기록과 process 강제 종료 후 복구를 명시하며 깨끗한 drain 성공으로 보고하지 않습니다.

Ack 전 crash·commit 뒤 응답 유실·drain과 child 등록 경쟁·긴 stream·반복 신호를 시험합니다. 실제 종료 시간·잔존 작업·중복/유실 원장을 봅니다. 이 노트는 종료 설계이며 실제 orchestrator 강제 종료 시험 결과는 아닙니다.
