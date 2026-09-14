---
id: shutdown-admission
title: 종료 Admission·Drain·장기 스트림의 재개
topic: 설계
summary: 신규 수락과 작업 등록을 원자 관리하고 HTTP/consumer/scheduler 유입·기존 연결·스트림 cursor·커밋/Ack·공유 자원·강제 종료 복구 순서를 설명합니다.
questionIds: [graceful-shutdown, shutdown-child-admission-race, streaming-request-drain-contract]
---

# 종료 Admission·Drain·장기 스트림의 재개

## DB Pool보다 먼저 그 Pool을 사용하는 작업을 정리합니다

주문 저장 중 pool을 닫으면 정상 종료가 스스로 실패를 만듭니다. Running→Draining→Stopping→Stopped 상태를 두고 반복 종료 신호가 정리를 두 번 실행하지 않게 합니다. 새 유입을 닫고 접수한 작업의 완료 또는 복구 가능 상태를 기록한 뒤 공유 자원을 닫습니다.

readiness를 내리는 것만으로 모든 유입이 즉시 사라지지 않습니다. endpoint 전파·기존 keep-alive·HTTP/2 stream·message fetch·scheduler·백그라운드 자식 생성은 다른 경로입니다.

## 수락 검사와 Counter 증가는 한 규칙으로 묶습니다

A가 `stopping=false`를 읽은 뒤 멈추고 종료자가 stopping=true·active=0을 보고 pool을 닫으면, A가 나중에 active를 올리고 닫힌 pool을 사용할 수 있습니다. 상태 검사와 등록을 같은 lock/CAS protocol로 보호합니다.

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

실행 전에 등록하고 submission 실패·취소에서 등록을 한 번 rollback합니다. 완료는 finally 등 소유 경계에서 정확히 한 번 감소·notify합니다. drain 뒤 새 child가 필요한 기존 작업은 그 생성이 거절돼도 안전하게 종결되도록 설계하거나, 미리 등록된 task tree 범위 내의 명시적 child admission 정책을 둡니다. 종료자가 0을 확인한 뒤 새 작업이 생기는 틈을 남기지 않습니다.

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

짧은 요청은 남은 시간 내 완료할 수 있지만 끝이 없는 stream은 최대 drain·재개 위치·부분 결과 계약이 필요합니다. HTTP/2 GOAWAY 같은 지원 신호는 새 stream을 다른 연결로 유도할 수 있어도 처리된 변경의 재시도 안전성은 별도입니다. WebSocket도 새 연결에서 세션·마지막 수신/적용 위치를 복원해야 합니다.

이미 전송한 bytes와 외부 변경은 취소되지 않습니다. 같은 cursor·event ID·논리 요청 key로 누락과 중복을 복구하고 server retention 밖 cursor는 resync 계약으로 처리합니다.

## 내부 기한은 강제 종료 전에 정리를 남길 만큼 짧아야 합니다

앱 내부 deadline을 orchestrator 유예보다 짧게 두고 상태 전파·취소·기록·flush 시간을 예산화합니다. 취소 무시 I/O의 buffer를 아직 사용 중인데 반환해서는 안 됩니다. 종료를 보장할 수 없으면 내구 불확정 기록과 process 강제 종료 후 복구를 명시하며 깨끗한 drain 성공으로 보고하지 않습니다.

Ack 전 crash·commit 뒤 응답 유실·drain과 child 등록 경쟁·긴 stream·반복 신호를 시험합니다. 실제 종료 시간·잔존 작업·중복/유실 원장을 봅니다. 이 노트는 종료 설계이며 실제 orchestrator 강제 종료 시험 결과는 아닙니다.
