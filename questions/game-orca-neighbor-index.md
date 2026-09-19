---
id: game-orca-neighbor-index
title: ORCA neighbor를 모두 검사하지 않고 공간 후보 index로 줄일 때 어떤 보수성을 지켜야 하나요?
difficulty: 중하
category: 게임 서버
tags:
  - ORCA
  - spatial index
  - neighbor
related:
  - spatial-hash-grid
---
# ORCA neighbor를 모두 검사하지 않고 공간 후보 index로 줄일 때 어떤 보수성을 지켜야 하나요?

## 구두 답변

보수성의 기준은 “현재 일정 거리 안”이 아니라 선택한 horizon 동안 충돌할 수 있는 모든 agent를 포함하는 것입니다. 두 원형 agent의 반경 합을 `R`, 최대 속도의 합을 `S`, horizon을 `τ`라고 하면 등속 상계는 `R+Sτ`입니다. 설명용 상태에서 현재 중심 거리가 5m, `R=1m`, `S=4m/s`, `τ=1s`이면 경계 접촉까지 필요한 이동 여유가 4m이므로 5m 범위를 조회해야 합니다. 현재 2m만 읽으면 solver에는 상대가 존재하지 않는 것과 같습니다.

구현 trace는 `query cells → 후보 ID+generation dedup → snapshot 검증 → ORCA constraint 생성 → 적용 직전 재검증`으로 나눕니다. 큰 agent가 여러 grid cell에 등록되어도 방문 집합으로 한 번만 constraint를 만들고, hash bucket 충돌을 같은 cell로 오해하지 않습니다. bounded-speed 모델이면 `R+Sτ`로 충분할 수 있지만 가속·회전·곡선 운동을 허용하면 acceleration bound와 swept AABB 또는 캡슐을 사용해 더 넓은 영역을 계산해야 합니다. 후보를 임의로 상위 32개만 남기는 cap은 가장 가까운 후보를 보존한다는 증명이나 overflow 경로가 없으면 false negative를 만들 수 있습니다.

false positive는 후보와 solver 제약이 늘어나는 비용이고, false negative는 local solver가 복구할 수 없는 안전성 실패입니다. 따라서 index snapshot tick과 agent state snapshot을 함께 읽고, query 이후 agent가 삭제·이동했으면 generation을 확인합니다. 적용 직전 실제 위치와 예약을 다시 읽어 stale 후보를 제거하되, 그것이 누락된 후보를 정당화하지는 않습니다. p99 후보 수, dedup 수, false-negative 장면의 재현율을 별도 지표로 두고, horizon·속도·가속 경계에서 전수 기준과 비교합니다.

## 득점 포인트

- query 범위를 현재 거리보다 horizon과 상대 최대 이동량에 연결한다.
- false positive는 비용이고 false negative는 안전성 실패라는 비대칭을 설명한다.
- swept bound, 다중 cell dedup, tick snapshot, generation 재검증을 함께 말한다.

## 감점 포인트

- 현재 반경만 조회해도 ORCA가 나머지를 예측한다고 말한다.
- spatial hash bucket 충돌을 같은 공간 cell로 오해한다.
- 후보 수를 임의로 잘라 성능을 올리는 것을 보수적 최적화라고 부른다.

## 더 파고들 거리

- agent의 가속·회전 상한을 후보 bound에 어떻게 반영할까요?
- index 전환 중 old/new 구조를 동시에 읽을 때 중복과 lifetime을 어떻게 보호할까요?
- 후보 p99와 false negative 검출을 어떤 기준 장면으로 함께 시험할까요?
