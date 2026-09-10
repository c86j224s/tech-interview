---
id: k8s-probe-contract
title: "초기화가 오래 걸리는 앱을 Kubernetes가 계속 재시작합니다. startup·readiness·liveness probe를 어떤 역할로 나눠야 하나요?"
answerMinutes: 5
followups: [{"id":"load-balancer-health-draining","prompt":"readiness가 실패한 뒤에도 로드밸런서의 기존 연결이 남아 있다면 endpoint 전파와 연결 드레이닝을 어떤 순서로 확인하겠습니까?"},{"id":"graceful-shutdown","prompt":"종료 신호와 liveness 실패가 동시에 발생했을 때 새 유입·기존 요청·DB 풀 정리를 어떤 우선순위로 실행하겠습니까?"},{"id":"k8s-hpa-scaling","prompt":"예열 중 Pod가 CPU를 많이 사용하지만 readiness는 아직 실패한 상태라면 HPA가 보는 지표와 실제 서비스 용량을 어떻게 해석하겠습니까?"}]
difficulty: 하
category: 인프라
tags: ["Kubernetes","probe","헬스 체크"]
related: ["load-balancer-health-draining"]
---

# 초기화가 오래 걸리는 앱을 Kubernetes가 계속 재시작합니다. startup·readiness·liveness probe를 어떤 역할로 나눠야 하나요?

## 구두 답변

startup, readiness, liveness probe는 이름이 비슷하지만 실패했을 때 Kubernetes가 취하는 행동이 다릅니다. startup은 프로세스가 초기화를 끝낼 시간을 판단하고, readiness는 지금 새 트래픽을 받아도 되는지를 판단하며, liveness는 재시작으로 회복할 수 있는 비정상 상태인지를 판단합니다. 초기화가 오래 걸리는 앱에 liveness를 너무 이르게 적용하면 정상 프로세스를 계속 재시작할 수 있으므로, 각각의 검사와 복구 행동을 분리하겠습니다.

예를 들어 서버가 시작할 때 큰 모델을 읽고 캐시를 예열하는 데 90초가 걸린다고 하겠습니다. startup probe가 성공하기 전에는 liveness와 readiness 검사가 본격적으로 실패 처리되지 않도록 구성해 이 시간을 허용할 수 있습니다. 초기화가 끝난 뒤 readiness가 성공해야 Service의 endpoint가 되고, liveness는 프로세스가 살아 있어도 내부 진행이 멈춘 경우에만 실패하도록 좁게 정의하겠습니다. DB가 잠깐 느리다는 이유로 프로세스를 재시작해도 DB 장애가 해결되지는 않으므로, DB 의존성을 liveness에 무조건 넣지 않겠습니다.

### 검사의 성공 조건을 계약으로 씁니다

readiness는 서버가 포트를 열었는지가 아니라 요청을 처리할 용량과 필수 의존성의 상태를 기준으로 해야 합니다. 소비자라면 브로커 연결과 메시지 처리 가능 여부, API라면 핵심 설정 로딩과 필요한 연결 풀 상태를 반영할 수 있습니다. 다만 readiness probe가 매번 비싼 DB 집계를 실행하면 health check 자체가 장애를 키울 수 있으므로, 빠르고 제한된 검사 또는 캐시된 상태를 사용하겠습니다. 선택적 추천 서비스가 잠깐 실패한다고 로그인 API 전체를 readiness 실패로 만들지도 않습니다. 기능의 필수·선택 경계를 계약으로 정합니다.

startup 실패는 초기화가 제한 시간 안에 끝나지 않았다는 신호이고, liveness 실패는 재시작이 회복책이라는 가정이 들어간 신호입니다. readiness 실패는 보통 endpoint에서 제외하는 조치이지 컨테이너를 종료하는 조치가 아닙니다. 따라서 readiness가 실패했다고 기존 TCP 연결의 진행 중 요청이 자동으로 모두 끝나거나 즉시 끊기는 것은 아닙니다. 종료할 때는 readiness를 먼저 실패시키고 endpoint 전파 지연을 기다린 뒤, `preStop`과 termination grace period 동안 진행 중 요청을 드레이닝하겠습니다.

### 주기와 임계값을 실제 시간으로 계산합니다

probe의 `periodSeconds`, `timeoutSeconds`, `failureThreshold`는 감지 지연과 재시작·재투입 시간을 만듭니다. 초기화 시간의 정상 분포보다 짧게 startup 제한을 잡으면 재시작 루프가 생기고, 반대로 liveness 실패 임계값을 지나치게 길게 두면 진짜 정지 상태를 오래 방치합니다. readiness가 순간적으로 흔들리면 모든 Pod가 동시에 endpoint에서 빠지지 않는지, 새 Pod가 준비되기 전에 롤링 업데이트가 다음 단계로 가지 않는지 확인하겠습니다. HTTP·TCP·exec·gRPC 검사는 보안 경계와 실행 비용도 다르므로 앱이 실제로 검증해야 하는 계약을 선택합니다.

테스트는 느린 초기화, DB 지연, 프로세스 교착, 종료 중 요청, probe endpoint 자체의 과부하를 각각 주입합니다. 기대 결과는 단순히 재시작 횟수가 아니라 정상 초기화 중에는 재시작하지 않고, 준비 전에는 새 endpoint가 되지 않으며, 복구 가능한 정지에서만 재시작하고, 종료 시 기존 요청이 허용된 시간 안에 정리되는지입니다. 이런 식으로 상태에 맞는 복구 행동을 연결하는 것을 **프로브 계약**(probe contract)이라고 부를 수 있습니다.

## 득점 포인트

- startup·readiness·liveness의 판정 목적과 실패 시 행동을 정확히 분리한다.
- 하위 장애를 무조건 liveness로 연결하지 않고 필수 의존성과 endpoint 제외를 구분한다.
- probe 시간 설정, readiness 전파 지연, 종료 드레이닝과 실제 테스트 결과를 연결한다.

## 감점 포인트

- 모든 probe를 같은 URL에 연결하고 실패하면 항상 재시작해야 한다고 말한다.
- readiness 실패가 기존 연결과 진행 중 요청을 자동으로 즉시 중단한다고 설명한다.
- 정상적으로 긴 초기화와 교착·복구 불가능 상태를 구별하지 않는다.

## 더 파고들 거리

- 비싼 DB 쿼리를 probe에 넣었을 때 발생할 연쇄 부하와 대체 상태 신호를 설명해 보세요.
- gRPC probe와 HTTP probe를 보안·타임아웃·실패 의미 기준으로 비교해 보세요.
- readiness가 자주 출렁일 때 임계값을 늘리기 전에 어떤 애플리케이션 원인을 측정할까요.
