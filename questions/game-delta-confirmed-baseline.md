---
id: game-delta-confirmed-baseline
title: >-
  delta snapshot의 baseline을 “마지막으로 보낸 snapshot”이 아니라 “ACK된 snapshot”으로 잡아야 하는
  이유는 무엇인가요?
difficulty: 중하
category: 게임 서버
tags:
  - delta compression
  - baseline
  - ACK
related:
  - game-state-input-delivery-classes
---
# delta snapshot의 baseline을 “마지막으로 보낸 snapshot”이 아니라 “ACK된 snapshot”으로 잡아야 하는 이유는 무엇인가요?

## 구두 답변

핵심 조건은 ACK가 단순 packet 수신이 아니라 receiver가 canonical baseline을 검증하고 설치했다는 application-level 확인이며, 그 baseline에서 target을 직접 복원하는 delta 의미가 정의돼 있어야 한다는 점입니다. S8 설치 ACK를 받은 뒤 S10을 보냈지만 그 ACK가 유실되고 현재가 S12라면 receiver가 S10을 가진다는 증거는 없습니다. S10→S12를 보내면 source가 없어 decode할 수 없으므로 S8→S12 독립 delta 또는 full snapshot을 선택합니다. packet에는 baseId=S8, targetId=S12, schema/epoch를 넣고 sender는 S10을 pending으로 보관합니다. transport ACK만으로는 application state 설치를 보장하지 않으므로 두 신호를 분리합니다. receiver가 S10을 이미 설치했지만 ACK만 sender에서 사라진 경우에는 control exchange로 보유 baseline을 재확인할 수 있으나, 재확인도 age·bytes 상한 안에서 끝내야 합니다. baseline이 없을 때 0값이나 현재 state를 기본값으로 삼아 통과시키면 조용한 오염이 생깁니다. AOI에 새로 들어온 entity도 전역 S8 delta가 아니라 현재 generation의 full create로 시작해야 하며, 검증은 canonical state와 target snapshot을 비교합니다.


여기서 baseline ACK의 payload에는 단순 S8 숫자만 넣지 않고 connection, entity 공개 집합, schema version, generation을 포함해야 합니다. 같은 숫자의 S8이라도 AOI가 달라 공개 필드가 다르면 동일 source가 아닙니다. receiver가 S8을 설치한 뒤 재시작했다면 예전 ACK를 재사용하지 않고 새 session epoch에서 full handshake를 다시 수행합니다. 따라서 안전성은 ACK라는 단어 자체가 아니라 “이 연결이 이 canonical bytes를 지금 복원할 수 있다”는 증명에 달려 있습니다.
## 득점 포인트

- S8 ACK·S10 ACK 유실·S12 target trace로 confirmed와 pending을 구분합니다.
- application ACK와 transport ACK, 직접 복원 delta와 chained patch를 구별합니다.
- baseline 부재를 full/resync 경계로 처리하고 default fallback을 금지합니다.

## 감점 포인트

- 마지막 송신이 receiver 보유를 증명한다고 가정합니다.
- ACK 종류를 구분하지 않거나 S10이 없는 receiver에 S10→S12를 합쳐 적용합니다.
- 압축률을 복원 가능성보다 우선하고 baseline 부재를 0으로 초기화합니다.

## 더 파고들 거리

- receiver에는 S10이 있고 sender만 ACK를 잃은 경우 handshake가 어떤 증거를 교환해야 하는지 설계해 보세요.
- entity별 baseline과 connection 전체 baseline의 memory·AOI 공개 비용을 비교해 보세요.
