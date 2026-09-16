---
id: grpc-execution
title: gRPC 계약·업무 오류·스트림 Backpressure
topic: 설계
summary: REST/OpenAPI와 gRPC/protobuf의 경계를 비교하고 혼합 schema·domain 거절·timeout 불확정·HTTP/2 부하·앱 queue와 실행 demand를 설명합니다.
questionIds: [grpc-rest-contracts, grpc-domain-error-retry-semantics, grpc-stream-application-backpressure]
---

# gRPC 계약·업무 오류·스트림 Backpressure

## 코드 생성은 유용하지만 gRPC만의 기능은 아닙니다

gRPC는 service method·message schema에서 여러 언어의 client/server 코드를 만들고 unary·streaming·deadline을 일관되게 다루기 좋습니다. REST는 JSON이라는 형식 자체가 아니라 HTTP 자원 의미를 활용하는 설계이고 OpenAPI 코드 생성도 가능합니다. 수동 JSON 대 자동 생성이라는 비교보다 소비자 환경·streaming·계약 운영을 봅니다.

브라우저는 gRPC-Web/proxy 등 추가 경로가 필요할 수 있고 외부 consumer·운영 도구에는 HTTP API가 더 자연스러울 수 있습니다. protobuf가 작더라도 DB·호출 수·lock이 병목이면 protocol 교체의 효과는 제한적입니다.

## 구조 Schema와 행동 계약은 별도입니다

구 client가 새 server에 붙거나 새 client가 구 server에 붙는 상황을 먼저 두고, field 번호를 재사용하지 않는지와 unknown enum·단위·default·presence가 어떻게 보이는지 확인합니다. gateway를 거치는 경우에는 protobuf 값이 JSON으로 바뀌는 결과도 같은 조합에서 확인합니다.

생성 코드가 같아도 “잔액 부족”을 어떤 결과로 전달하고 client가 무엇을 retry할지는 별도로 합의해야 하며, schema 배포가 모든 서비스를 동시에 바꾸게 만들면 독립 배포 이점이 줄어듭니다.

| 결과 | 계약 방향 |
| --- | --- |
| 잔액 부족 | 정상 업무 거절·자동 통신 retry 금지 |
| 잘못된 인자 | 입력 수정 가능 정보 |
| 권한 부족 | 재인가 또는 거절·우회 금지 |
| 일시 연결 장애 | 안전한 경우 제한된 retry |
| deadline 후 불확정 | 논리 key·결과 조회·대사 |

업무 거절을 response의 명시적 결과로 표현하거나 적절한 status/details로 표현할 수 있지만 여러 언어 client가 동일 의미를 처리해야 합니다. 잔액 부족을 UNAVAILABLE처럼 표시하면 retry interceptor가 같은 요청을 반복할 수 있습니다. 반대로 timeout을 “잔액 검사 실패라서 결제 없음”으로 판단해서도 안 됩니다.

## 전송 Flow Control과 앱 Queue는 다른 Buffer입니다

HTTP/2의 bytes 수신 조절은 전송 단계의 흐름 제어일 뿐, 앱이 이미 받은 메시지의 처리 수를 제한하지 않습니다. 메시지가 도착할 때마다 worker를 즉시 만들면 heap과 DB 대기만 커질 수 있습니다. 그래서 수신 demand를 bounded queue의 수·bytes 한도와 연결하고, queue에서 꺼낸 작업만 worker와 DB permit을 차례로 얻도록 같은 처리 예산으로 묶습니다. 이 연결이 실제로 적용되는지는 구현 언어의 수동 read/demand API와 내부 buffering 계약을 확인해야 합니다.

```diagram
{"title":"수신 허가를 실제 처리 여유와 연결합니다","caption":"화살표는 payload 수명입니다. 전송 흐름 제어가 이미 deserialize된 객체와 앱 queue의 상한을 자동 보장하지 않습니다.","rows":[[{"id":"transport","label":"gRPC/HTTP2 수신"}],[{"id":"queue","label":"메시지 수·bytes 제한 queue"}],[{"id":"worker","label":"실행·DB/외부 permit"}],[{"id":"done","label":"실제 완료·참조 종료"}]],"edges":[{"from":"transport","to":"queue","label":"여유만큼 read"},{"from":"queue","to":"worker","label":"유효 deadline"},{"from":"worker","to":"done","label":"처리 예산 반환"}]}
```

큰 메시지 하나와 작은 메시지 천 개는 다른 비용이므로 수·bytes·동시 실행을 함께 제한합니다. stream 수가 많으면 stream별 제한의 합이 service 총량을 넘지 않게 합니다. 포화에서는 read를 늦추거나 명시적으로 거절하고 전체 deadline·취소를 하위에 전파합니다.

## 긴 연결은 부하 분산과 종료의 단위가 됩니다

connection 단위 LB가 오래 유지되는 HTTP/2 연결을 한 instance에 붙이면 stream이 많아도 편중될 수 있습니다. client-side balancing·proxy·connection 정책과 실제 활성 stream을 확인합니다. GOAWAY·drain·재연결을 적용해도 이미 commit한 효과의 rollback은 아닙니다. 재개 위치·논리 key·결과 조회가 필요합니다.

## 대표 입력과 실제 오류 경로로 비교합니다

같은 payload·DB·connection reuse에서 serialize CPU·bytes·p95/p99·총 호출을 비교합니다. 느린 consumer·큰 메시지·동시 stream·업무 거절·deadline 후 commit·구형 generated client·JSON gateway를 시험합니다. 이 노트는 protocol 선택 설계이며 실제 gRPC/REST benchmark를 실행한 결과는 아닙니다.
