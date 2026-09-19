---
id: matchmaking-rating-uncertainty-queue-expansion
title: Matchmaking Rating 불확실성과 Queue 확장
topic: 게임 서버
summary: >-
  rating 평균뿐 아니라 불확실성을 함께 갱신하고, 대기 시간이 늘어날 때 탐색 범위를 단계적으로 확장해 품질과 starvation을 함께
  관리합니다.
questionIds: []
prerequisites:
  - ranking-entitlement
  - latency-capacity
related:
  - ranking-entitlement
  - top-k-ranking
  - bulkhead-fairness
reviewedAt: '2026-09-19'
---
# Matchmaking Rating 불확실성과 Queue 확장

매칭에서 rating 하나를 비교해 가장 가까운 상대를 고르는 것만으로는 신규·복귀 플레이어, 팀 조합, 지역 지연, 대기 시간의 변화를 설명하기 어렵습니다. 같은 평균 1500이라도 한 플레이어가 최근 몇 경기만 치러 skill 추정의 불확실성이 크고 다른 플레이어는 수백 경기로 안정된 상태일 수 있습니다. 이 노트는 Bayesian rating 계열에서 mean과 uncertainty를 분리해 다루고, 매칭 대기 시간이 길어질 때 검색 범위를 어떻게 넓히되 공정성·지연·악용 위험을 통제할지 설명합니다.

Microsoft Research의 TrueSkill 프로젝트 페이지는 skill을 단일 고정 점수가 아니라 불확실성을 가진 추정으로 다루는 출발점입니다. 특정 게임이 TrueSkill의 어느 변형, 초기 prior, update 상수, 팀 factor graph, queue policy를 사용하는지는 그 페이지에서 자동으로 결정되지 않습니다. 이 문서의 수식과 임계값은 설명용이며, 서비스에 적용할 값은 실제 match outcome과 운영 목표로 보정해야 합니다.

## Mean과 uncertainty의 의미

플레이어 상태를 `(μ, σ)`로 적겠습니다. `μ`는 예상 skill의 중심이고 `σ`는 아직 모르는 폭입니다. `μ=1500, σ=50`은 1500 부근이라는 추정이 비교적 안정됐다는 뜻이고, `μ=1500, σ=300`은 평균은 같아도 가능한 실력 범위가 넓다는 뜻입니다. σ가 크다고 그 플레이어가 강하다고 단정하는 것이 아니라, 관측이 부족하거나 오래되어 posterior가 불확실하다는 의미입니다.

매칭 quality는 단순한 `|μ_A-μ_B|`보다 μ와 σ를 이용한 match-quality 또는 정규화된 가상 무승부 확률 같은 기준으로 계산할 수 있습니다. 정보량을 최대화하는 목적이나 역할·지연 가중치는 classic rating의 정의가 아니라 서비스 정책으로 분리해야 합니다. 신규 플레이어를 안정된 1500과 기계적으로 같은 상대라고 처리하면 실제 경기 난이도가 크게 갈릴 수 있습니다. 반대로 σ를 너무 공격적으로 낮추면 몇 번의 운 좋은 결과가 실력 확정처럼 굳어지고, 신규 player의 provisional 상태가 사라지는 시점도 왜곡됩니다.

## 결과 갱신과 provisional 정책

경기가 끝나면 결과와 참가자 구성, 팀·역할, 연결 끊김·무효 판정 여부를 검증한 뒤 posterior를 갱신합니다. 기본적으로 결과가 들어오면 경쟁 상대에 대해 예상보다 좋은지 나쁜지에 따라 μ가 움직이고, 관측 정보가 쌓이면 σ가 줄어드는 방향입니다. 그러나 실제 rating 라이브러리의 update 수식은 변형별로 다르므로 여기서 특정 계수를 일반 규칙처럼 제시하지 않습니다.

신규 player에는 provisional flag와 경기 수·최소 표본을 별도로 저장할 수 있습니다. `μ=1500, σ=300`인 player는 `μ=1500, σ=50`과 같은 숫자만으로 큐에 넣지 않고, 선택한 신뢰수준에서 분포의 질량이 넓다는 점을 후보 점수에 반영하되 초반 결과의 영향을 제한하거나 calibrated update를 적용합니다. 복귀 player는 과거 μ를 유지하면서 σ를 일정 수준 다시 키우는 decay를 둘 수 있지만, “몇 일 지나면 정확히 얼마”라는 정책은 제품 계약으로 결정해야 합니다.

