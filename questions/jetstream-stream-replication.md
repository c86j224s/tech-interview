---
id: jetstream-stream-replication
title: "JetStream stream의 replicas를 1에서 3으로 늘리려 합니다. 저장 확인, 장애 대응, 자원 비용에서 무엇이 달라지나요?"
answerMinutes: 5
followups: [{"id":"consensus-quorum-failure","prompt":"replica가 3개여도 quorum을 잃으면 왜 쓰기를 확정하지 않아야 하나요?"},{"id":"jetstream-ack-redelivery","prompt":"stream 저장은 성공했지만 consumer ACK가 유실되면 DB 중복을 어떻게 막나요?"},{"id":"kafka-acks-isr","prompt":"JetStream 생산 확인과 Kafka acks·ISR의 공통 보장 경계를 어떻게 설명하나요?"}]
difficulty: 하
category: 분산 시스템
tags: ["NATS","JetStream","복제"]
related: ["consensus-quorum-failure"]
---

# JetStream stream의 replicas를 1에서 3으로 늘리려 합니다. 저장 확인, 장애 대응, 자원 비용에서 무엇이 달라지나요?

## 구두 답변

JetStream stream의 replicas를 1에서 3으로 늘리면 한 노드 장애 뒤 저장 로그를 유지할 가능성이 커지지만 저장 공간·복제 네트워크·확인 지연이 늘어납니다. 같은 장애 영역에 복제본을 모으면 숫자만큼 안전하지 않습니다.

### ACK의 층위

producer의 저장 성공은 stream의 설정된 저장·복제 조건을 통과했다는 뜻이고 consumer ACK는 앱이 전달 메시지를 처리했다고 알리는 상태입니다. 생산 ACK가 consumer 처리를 뜻하지 않고 consumer ACK가 외부 DB exactly once도 뜻하지 않습니다.

replicas=1은 저장 노드 장애 범위가 크고 3은 일부 장애와 leader 전환 여지가 있지만, 느린 replica나 quorum 손실 때 쓰기가 지연·거부될 수 있습니다. 메모리 저장과 파일 저장의 재시작·전원 장애 보장도 다릅니다. leader·replica lag·장애 영역·retention·ACK 의미를 확인하겠습니다.

검증은 leader 하나와 장애 영역 둘을 각각 중단하고, 생산 ACK 후 복구 레코드, consumer ACK와 외부 효과를 따로 봅니다. 복제 수는 마법의 안전 스위치가 아니라 RPO·RTO·쓰기 지연·비용을 정하는 선택입니다.

### 복제 그룹과 장애 영역

replicas=3인 stream의 복제 그룹은 정상 프로토콜에서 과반을 이용해 변경을 확정하므로, 서로 통신하는 두 복제본이 남으면 한 노드 장애를 견디도록 구성할 수 있습니다. 두 복제본을 잃으면 남은 하나가 데이터를 가지고 있어도 일반 쓰기 확정이 멈출 수 있습니다. 실제 배치에서 세 복제본이 같은 호스트·랙·지역에 있으면 공통 장애에 취약하므로 배치 정책과 저장장치 수명까지 확인합니다.

복제 수를 늘리면 데이터 사본과 네트워크 전송량이 늘고 새 노드를 따라잡게 하는 복구 부하도 생깁니다. 가장 느린 복제본 하나가 모든 요청의 지연을 반드시 결정한다고 단정하지 않고, 실제 쿼럼 응답과 복제 지연을 관측합니다. 과반이 느려진 경우와 과반은 빠르지만 하나가 뒤처진 경우는 생산 지연과 복구 여유가 다릅니다.

### 디스크 기록과 응답 유실

파일 저장은 메모리 저장보다 프로세스 재시작 복구에 유리하지만, 쓰기 응답이 모든 저장장치의 전원 장애 내구화를 뜻하는지는 sync 설정과 구현 계약을 확인해야 합니다. OS 페이지 캐시에만 있는 데이터는 프로세스 중단과 호스트 전원 손실에서 결과가 다를 수 있습니다. 복제 확인과 각 디스크 flush를 같은 보장으로 말하지 않겠습니다.

생산자가 PubAck를 못 받았다고 저장 실패로 단정할 수도 없습니다. 메시지 ID로 지원 범위 안의 중복 발행을 줄이고, 소비자가 논리 이벤트 ID로 외부 효과를 보호합니다. stream 상태와 consumer 상태의 복제 설정·복구도 따로 확인해야 합니다. stream 로그가 살아 있어도 소비자 ACK 위치가 복구되지 않으면 더 많은 재전달이 발생할 수 있기 때문입니다.

시험에서는 정상 응답을 받은 이벤트 ID 목록을 따로 보존하고 리더 종료·단일 디스크 손실·장애 영역 손실 뒤 남은 로그와 대조합니다. 저장 성공률만 아니라 새 리더 선출 시간, 복제 지연 해소 시간, 재전달과 실제 DB 변경 횟수를 분리해 기록하겠습니다.

## 득점 포인트

- 복제 수와 배치·저장을 함께 본다.
- 생산·소비 ACK를 분리한다.
- quorum 손실 비용을 말한다.
- leader·consumer 복구를 별도로 검증한다.

## 감점 포인트

- replica 수만으로 내구성을 보장한다.
- 메모리·파일 저장을 같은 계약으로 본다.
- consumer ACK가 외부 exactly once라고 말한다.

## 더 파고들 거리

- 느린 replica
- leader 전환 timeout
- stream과 consumer 복구
