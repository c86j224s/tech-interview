---
id: "elasticsearch-alias-reindex-cutover"
title: "mapping 변경을 위해 새 인덱스로 재색인합니다. 동시 쓰기·삭제를 놓치지 않고 alias를 언제 전환하나요?"
difficulty: "중하"
category: "데이터베이스"
tags: ["Elasticsearch","shard","mapping","심화 질문"]
related: ["elasticsearch-shard-mapping","composite-index-column-order"]
promotedFrom: {"id":"elasticsearch-shard-mapping","prompt":"mapping 변경과 alias 전환의 무중단 절차를 검증해 보세요."}
---

# mapping 변경을 위해 새 인덱스로 재색인합니다. 동시 쓰기·삭제를 놓치지 않고 alias를 언제 전환하나요?

## 구두 답변

기준 snapshot과 이후 변경·삭제를 새 인덱스에 빠짐없이 반영하고 source version을 비교해야 합니다. reindex 명령 완료만으로 복사 중 발생한 모든 정상 쓰기까지 따라잡았다고 가정하지 않습니다.

건수·대표 질의·문서 version·삭제 상태를 대조한 뒤 alias를 원자 전환하는 기능을 사용합니다. 새 인덱스에 들어온 쓰기가 있으면 옛 인덱스로 되돌릴 때 역동기화가 필요할 수 있습니다. dual write·outbox·CDC 중 실제 복구 가능한 경로를 선택합니다.

## 득점 포인트

- 기준 snapshot과 이후 변경·삭제를 새 인덱스에 빠짐없이 반영하고 source version을 비교해야 합니다. reindex 명령 완료만으로 복사 중 발생한 모든 정상 쓰기까지 따라잡았다고 가정하지 않습니다.
- dual write·outbox·CDC 중 실제 복구 가능한 경로를 선택합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 기준 snapshot과 이후 변경·삭제를 새 인덱스에 빠짐없이 반영하고 source version을 비교해야 합니다.

## 더 파고들 거리

- [기본 상황과 비교: 검색용 데이터에 정확한 ID 조회와 본문 검색이 함께 있습니다. Elasticsearch의 mapping과 shard 수를 어떻게 정해야 하나요?](/tech-interview/questions/elasticsearch-shard-mapping/)
