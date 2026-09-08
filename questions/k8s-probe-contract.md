---
id: k8s-probe-contract
title: "초기화가 오래 걸리는 앱을 Kubernetes가 계속 재시작합니다. startup·readiness·liveness probe를 어떤 역할로 나눠야 하나요?"
difficulty: 하
category: 인프라
tags: ["Kubernetes","probe","헬스 체크"]
related: ["load-balancer-health-draining"]
---

# 초기화가 오래 걸리는 앱을 Kubernetes가 계속 재시작합니다. startup·readiness·liveness probe를 어떤 역할로 나눠야 하나요?

## 구두 답변

startup은 초기화가 끝났는지, readiness는 새 요청을 받을 준비가 됐는지, liveness는 재시작으로 회복할 수 있는 비정상 상태인지 판단하는 데 사용합니다. 같은 URL을 모두 연결하면 역할 차이를 놓쳐 불필요한 재시작이 생길 수 있습니다.

probe는 Kubernetes가 컨테이너의 상태를 확인하는 검사입니다. liveness 실패는 재시작으로 연결될 수 있지만 readiness 실패는 보통 새 트래픽을 받을 대상에서 제외하는 의미입니다. startup probe가 설정돼 있으면 성공할 때까지 다른 두 검사를 시작하지 않아, 정상적으로 오래 걸리는 초기화를 장애로 오해하지 않게 도울 수 있습니다.

초기 캐시 로딩이 긴 서버라면 startup probe로 시작 시간을 허용하고 그동안 liveness가 조기 종료하지 않게 하겠습니다. DB가 잠깐 느리다고 프로세스를 재시작해도 도움이 없다면 liveness에 그 의존성을 넣지 않겠습니다. 반대로 초기화가 끝나지 않았거나 종료 중이면 살아 있어도 readiness를 실패시켜 유입을 줄여야 합니다.

readiness 실패는 기존 연결의 진행 중 요청을 자동으로 모두 끝내는 것이 아닙니다. 종료는 드레이닝과 제한 시간을 별도로 둬야 합니다. 저는 probe 주기와 실패 임계값이 실제 장애 감지·복구 시간을 어떻게 만드는지 확인하고, 상태가 출렁일 때 모든 Pod가 동시에 빠지지 않는지 테스트하겠습니다. 중요한 것은 체크를 많이 하는 것이 아니라 각 실패에 맞는 복구 행동을 선택하는 것입니다.

## 득점 포인트

- 검사별 복구 행동을 구분한다.
- 느린 초기화와 하위 장애를 다르게 처리한다.
- readiness와 기존 연결 종료를 분리한다.

## 감점 포인트

- 모든 하위 장애를 liveness 실패로 만든다.
- readiness 실패면 모든 요청이 즉시 중단된다고 말한다.
- startup과 liveness 시간을 무관하게 설정한다.

## 더 파고들 거리

- probe 자체가 비싼 쿼리를 실행하면 어떤 연쇄 부하가 생길까요?
- gRPC와 HTTP probe는 보안·타임아웃 설정에서 무엇을 확인할까요?
- readiness가 자주 흔들릴 때 임계값과 실제 원인을 어떻게 나눠 조정할까요?
