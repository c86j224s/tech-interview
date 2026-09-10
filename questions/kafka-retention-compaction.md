---
id: kafka-retention-compaction
title: "Kafka에 오래된 이벤트를 정리하면서 키별 최신 상태는 남기려 합니다. 시간·크기 기반 retention과 log compaction은 무엇을 각각 보존하나요?"
difficulty: 하
category: 분산 시스템
tags: ["Kafka","retention","compaction"]
related: ["kafka-partition-offset"]
---

# Kafka에 오래된 이벤트를 정리하면서 키별 최신 상태는 남기려 합니다. 시간·크기 기반 retention과 log compaction은 무엇을 각각 보존하나요?

## 구두 답변

시간·크기 retention은 partition의 오래된 segment(연속 로그 파일 묶음)를 기준으로 삭제해 로그 보관 기간이나 디스크 사용량을 제한합니다. segment 단위로 정리되므로 보관 시각이 레코드마다 정확히 일치하지 않을 수 있습니다. Log compaction은 같은 키의 최신 상태를 재구성할 수 있도록 더 오래된 동일 키 레코드를 백그라운드에서 정리하는 정책입니다. compaction이 켜져도 즉시 키당 한 레코드만 남는 것은 아니며, segment·dirty 비율·정리 시점과 설정에 따라 여러 레코드가 한동안 공존할 수 있습니다.

모든 상태 변경 이력을 분석해야 한다면 compaction만으로는 과거 값이 사라져 목적을 달성할 수 없습니다. 반대로 재시작 때 키별 최신 상태를 복원하는 changelog에는 적합할 수 있습니다. 삭제는 tombstone 레코드로 표현되며 이것도 일정 기간 뒤 정리될 수 있으므로, 오래 중단된 consumer가 tombstone을 놓친 뒤 전체 상태를 어떻게 재구축할지 복구 절차가 필요합니다.

retention과 compaction을 함께 두면 최신 값도 시간·크기 정책으로 사라질 수 있으므로 “현재 상태를 영구 보관한다”라고 가정하지 않겠습니다. compact된 로그를 처음부터 읽는 소비자와 오래 뒤 재개하는 소비자를 시험하고, 이력 보관이 필요하면 원본 이벤트 저장소와 최신 상태 topic을 분리하겠습니다. offset은 남아 있어도 중간 레코드가 제거됐다는 사실을 복구 로직이 감당해야 합니다.

## 득점 포인트

- segment 삭제와 키 기반 정리를 시간축·키축으로 구분한다.
- compaction 지연과 tombstone 수명을 설명한다.
- 이력 재생과 최신 상태 복구를 저장 설계로 연결한다.

## 감점 포인트

- compaction이면 즉시 키당 한 레코드만 남는다고 말한다.
- tombstone이 영구 보존된다고 가정한다.
- 정리된 로그의 offset을 연속 배열 인덱스로 취급한다.

## 더 파고들 거리

- tombstone을 놓친 consumer가 checkpoint와 전체 스냅샷으로 상태를 복구하려면 무엇이 필요한가요?
- compact와 delete 정책을 함께 둘 때 최신 상태 복구의 시간 한계는 무엇인가요?
- compaction topic에서 null key가 거절되는 이유는 무엇이며, 값이 null인 tombstone과는 어떻게 다른가요?
