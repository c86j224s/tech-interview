---
id: game-float-state-hash-divergence
title: lockstep replay에서 상태 hash가 처음 달라진 tick을 찾을 때 무엇을 기록하나요?
difficulty: 중하
category: 게임 서버
tags:
  - lockstep
  - replay
  - 상태 hash
related:
  - client-prediction-input-replay
---
# lockstep replay에서 상태 hash가 처음 달라진 tick을 찾을 때 무엇을 기록하나요?

## 구두 답변

최종 hash만 남기지 말고 tick 입력, 규칙·빌드 식별자, RNG stream state와 canonical state hash를 기록합니다. tick 420 전체 hash가 다르면 movement, combat, inventory, RNG 순으로 subsystem hash를 비교해 movement가 419부터 달랐는지 찾습니다. 그 안에서 entity ID 순으로 position, velocity, input, branch 결과를 비교하면 원인을 field 단위로 좁힐 수 있습니다. canonical serialization에는 entity/component 정렬, map 순서, endian, float bit 표현과 presentation-only 제외 규칙을 명시합니다.

hash가 같아도 저장하지 않은 gameplay field나 DB 지급·이벤트 중복은 보장하지 않습니다. 외부 효과는 idempotency key와 command trace를 별도로 기록합니다. 운영 비용은 매 tick 전체 dump 대신 전체·subsystem hash와 ring buffer를 두고 divergence 감지 구간만 raw field trace로 승격합니다. hash collision과 누락 필드 때문에 분석 구간에서는 hash를 증거의 전부로 취급하지 않습니다.

실제 비교에서는 양쪽 실행의 로그를 같은 tick·entity 키로 join하고 첫 mismatch의 입력과 직전 상태를 함께 봅니다. hash가 다른 subsystem을 찾았더라도 serializer 버그일 수 있으므로 동일 logical state가 다른 map 순서로 직렬화되지 않는지 별도 테스트합니다. 이 과정을 거쳐야 hash 불일치 자체를 원인으로 오인하지 않습니다.

 기록 포맷은 진단 자체가 새로운 비결정성을 만들지 않도록 byte order와 버전도 포함해야 합니다. 양쪽 로그를 같은 스키마로 읽은 뒤 첫 mismatch 주변의 직전 tick을 재실행하면 serializer 차이, 입력 차이, 실제 계산 차이를 세 갈래로 나눌 수 있습니다.

## 득점 포인트

- 입력·RNG·빌드 식별자와 subsystem별 hash로 첫 불일치를 좁힙니다.
- 직렬화 차이와 실제 상태 차이를 원시 필드 비교로 구분합니다.

## 감점 포인트

- hash가 같다는 이유로 누락 필드와 외부 부작용도 같다고 합니다.
- 마지막 불일치 틱만 조사하고 앞선 divergence를 놓칩니다.

## 더 파고들 거리

- 비싼 원시 상태 dump를 제한하면서 첫 불일치 전후를 어떻게 보존하나요?
- 서로 다른 스키마의 replay 비교는 어떤 변환 뒤에 가능하나요?
