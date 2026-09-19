---
id: game-ecs-sparse-set-delete-reuse
title: Sparse set에서 삭제 후 entity 번호를 재사용할 때 stale handle을 어떻게 막나요?
difficulty: 중하
category: 게임 서버
tags:
  - ECS
  - sparse set
  - generation
related:
  - aoi-interest-management
  - iocp-generation-not-memory-safety
---
# Sparse set에서 삭제 후 entity 번호를 재사용할 때 stale handle을 어떻게 막나요?

## 구두 답변

dense의 swap-remove만으로 stale handle을 막을 수 없으므로 외부 handle에 index와 generation을 함께 넣어 검증합니다. dense가 `[7,10,13]`, `sparse[10]=1`일 때 10을 지우면 13을 1번으로 옮겨 dense를 `[7,13]`으로 만들고 `sparse[13]=1`로 고칩니다. 13의 예전 dense 위치를 저장한 참조는 무효입니다. ID 7을 재사용하면서 세대를 2에서 3으로 올리면 지연된 `(7,2)` packet은 거부하고 `(7,3)`만 통과시킵니다.

검사 시 alive, generation, dense의 실제 entity ID를 함께 확인하면 stale sparse 값도 걸러집니다. 다만 generation은 논리 수명만 검증하며 해제된 pointer를 안전하게 만들지 않습니다. 검증부터 접근까지 삭제가 끼어들 수 있으면 epoch, job barrier 또는 lock이 필요합니다. 유한 세대가 wrap되면 오래된 handle이 우연히 유효해질 수 있으므로 넓은 세대나 quarantine을 두고 stale 거부율과 wrap 위험을 기록합니다.

또한 sparse 배열의 미할당 ID를 존재하는 것으로 오인하지 않도록 dense 위치의 entity ID를 다시 확인해야 합니다. 삭제 직후 네트워크 명령이 들어오면 generation mismatch를 정상적인 폐기 경로로 처리하고, 포인터를 들고 있는 job은 generation 검사만으로 시작하지 말고 먼저 수명 barrier를 획득해야 합니다. 이 순서를 지켜야 논리적인 stale 차단과 실제 메모리 안전이 섞이지 않습니다.

 지연 메시지는 단순히 ID를 조회한 뒤 값을 쓰지 말고, 검증된 handle을 명령의 수명 동안 유지해야 합니다. 삭제와 재사용이 빠르게 반복되는 테스트에서 old generation 명령을 모두 거부하는지, 마지막 원소 이동 후 모든 sparse 역매핑이 dense와 일치하는지를 전수 비교하는 것이 안전한 시작점입니다.

## 득점 포인트

- dense swap-remove 뒤 옮긴 원소의 sparse 역매핑을 고칩니다.
- ID와 세대 검사를 객체 메모리의 수명 보호와 구분합니다.

## 감점 포인트

- 세대만 맞으면 이미 해제된 포인터를 읽어도 안전하다고 합니다.
- 마지막 원소 이동 뒤 sparse 위치를 갱신하지 않습니다.

## 더 파고들 거리

- 세대 카운터가 순환할 때 오래된 핸들과 충돌하지 않으려면 어떻게 하나요?
- 미할당 sparse 슬롯을 초기화하지 않는 구현은 존재 여부를 어떻게 검사하나요?
