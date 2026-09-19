---
id: cache-write-allocate-policy
title: >-
  쓰기 miss에서 line을 먼저 읽어온 뒤 수정할지 바로 메모리에 쓸지 선택합니다. write-allocate와
  no-write-allocate는 어떤 workload에 맞나요?
difficulty: 중하
category: 성능
tags:
  - 캐시
  - write allocate
  - write-back
  - write-through
related:
  - cache-readonly-sharing-versus-writes
---
# 쓰기 miss에서 line을 먼저 읽어온 뒤 수정할지 바로 메모리에 쓸지 선택합니다. write-allocate와 no-write-allocate는 어떤 workload에 맞나요?

## 구두 답변

write-allocate는 store miss가 난 line을 cache로 가져온 뒤 그 안에서 수정하고, no-write-allocate는 miss line을 cache에 채우지 않고 하위 계층으로 store를 보냅니다. 선택은 write-through/write-back과 별개 축입니다. 전자는 miss line을 들일지, 후자는 cache에서 수정된 내용을 하위 계층에 언제 반영할지를 뜻하므로 네 조합을 따로 계산해야 합니다.

64B line에서 8B 값 네 개를 곧 연속해서 쓴다고 하겠습니다. write-allocate·write-back이면 첫 miss에서 기존 64B line을 fill한 뒤 첫 store가 dirty가 되고, 나머지 세 store는 같은 line의 hit가 됩니다. 나중에 eviction될 때 dirty 64B를 하위 계층에 보냅니다. 교육용 traffic만 세면 read 64B + write 64B가 발생하고, 네 번의 개별 하위 write를 피할 수 있습니다. 반대로 각 64B line에 8B 한 번만 쓰고 다시 읽지 않는 큰 streaming workload에서는 기존 64B를 읽어 오는 read-allocate가 재사용 없이 cache를 오염시킬 수 있습니다. no-write-allocate나 non-temporal 경로를 검토할 이유가 생깁니다.

write-through와 결합하면 allocate한 dirty line을 오래 보유하지 않고 store마다 하위 계층 traffic이 생길 수 있고, no-write-allocate·write-through는 miss store를 곧바로 아래로 보냅니다. write-back·no-write-allocate는 반복 재사용이 없을 때 fill을 피하지만, 같은 line의 두 번째 store가 다시 miss가 될 수 있습니다. 실제 bytes는 partial-write 병합, write-combining, coherence 소유권 획득, eviction 상태로 달라집니다. 따라서 store 수만 세지 말고 fill bytes, 하위 write bytes, dirty eviction, invalidate와 ownership traffic을 workload별로 기록해 판단합니다.

## 득점 포인트

- 반복 partial store와 일회성 streaming store의 fill·store·dirty eviction bytes를 교차 정책으로 셉니다.
- write-allocate/no-write-allocate를 write-through/write-back과 같은 선택지로 합칩니다.

## 감점 포인트

- 질문에 없는 일반론으로 결론을 흐리거나 모든 CPU·workload에 같은 규칙을 적용합니다.
- 중간 상태, 실패 조건, 성능·보안 비용을 생략해 결과만 단정합니다.

## 더 파고들 거리

- coherence ownership과 write-combining이 traffic을 바꾸는 두 코어 trace를 추가해 보세요.
- 입력 순서와 자원 조건을 바꿨을 때 어느 결론이 유지되고 어느 비용이 달라지는지 검증해 보세요.