```diagram
{"title":"rating 불확실성을 품질·큐 정책과 함께 사용합니다","caption":"평균만으로 상대를 고르지 않고 uncertainty를 품질 계산에 넣습니다. 대기 시간이 늘어도 version이 붙은 widening 정책으로만 범위를 넓힙니다.","rows":[[{"id":"posterior","label":"player posterior","detail":["μ·σ·provisional"]}],[{"id":"quality","label":"match quality 계산","detail":["팀·지연·역할"]}],[{"id":"queue","label":"대기 queue","detail":["age·region"]}],[{"id":"widen","label":"단계적 범위 확장","detail":["정책 version"]}],[{"id":"result","label":"결과 검증·갱신","detail":["μ·σ update"]}]],"edges":[{"from":"posterior","to":"quality","label":"가능 범위"},{"from":"quality","to":"queue","label":"후보 부족"},{"from":"queue","to":"widen","label":"age threshold"},{"from":"widen","to":"result","label":"매칭·결과"},{"from":"result","to":"posterior","label":"posterior 갱신"}]}
```

## Queue widening의 이유와 단계

큐가 막히는 이유는 rating 차이만이 아닙니다. 지역·지연 제한, party 크기, 역할 조합, 플랫폼, 입력 장치, 파티의 고정 구성 등 hard constraint가 후보를 제거할 수 있습니다. 처음부터 모든 제약을 느슨하게 하면 품질을 낮추므로, 먼저 필수 조건을 분리하고 대기 age가 늘 때 어떤 조건을 어떤 순서로 완화할지 정합니다.

예를 들어 초기 0~10초에는 예상 skill 범위 ±50, 10~20초에는 ±100, 20초 이후에는 ±150으로 넓힌다는 정책을 생각해 볼 수 있습니다. 이는 설명용 예입니다. 각 단계에서 후보 수, 예상 승률 차이, 실제 match outcome, ping p95, 취소율을 기록하고 policy version을 match에 저장합니다. 평균 대기시간만 낮아졌다고 성공으로 보지 않고, 긴 대기 queue가 반복해서 낮은 quality match를 받는지까지 확인합니다.

widening은 monotonic하게 넓히되 상한을 둡니다. 매칭이 되지 않는다고 무한히 범위를 열면 초보자가 고숙련자와 계속 섞여 이탈하거나, 계정이 일부러 provisional 상태를 유지해 유리한 상대를 찾는 악용이 생길 수 있습니다. 상한에 도달하면 취소·다른 모드 안내·region 이동·봇/훈련 경기 같은 명시된 fallback을 사용합니다. 사용자에게는 “공정한 상대를 찾는 중”과 “완화된 조건으로 찾는 중”을 구분해 알려 줄 수 있습니다.

## 팀 매칭과 평균의 반례

두 명 팀 A가 1800과 1200, 팀 B가 1500과 1500이면 평균은 모두 1500입니다. 하지만 역할이 한 명에게 몰리거나, 1800 player가 공격 역할이고 1200 player가 지원 역할인 조합이면 실제 상호작용은 평균만으로 비교하기 어렵습니다. 팀 posterior의 평균, 분산, 팀 내 편차, 파티 고정, 역할 충족, 통신·지연 제약을 함께 계산해야 합니다.

팀 평가에서는 hard constraint와 soft objective를 나눕니다. 같은 team size·역할·region은 hard constraint로 거절할 수 있고, skill quality·σ 균형·기대 승률은 점수화해 후보를 비교할 수 있습니다. 후보 조합을 모두 시도하면 party 수가 늘수록 탐색 비용이 폭발하므로 queue에서 작은 후보 pool을 유지하고 시간·CPU 예산을 둡니다. 대칭 조합을 중복 계산하지 않는 것과, 후보를 임의로 잘라 공정한 조합을 놓치지 않는 것도 별도 검증 대상입니다.

## 악용과 관측

