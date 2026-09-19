---
id: game-snapshot-late-despawn
title: snapshot 간격은 같은데 네트워크 도착 간격이 흔들립니다. 보간 시각은 서버 timestamp와 도착 시각 중 무엇을 기준으로 하나요?
difficulty: 중하
category: 게임 서버
tags:
  - snapshot
  - spawn
  - despawn
  - timestamp
related:
  - aoi-interest-management
  - world-partition-handoff
---
# snapshot 간격은 같은데 네트워크 도착 간격이 흔들립니다. 보간 시각은 서버 timestamp와 도착 시각 중 무엇을 기준으로 하나요?

## 구두 답변

보간의 운동 시간은 서버 simulation timestamp를 기준으로 하고 arrival time은 수신 지연을 기록하는 보조 정보로만 사용합니다. 서버가 S10(t=1.000,x=10), S11(t=1.050,x=12)를 50ms 간격으로 만들었는데 도착 간격이 20ms와 80ms로 흔들려도 `t=1.025`의 위치는 11입니다. 도착한 두 packet을 sequence와 timestamp로 정렬하고, client clock을 estimated server clock으로 매핑한 뒤 delay를 뺀 render time을 bracket합니다. S12가 S11보다 먼저 와도 숫자가 최신이라는 이유만으로 lifecycle dependency를 건너뛰지 않습니다. 특히 S12가 S10의 full snapshot인지 S11 baseline을 요구하는 delta인지, spawn record가 먼저 설치됐는지를 확인합니다. despawn은 연속 위치가 아니라 event입니다. S12에 `destroy(42,g7,v12)`가 있으면 이전 위치와 다음 위치를 계속 섞지 않고 표시 entity를 제거하며 tombstone·generation으로 늦은 g7 update가 ghost를 만들지 못하게 합니다. 새 g8 spawn이 같은 ID를 쓰더라도 old epoch와 generation이 다르면 별도 객체입니다. 화면 buffer가 lifecycle의 권위를 갖는 것이 아니라 server registry와 공개 계약이 최종 결정합니다.


실제 구현에서는 render buffer에 위치 배열만 저장하지 말고 lifecycle marker와 적용 가능한 generation을 같은 sample 경계에 묶습니다. S11이 늦게 도착했을 때 이미 S12 destroy를 화면에 반영했다면, S11의 위치를 다시 삽입해 entity를 부활시키지 않습니다. 반대로 S12가 새 spawn을 포함하는 경우에는 create full state를 설치한 시점부터 새 segment를 열어 old despawn과 섞지 않습니다. 로그에는 server timestamp, arrival timestamp, sequence, lifecycle action을 함께 남겨 재현 가능한 순서로 분석합니다.
## 득점 포인트

- timestamp·arrival의 시간축을 이 질문의 20/80ms 흔들림과 x=11 계산으로 분리합니다.
- sequence뿐 아니라 delta baseline과 spawn 순서를 확인하고 destroy를 위치 보간에서 분리합니다.
- 늦은 g7 update와 새 g8 객체를 generation·epoch로 차단하는 흐름을 말합니다.

## 감점 포인트

- 도착 시각 사이를 이동 시간으로 사용해 jitter를 속도 변화로 그립니다.
- 최신 sequence만 보면 된다고 하면서 delta dependency와 spawn 설치를 생략합니다.
- destroy를 마지막 위치에서 서서히 사라지는 값으로만 처리해 ghost를 허용합니다.

## 더 파고들 거리

- server clock offset·drift 추정이 render bracket을 어떻게 흔드는지 관측 항목을 설계해 보세요.
- despawn을 놓친 재접속 client에 full AOI state와 tombstone 경계를 어떤 순서로 전할지 설명해 보세요.
