---
id: k8s-rolling-update-capacity
title: "Pod 4개를 운영하는 Deployment에서 maxSurge=1, maxUnavailable=1로 업데이트하면 실행 중인 Pod 수와 가용성은 어떻게 달라지나요?"
difficulty: 하
category: 인프라
tags: ["Kubernetes","Deployment","롤링 업데이트"]
related: ["k8s-probe-contract","k8s-pdb-eviction"]
---

# Pod 4개를 운영하는 Deployment에서 maxSurge=1, maxUnavailable=1로 업데이트하면 실행 중인 Pod 수와 가용성은 어떻게 달라지나요?

## 구두 답변

`maxSurge`는 업데이트 중 목표 replica 수를 넘겨 만들 수 있는 추가 Pod 수이고, `maxUnavailable`은 목표 replica 중 `Available` 상태가 아니어도 허용하는 수입니다. 예를 들어 목표가 4이고 두 값을 각각 1로 두면, 새 Pod를 하나 더 만들 수 있고 가용 Pod가 3개까지 내려가는 진행이 허용됩니다. 다만 종료 중인 기존 Pod는 아직 프로세스가 살아 있을 수 있어 실제 Pod 수가 잠시 목표 4+1을 넘을 수 있으므로, 5를 모든 순간의 절대 상한으로 해석하면 안 됩니다. 실제 순서는 readiness, 스케줄 가능 자원, Deployment 컨트롤러의 상태에 따라 달라지므로 “항상 새 Pod를 먼저 만든다”라고 단정하지 않습니다. 백분율 설정은 replica가 작을 때 반올림 규칙의 영향도 받습니다.

노드 여유가 없어 새 surge Pod가 `Pending`이어도, 현재 가용 Pod가 충분하면 `maxUnavailable=1` 범위에서 기존 Pod 하나를 먼저 줄여 공간을 만들고 rollout을 계속할 수 있습니다. 반대로 가용 Pod를 더 줄일 수 없거나 줄인 뒤 용량이 부족하면 진행이 멈춥니다. 남은 Pod에 요청이 몰릴 수 있고, readiness가 실제 의존성 준비 전에 성공하면 새 버전으로 트래픽이 유입됩니다. 따라서 replica 수만 보지 말고 Pod별 준비 시간, 한 Pod의 처리 용량, 노드 requests/limits, 배포 중 오류율과 지연을 함께 확인하겠습니다.

구버전과 신버전이 공존하는 동안에는 API(서비스 사이에서 주고받는 요청·응답 형식)와 이벤트·데이터 스키마가 양방향으로 호환돼야 합니다. 예를 들어 새 서버가 추가 필드를 보내더라도 구버전 서버가 모르는 필드를 무시할 수 있어야 합니다. rollout 완료는 애플리케이션 데이터 마이그레이션의 성공을 뜻하지 않으며, DB(데이터베이스) 변경은 별도 호환 단계와 복구 계획이 필요합니다. 새 코드가 아직 배포되지 않은 상태에서 필수 열을 바로 요구하면 구버전 Pod의 요청이 실패할 수 있습니다. 자원 부족과 느린 초기화에서 멈춤·rollback·재시작을 시험하고, 서비스의 무중단 목표와 허용 비용에 맞춰 두 값을 선택하겠습니다.

## 득점 포인트

- surge와 unavailable을 replica 4의 구체적 상태 변화로 설명한다.
- Pending·readiness·requests를 용량 판단과 연결한다.
- 혼합 버전 호환성과 DB 변경의 비자동 롤백을 분리한다.

## 감점 포인트

- maxSurge를 늘리면 자원이 없어도 새 Pod가 준비된다고 말한다.
- maxUnavailable을 단순히 종료 가능한 Pod 수로만 설명한다.
- rollout 완료를 데이터 호환 검증 완료로 해석한다.

## 더 파고들 거리

- maxSurge 백분율의 올림과 maxUnavailable 백분율의 내림이 작은 replica에서 어떻게 달라지나요?
- replica가 한 개인 서비스에서 두 값을 0으로 두지 않고 무중단을 달성하려면 어떤 전제가 필요한가요?
- readiness 지연과 progress deadline을 어떤 지표로 함께 판단할까요?
