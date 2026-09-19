---
id: game-matchmaking-team-rating
title: 팀 매칭에서 개인 rating 평균만 사용하는 것이 왜 위험할 수 있나요?
difficulty: 중하
category: 게임 서버
tags:
  - matchmaking
  - team balance
  - rating
related:
  - ranking-merge-dedup-tie-boundary
---
# 팀 매칭에서 개인 rating 평균만 사용하는 것이 왜 위험할 수 있나요?

## 구두 답변

팀 평균은 빠른 1차 필터일 뿐 최종 매칭 기준으로 충분하지 않습니다. 팀 A가 `1800+1200`, 팀 B가 `1500+1500`이면 둘 다 평균 1500이지만 A의 개인 편차는 600, B는 0입니다. 한 팀은 공격 역할이 1800에 고정되고 지원이 1200이라 조합 의존성이 커질 수 있으며, σ가 큰 player가 섞이면 평균만 같은 posterior도 실제 승률이 달라집니다. party 고정과 region ping까지 더하면 평균 하나는 더 많은 상태를 잃습니다.

후보 생성에서는 team size·필수 역할·party 분할·허용 ping을 hard constraint로 먼저 검사합니다. 그 뒤 팀 skill 중심, 팀 uncertainty, 팀 내 분산, 예상 승률 gap을 soft objective로 비교합니다. 예를 들어 `A=(1800±50,1200±50)`, `B=(1500±50,1500±50)`은 중심 평균은 같지만 분산이 다르므로 team quality 계산에 편차를 넣을 수 있습니다. 그러나 어떤 가중치가 정답인지 rating 모델이 자동으로 정하지 않으며, 역할 상호작용을 별도 feature로 검증해야 합니다.

후보를 고르는 동안 player가 이탈하면 claim 직전 lease와 queue generation을 원자적으로 재확인해 조합 전체를 폐기합니다. 모든 party 조합을 탐색하면 비용이 폭증하므로 후보 pool·CPU 예산·대칭 조합 제거를 둡니다. 실제 결과가 특정 역할 조합에서 계속 기울면 rating update와 역할 모델의 calibration을 cohort로 조사합니다. 이는 leaderboard top-K와도 다릅니다. top-K는 정렬된 순위 경계를 보존하지만 team matchmaking은 hard feasibility와 경기 quality를 동시에 만족해야 하므로 snapshot, 구성 ID, policy version을 함께 기록합니다.

## 득점 포인트

- 평균이 같은 1800+1200과 1500+1500의 반례를 설명한다.
- team uncertainty·편차·역할·party·latency를 hard/soft 조건으로 나눈다.
- search budget, snapshot version, 실제 outcome calibration을 연결한다.

## 감점 포인트

- 팀 평균이 같으면 expected win과 역할 난이도도 같다고 말한다.
- 모든 조합을 무제한 탐색해 품질을 해결한다고 주장한다.
- 개인 ranking top-K 병합과 team matchmaking을 같은 문제로 취급한다.

## 더 파고들 거리

- party가 고정된 경우 팀 간 비교와 party 내부 편차를 어떻게 표현할까요?
- 역할 변경이 rating posterior에 미치는 영향을 별도 rating으로 둘까요?
- 후보 계산 중 한 player가 이탈하면 조합을 원자적으로 폐기하는 방법은 무엇일까요?
