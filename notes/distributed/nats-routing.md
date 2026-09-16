---
id: nats-routing
title: NATS Subject·Queue Group·Request Inbox의 수명
topic: 분산 시스템
summary: 서비스별 fan-out과 내부 분배·wildcard 범위를 설명하고 no responders·timeout·첫 응답·늦은 inbox·내구 작업의 차이를 구분합니다.
questionIds: [nats-subject-queue-group, nats-wildcard-token-matching, nats-request-reply, nats-inbox-request-lifetime]
---

# NATS Subject·Queue Group·Request Inbox의 수명

## 분석과 알림을 같은 Queue Group에 넣으면 일을 나눠 가집니다

orders.created에 분석 A1·A2는 analytics group, 알림 N1·N2는 notifications group으로 구독하면 한 메시지가 각 group의 한 인스턴스로 전달될 수 있습니다. 네 인스턴스를 같은 group에 넣으면 전체에서 한 곳만 받아 분석이나 알림 중 하나가 빠질 수 있습니다. 일반 subscriber는 각각 받아 별도 fan-out합니다.

queue group은 현재 구독자 사이 분배이며 내구 메시지 보관·consumer ACK·외부 효과 단일 실행을 자동 제공하지 않습니다. 같은 계정의 연속 이벤트도 서로 다른 worker가 처리하면 완료 순서가 달라질 수 있습니다.

## Wildcard는 점으로 나뉜 Token 범위입니다

| 패턴 | 포함 예 | 제외 예 |
| --- | --- | --- |
| orders.*.created | orders.eu.created | orders.eu.vip.created |
| orders.> | orders.created, orders.eu.created | orders |
| tenant-a.prod.> | tenant-a.prod.orders | tenant-b.prod.orders |

NATS subject는 점으로 나눈 token들의 열입니다. `*`는 정확히 한 token을, 끝 위치의 `>`는 하나 이상의 token을 매칭하므로 wildcard의 포함 범위는 token 수로 결정됩니다. 사용자 ID에 임의의 점이나 wildcard를 넣으면 이 범위가 바뀔 수 있으므로 내부 ID·허용 문자·인코딩 규칙을 정합니다. subject 이름만으로 보안 격리가 생기지 않으므로 publish·subscribe 권한·account import/export·inbox를 별도로 제한합니다.

```diagram
{"title":"서비스별 전체 수신과 내부 분배를 함께 만듭니다","caption":"화살표는 한 이벤트의 논리 전달입니다. 각 group은 독립 수신하지만 group 안 모든 인스턴스가 동시에 받는다는 뜻은 아닙니다.","rows":[[{"id":"event","label":"orders.created 이벤트"}],[{"id":"analytics","label":"analytics group","detail":["A1 또는 A2"]},{"id":"notifications","label":"notifications group","detail":["N1 또는 N2"]}]],"edges":[{"from":"event","to":"analytics","label":"분석용 한 전달"},{"from":"event","to":"notifications","label":"알림용 한 전달"}]}
```

## Request-reply는 요청 Subject와 응답 Inbox를 연결합니다

요청자는 요청 subject와 자신이 만든 reply inbox를 함께 보내고, responder는 그 inbox로 결과를 돌려보냅니다. 지원되는 server·client에서 no responders가 나오면 발행 시점에 그 subject를 받을 구독자가 없었다는 빠른 신호이고, timeout은 정한 시간 안에 응답을 받지 못했다는 결과입니다. timeout만으로는 responder가 받지 못했는지, 처리·DB commit 뒤 응답을 잃었는지 구분할 수 없습니다.

| 결과 | 알 수 있는 것 | 확인할 경계 |
| --- | --- | --- |
| no responders | 관찰된 수신자 부재 | subject·배포·account 연결·권한 |
| timeout | 응답을 제때 못 받음 | 수신·처리·commit·응답 유실 |
| 첫 응답 성공 | 한 responder 응답 도착 | 다른 responder 실행 여부 |
| 늦은 응답 | 끝난 요청의 잔여 결과 가능 | 요청 ID·세대·기한 |

responder가 DB transaction을 commit한 뒤 reply를 보내기 전에 죽으면 requester는 timeout을 보지만 주문은 이미 남아 있습니다. requester는 같은 논리 요청 ID로 기존 결과를 조회하거나 같은 ID로 멱등 재요청해야 하며, retry마다 새 ID를 만들면 같은 업무인지 판별할 경계를 잃습니다. no responders도 요청 기능의 영구 부재나 권한 성공을 증명하지 않으므로, 발행 시점의 구독 부재와 처리·commit·응답 유실을 다른 오류 경로로 진단합니다.

## 첫 응답만 받아도 여러 실행이 있었을 수 있습니다

일반 구독자가 여러 개면 모두 요청을 처리할 수 있는데 request API는 첫 응답만 채택할 수 있습니다. 변경 작업이라면 같은 서비스의 queue group·최종 저장소 멱등성을 사용합니다. 여러 결과를 모두 모으는 목적이면 기대 응답 집합·기한·부분 실패를 정의한 별도 집계 계약이 필요합니다.

request timeout이 responder의 계산·외부 API를 자동 취소하지 않습니다. 요청 deadline·협력적 취소·실제 종결을 설계하고 반드시 완료할 작업은 내구 ID로 접수한 뒤 결과를 나중 조회하는 API가 더 적합할 수 있습니다.

## Inbox 재사용에는 상관 ID와 세대가 필요합니다

client가 하나의 inbox로 여러 요청을 multiplex하는 방식은 사용 라이브러리의 계약을 따릅니다. 수동으로 재사용한다면 요청 A가 timeout된 뒤 같은 inbox를 요청 B가 쓰는 순간을 기준으로, 늦게 도착한 응답의 correlation ID·기한·완료 상태·세대가 B와 맞는지 검사한 뒤에만 반영합니다. A의 구독을 timeout 뒤 정리해도 A가 이미 남긴 외부 효과까지 취소되지는 않습니다.

중복 응답은 단일 완료를 유지하고 큰 payload·동시 request·대기 map·reply 권한에 상한을 둡니다. correlation ID는 메시지 연결 정보이지 인증 증명이 아닙니다. 외부가 고른 reply subject로 민감 데이터를 무조건 보내지 않습니다.

## 수신 분포와 결과 수명을 따로 확인합니다

테스트 broker에서 group별 수신·일반 subscriber 추가·wildcard 경계·no responders·지연 응답·중복 응답·재연결을 검사합니다. 발행→수신→DB commit→reply 발행→요청자 수신을 같은 논리 ID로 연결합니다. 현재 작업에서는 NATS broker를 실행하지 않았습니다. 본문은 routing과 RPC 수명의 설명입니다.