불확실성이 큰 player를 범위만 넓혀 아무 상대와 붙이면 smurf나 고의 패배·승리의 영향이 커집니다. 신규 계정의 인증·플랫폼 정책을 rating 계산과 혼동하지 말고, provisional match 수·결과 분포·비정상 탈주·신고·상대 숙련도 이동을 함께 관찰합니다. 팀 queue에서는 한 고숙련 player가 낮은 σ의 계정과 파티를 맺어 평균을 낮추는지, party 전체의 신뢰 범위를 어떻게 계산할지 계약해야 합니다.

모델이 예측한 win probability와 실제 결과의 calibration도 필요합니다. 평균 rating 차이가 작아도 실제 승률이 한쪽으로 크게 치우치면 update model, 역할 feature, 지연·disconnect 처리 중 무엇이 어긋났는지 조사합니다. 다만 한 경기의 결과는 확률적이므로 단일 match로 정책을 바꾸지 않고 충분한 cohort와 기간을 정합니다.

## 상태·버전·결정성

queue에 들어갈 때 rating snapshot version, widening policy version, region·latency 측정 시점, party 구성 ID를 저장하면 나중에 왜 매칭됐는지 재현할 수 있습니다. 서버 시계는 queue age 계산에 monotonic clock 또는 합의된 큐 tick을 사용하고, 벽시계 조정으로 대기 age가 뒤로 가지 않게 합니다. match 생성과 player 입장 사이에 rating이 바뀌면 snapshot을 유지할지 재평가할지 정합니다.

동시에 여러 match를 배정하면 같은 player가 중복 선택되지 않도록 reservation 또는 원자 queue claim이 필요합니다. rating update가 늦게 도착한 match를 현재 rating 위에 무조건 적용하면 결과 순서가 바뀔 수 있으므로 match sequence·시즌 버전·정정 정책을 둡니다. 랭킹 보상 cutoff와 실시간 matchmaking rating은 서로 다른 state machine이며, 경기 결과가 들어갔다고 시즌 보상 snapshot이 자동으로 다시 열려서는 안 됩니다.

## 비용·SLO·검증

widening 범위를 넓힐수록 후보 검색 비용, cross-region 통신, quality 계산량이 증가합니다. 팀 조합을 계산하는 동안 queue claim을 오래 잡으면 다른 player가 대기할 수 있으므로 후보 생성과 확정을 분리하고 만료된 후보를 다시 검증합니다. 결과적으로 매칭 SLO는 평균 wait 하나가 아니라 wait p50/p95, match quality, expected win gap, ping p95, cancel rate, queue별 starvation, solver CPU와 재시도율을 포함해야 합니다.

검증은 `μ=1500,σ=300`과 `μ=1500,σ=50`의 후보 선택, 0/10/20초 경계, 후보 부족, party 편차, region 장애, rating update 지연, queue claim 경합, policy version 변경을 포함합니다. 실제 TrueSkill 변형을 실행한 결과가 아니라 원리와 설명용 정책 예입니다. 테스트와 운영에서 사용하는 정확한 prior·sigma cap·widening 수치는 별도 승인하고 기록해야 합니다.

## 참고자료와 확인 범위

- Microsoft Research, “TrueSkill Ranking System”, https://www.microsoft.com/en-us/research/project/trueskill-ranking-system/ — 불확실성을 포함한 Bayesian skill rating과 team matching의 출발점. 프로젝트 페이지는 특정 서비스의 배포 변형·상수·queue widening 정책을 고정하지 않습니다.
- `notes/game/ranking-entitlement.md` — cutoff snapshot과 보상 권리를 실시간 매칭 rating과 구분했습니다.
- `notes/data-structures/top-k-ranking.md` 및 `questions/ranking-global-topk.md` — 전역 순위 후보 병합과 matchmaking quality의 차이를 확인했습니다.
- `notes/performance/latency-capacity.md` — 대기·처리량·분위수 예산을 함께 보는 기준으로 참고했습니다.

이 배치에서는 특정 rating SDK의 현재 버전, 서버별 prior, region 완화 정책을 확인하지 않았습니다. 따라서 “최신 TrueSkill 기본값”이나 실제 서비스 성능을 주장하지 않고, 제품별 정책을 source revision과 실험으로 결정해야 한다고 명시합니다.
