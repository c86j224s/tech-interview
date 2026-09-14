---
id: connection-lifetime
title: DB 연결의 대기·보유·취소·세션 초기화
topic: 데이터베이스
summary: 짧은 query와 긴 transaction·스트리밍을 분리하고 pool 전체 예산·idle in transaction·취소 drain·role·시간대 reset을 설명합니다.
questionIds: [db-pool-long-transactions, idle-transaction-pool-starvation, database-streaming-client-backpressure, db-query-cancellation-state, db-connection-session-state]
---

# DB 연결의 대기·보유·취소·세션 초기화

## 풀 부족 전에 빌린 연결이 어디서 시간을 쓰는지 봅니다

연결을 얻어 주문을 읽고 같은 transaction 안에서 결제 API를 기다린 뒤 저장하면 SQL은 짧아도 연결은 결제 지연 전체를 점유합니다. pool을 키우면 잠시 대기를 줄일 수 있지만 하위 DB 동시성을 더 늘려 문제를 옮길 수 있습니다.

획득 대기·연결 보유·query 실행·transaction 시작~종료·결과 전송·reset을 별도 span으로 기록합니다. DB session ID와 요청 trace를 연결해 앱이 기다리는 위치와 DB의 실제 상태를 대조합니다.

| 시간·상태 | 남는 자원 | 개선할 경계 |
| --- | --- | --- |
| pool 획득 대기 | 요청 문맥·메모리 | 대기 상한·deadline |
| query 실행 | DB CPU·I/O·잠금 | SQL·인덱스·경합 |
| idle in transaction | 연결·snapshot·일부 잠금 | transaction 밖 외부 대기 |
| 느린 응답 스트리밍 | cursor·연결·버전 | 전송 상한·별도 export |
| 취소·reset 진행 | 프로토콜·세션 상태 | 실제 종결 전 재사용 금지 |

일반 idle 연결은 transaction 없이 pool에 대기할 수 있습니다. idle in transaction은 SQL을 실행하지 않아도 열린 거래·snapshot이 남는 상태입니다. 엔진별 view·명칭·보유 규칙을 확인하고 단순 idle이라는 로그만 보고 안전하다고 보지 않습니다.

## 거래 밖으로 대기를 옮기면 다시 검증해야 합니다

DB에서 짧게 예약·읽기를 확정하고 외부 API는 연결 밖에서 호출한 뒤 결과를 받아 조건부 갱신할 수 있습니다. 그러나 연결을 반납하는 순간 원래 transaction의 원자 경계도 끝납니다. expected version·예약 상태·논리 요청 ID를 유지하고 그 사이 변경을 다시 확인해야 합니다. 단순히 코드 위치만 옮기면 같은 정확성이 유지되지 않습니다.

서버 instance 10개에 pool 20개씩이면 최대 200개 연결에 배치·관리·복제·다른 서비스 예산이 추가됩니다. DB 최대 연결 수와 안정적인 실제 실행 병렬도는 다릅니다. 하위 CPU·I/O·lock 여유가 있고 정상 query 동시성이 병목일 때만 pool 증설을 검토합니다.

## 스트리밍은 메모리와 연결 보유를 교환합니다

큰 결과를 클라이언트 속도에 맞춰 조금씩 읽으면 앱 메모리는 줄일 수 있지만 DB cursor·transaction·연결이 오래 살아 있을 수 있습니다. 반대로 전체를 메모리에 담으면 연결은 빨리 돌려줘도 메모리 피크가 커집니다.

읽기 batch·버퍼 바이트·클라이언트 전송 기한·동시 export에 상한을 둡니다. 큰 보고서는 별도 내구 export 작업으로 생성해 검증한 객체 파일을 다운로드하게 할 수 있습니다. 고정 snapshot 요구와 파일 보관·권한·삭제가 추가되므로 무조건 더 낫다는 선택은 아닙니다.

```diagram
{"title":"연결을 풀에 반환할 때까지의 상태를 추적합니다","caption":"화살표는 정상 재사용 경계입니다. 사용자 timeout이 발생해도 서버 작업·응답·transaction·세션 정리가 확인되기 전에는 다음 사용자에게 넘기지 않습니다.","rows":[[{"id":"borrow","label":"pool에서 획득"}],[{"id":"execute","label":"쿼리·transaction·결과 소비"}],[{"id":"terminate","label":"실제 종결·rollback 확인"}],[{"id":"reset","label":"프로토콜 drain·세션 reset"}],[{"id":"return","label":"정상 반환 또는 폐기"}]],"edges":[{"from":"borrow","to":"execute","label":"요청 소유"},{"from":"execute","to":"terminate","label":"성공·실패·취소"},{"from":"terminate","to":"reset","label":"남은 상태 정리"},{"from":"reset","to":"return","label":"재사용 가능성 판정"}]}
```

## Timeout·Cancel·Rollback은 다른 상태입니다

client가 기다리기를 끝내고 취소 신호를 보냈어도 서버 query가 아직 실행 중이거나 commit이 이미 끝났을 수 있습니다. statement timeout·transaction timeout·connection 획득 timeout·전체 요청 deadline을 구분하고 정리 시간을 남깁니다.

실패한 transaction을 rollback해야 하는 엔진, 취소 후 결과를 drain해야 하는 driver 등 계약이 다릅니다. protocol 상태가 불확실한 연결을 풀에 돌려주면 다음 요청이 앞 결과·busy 오류를 만날 수 있습니다. 정상 reset이 확인되지 않으면 폐기합니다. commit 응답 유실은 안정된 요청 기록을 조회해 중복 변경 없이 복구합니다.

## 물리 세션의 옛 Role·시간대가 다음 요청에 남지 않아야 합니다

요청 A가 search_path·role·timezone·isolation·임시 테이블·세션 변수를 바꾸고 반환하면 B의 같은 SQL이 다른 의미로 실행될 수 있습니다. 가능한 transaction-local 설정을 사용하고 실제 pool·driver의 rollback/reset 범위를 확인합니다. `close()` 메서드가 물리 연결 종료인지 풀 반환인지도 다릅니다.

prepared statement·임시 객체 reset은 성능 비용과 연결됩니다. 모든 상태를 무작정 지우기보다 필요한 상태를 최소화하고 검증된 반환 계약을 사용합니다. reset 실패를 정상 성공으로 숨기지 않습니다. 다른 스레드의 ThreadLocal 정리와 DB 세션 정리도 별개입니다.

## 물리 연결 하나로 오염을 재현합니다

pool을 테스트에서 한 연결로 제한하고 A가 설정 변경·예외·취소를 겪은 뒤 B를 실행합니다. B의 role·시간대·transaction·결과가 초기 계약과 같은지 확인합니다. 느린 client·외부 API·commit 응답 유실에서는 실제 DB session·lock 해제 시각까지 봅니다.

현재 작업에서는 각 DB driver의 취소·reset·스트리밍을 실행하지 않았습니다. 본문은 연결 수명과 관측 설계이며 실제 pool 성능 측정 결과가 아닙니다.
