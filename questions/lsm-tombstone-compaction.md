---
id: lsm-tombstone-compaction
title: 삭제 tombstone이 남아 있는 LSM에서 너무 이른 compaction이 왜 데이터를 부활시킬 수 있나요?
difficulty: 중하
category: 데이터베이스
tags:
  - LSM
  - tombstone
  - compaction
  - MVCC
related:
  - db-postgres-vacuum
---
# 삭제 tombstone이 남아 있는 LSM에서 너무 이른 compaction이 왜 데이터를 부활시킬 수 있나요?

## 구두 답변

tombstone은 물리적으로 key를 지운 흔적이 아니라, 더 오래된 sequence의 value를 가리는 논리 사건입니다. `Fnew`에 `k@200 delete`, `Fold`에 `k@150 value`가 있다고 하겠습니다. 정상 lookup은 최신 파일에서 k@200을 먼저 보고 부재를 반환합니다. 그런데 compaction이 Fnew의 tombstone을 버리고 Fold의 value만 남기면, 다음 lookup은 k@150을 유효한 값으로 오인해 삭제된 k를 부활시킵니다.

안전성은 “새 output을 만들었다”가 아니라 compaction 입력과 serving file range를 기준으로 판단합니다. LevelDB implementation notes가 직접 설명하는 조건은 deletion marker가 현재 key를 덮을 수 있는 higher-numbered level의 overlapping file이 없을 때 drop될 수 있다는 범위 조건입니다. 따라서 같은 compaction 입력에 k@200 delete와 k@150 value가 함께 들어오면 오래된 value를 제거하고 marker를 남기거나, 더 이상 가릴 파일이 없다는 제품 계약 아래 marker를 drop할 수 있습니다. 이 조건을 snapshot·replica·backup의 전체 수명 규칙으로 확대하지는 않겠습니다.

LevelDB를 포함해 snapshot을 지원하는 엔진이라면 오래된 snapshot reader가 어떤 sequence를 볼 수 있는지와 compaction drop 규칙을 별도로 확인해야 합니다. snapshot이 k@150을 읽을 수 있다면 오래된 value를 함께 제거하지 못할 수 있기 때문입니다. tombstone 보존 조건과 snapshot이 요구하는 이전 value 보존 조건을 각각 확인해야 합니다. 반대로 LevelDB notes만 읽은 상태에서 “모든 snapshot이 끝나야 한다”고 단정하는 것도 근거가 부족합니다. 장애 시험에서는 old input, new output, MANIFEST publish 순서를 기록하고, publish 전 중단이면 이전 파일 집합으로, publish 후면 새 집합으로 재시작되는지 확인합니다.

## 득점 포인트

- tombstone을 오래된 value를 가리는 sequence 정보로 정의합니다.
- k@200 delete와 k@150 value의 compaction 전후 lookup을 추적합니다.
- file-range 조건과 snapshot·replica 보존 계약을 서로 다른 제품 경계로 분리합니다.

## 감점 포인트

- 새 SSTable에 delete가 들어갔다는 이유만으로 즉시 marker를 버립니다.
- compaction output 완료만으로 모든 reader가 old input을 보지 않는다고 가정합니다.
- PostgreSQL dead tuple과 LSM tombstone을 같은 수명 규칙으로 설명합니다.

## 더 파고들 거리

- snapshot sequence가 k@150을 볼 수 있는 동안 marker를 유지해야 하는 상태를 그려 보세요.
- compaction 중 프로세스가 종료됐을 때 output과 input을 어떤 manifest 경계로 교체할까요?
