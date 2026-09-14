---
id: "kraft-metadata-change-load"
title: "topic·partition 변경이 매우 많습니다. KRaft metadata 로그와 controller의 병목을 어떻게 관찰하나요?"
difficulty: "중하"
category: "분산 시스템"
tags: ["Kafka","KRaft","메타데이터","심화 질문"]
related: ["kafka-kraft-role","raft-log-commit-apply","kafka-acks-isr"]
promotedFrom: {"id":"kafka-kraft-role","prompt":"metadata 변경 부하"}
---

# topic·partition 변경이 매우 많습니다. KRaft metadata 로그와 controller의 병목을 어떻게 관찰하나요?

## 구두 답변

metadata 변경은 controller의 합의 로그·상태 전파·broker 반영에 부하를 줄 수 있습니다. 데이터 생산 TPS와 topic 생성·partition 변화율을 별도 지표로 봅니다.

많은 작은 topic·잦은 churn이 메모리·디스크·복구 시간에 미치는 영향을 측정합니다. controller 과반 장애와 data leader 장애를 나누어 시험하고 quota·변경 예산을 둡니다. 버전별 기능·운영 권장을 확인합니다.

## 득점 포인트

- metadata 변경은 controller의 합의 로그·상태 전파·broker 반영에 부하를 줄 수 있습니다. 데이터 생산 TPS와 topic 생성·partition 변화율을 별도 지표로 봅니다.
- 버전별 기능·운영 권장을 확인합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: metadata 변경은 controller의 합의 로그·상태 전파·broker 반영에 부하를 줄 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: Kafka에서 컨트롤러 노드 장애와 데이터 파티션 리더 장애가 각각 발생했습니다. KRaft의 합의와 파티션 복제는 어떤 상태를 관리하며 어떻게 역할이 다른가요?](/tech-interview/questions/kafka-kraft-role/)
