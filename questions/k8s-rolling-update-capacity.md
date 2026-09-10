---
id: k8s-rolling-update-capacity
title: "Pod 4개를 운영하는 Deployment에서 maxSurge=1, maxUnavailable=1로 업데이트하면 실행 중인 Pod 수와 가용성은 어떻게 달라지나요?"
answerMinutes: 5
followups: [{"id":"k8s-probe-contract","prompt":"새 Pod가 프로세스는 실행 중이지만 DB migration을 기다리는 동안 readiness를 어떻게 설계해야 rollout이 잘못 진행되지 않을까요?"},{"id":"argocd-sync-waves-hooks","prompt":"구버전 Pod가 남아 있는 동안 DB 스키마를 바꿔야 한다면 Deployment rollout과 migration hook의 순서를 어떻게 조합하겠습니까?"},{"id":"k8s-pdb-eviction","prompt":"롤링 업데이트의 maxUnavailable과 별도로 노드 drain이 시작되면 PDB가 실제 중단 가능성을 어떻게 바꿀까요?"}]
difficulty: 하
category: 인프라
tags: ["Kubernetes","Deployment","롤링 업데이트"]
related: ["k8s-probe-contract","k8s-pdb-eviction"]
---

# Pod 4개를 운영하는 Deployment에서 maxSurge=1, maxUnavailable=1로 업데이트하면 실행 중인 Pod 수와 가용성은 어떻게 달라지나요?

## 구두 답변

목표 replica가 4이고 `maxSurge=1`, `maxUnavailable=1`이면 업데이트 중 새 버전 Pod를 목표보다 최대 하나 더 만들 수 있고, Available Pod는 목표보다 하나 적은 3개까지 허용됩니다. 따라서 정상적으로는 새 Pod를 하나 생성해 Ready가 된 뒤 기존 Pod를 줄이는 흐름이 가능하지만, 실제 순서는 스케줄 자원·readiness·현재 상태에 따라 달라집니다. 종료 중인 기존 Pod는 프로세스가 아직 살아 있을 수 있으므로 5가 모든 순간의 총 프로세스 수 절대 상한이라고 해석하면 안 됩니다.

`maxSurge`는 업데이트 중 추가로 허용할 수 있는 Pod 수이고, `maxUnavailable`은 목표 replica 중 Available이 아니어도 진행할 수 있는 여유입니다. 새 Pod가 Pending이라도 현재 Available이 4라면 기존 하나를 먼저 줄여 자리를 만들 수 있고, 그 뒤 Available이 3이 된 상태에서 새 Pod가 계속 준비되지 않으면 더 진행하지 못할 수 있습니다. 반대로 새 Pod가 준비되고 기존 Pod 하나를 내보내는 과정에서 actual Pod count는 생성·삭제·종료 시점에 따라 잠시 달라집니다.

### 숫자를 실제 용량으로 번역합니다

replica가 4에서 5로 보이는 순간에도 새 Pod가 이미지 다운로드 중이면 처리 용량은 4 또는 그보다 작을 수 있습니다. readiness가 실제 DB 연결·캐시 로딩·의존 서비스 준비 전에 성공하면 새 버전으로 트래픽이 유입되어 rollout이 형식상 진행돼도 오류가 날 수 있습니다. 반대로 노드에 requests를 수용할 여유가 없으면 surge Pod가 Pending으로 남고, `maxUnavailable=1`도 기존 용량을 줄일 수 있는 범위일 뿐 새 자원을 만들어 주지 않습니다. Pod별 처리량, requests·limits, 노드 여유, Ready까지의 시간, 업데이트 중 p95 지연과 오류율을 함께 측정하겠습니다.

백분율 설정은 작은 replica에서 반올림 규칙의 영향을 받습니다. maxSurge의 비율은 올림, maxUnavailable의 비율은 내림으로 계산합니다. 예를 들어 3개에 각각 25%를 지정하면 surge는 1개, unavailable은 0개가 됩니다. 실제 Deployment status와 이벤트로 계산 결과를 확인하고, 숫자를 머릿속으로만 단정하지 않겠습니다.

### 혼합 버전과 DB 계약을 포함합니다

롤링 업데이트 중 구버전과 신버전이 함께 서비스되므로 API·이벤트·데이터 스키마가 양방향으로 호환돼야 합니다. 신버전이 새 필드를 보내면 구버전이 모르는 필드를 무시할 수 있어야 하고, 신버전이 새 DB 컬럼을 필수로 읽기 전에 컬럼이 먼저 존재해야 합니다. 신버전이 데이터 형식을 파괴적으로 바꾸면 Pod 교체 순서만으로는 안전하지 않습니다. DB 변경은 확장·백필·읽기 전환·축소의 별도 단계로 두고, 앱 rollback이 DB 변경까지 되돌리지 않는다는 전제를 갖겠습니다.

검증에서는 노드 여유가 없는 상황, 새 Pod readiness 지연, 초기화 실패, 기존 Pod 드레이닝, 구·신 버전 동시 요청, progress deadline 초과를 재현합니다. replica 수가 잠깐 5였다는 사실보다 Available 용량이 유지됐는지, 새 버전으로 유입된 요청이 정상 처리됐는지, 실패 시 어느 revision에서 멈췄는지가 성공 기준입니다. 이처럼 업데이트 중 추가 생성과 허용 가능한 가용성 감소를 조절하는 설정을 **롤링 업데이트 예산**(rolling update budget)이라고 부릅니다.

## 득점 포인트

- replica 4에서 maxSurge·maxUnavailable이 추가 생성과 Available 감소에 미치는 효과를 구체적으로 계산한다.
- Pending·readiness·requests와 실제 처리 용량을 연결하고 총 Pod 수를 절대 상한으로 오해하지 않는다.
- 혼합 버전 호환성과 DB migration의 비자동 rollback을 rollout 정책과 분리한다.

## 감점 포인트

- maxSurge=1이면 언제나 새 Pod가 먼저 Ready가 된다고 단정한다.
- maxUnavailable을 단순히 종료할 수 있는 Pod 수로만 설명한다.
- rollout 완료가 데이터 스키마 호환과 사용자 기능 검증까지 끝났다는 뜻이라고 말한다.

## 더 파고들 거리

- 작은 replica에서 maxSurge와 maxUnavailable 백분율의 올림·내림이 어떤 차이를 만드는지 계산해 보세요.
- replica가 하나인 서비스에서 무중단 교체를 하려면 자원·readiness·호환성에 어떤 전제가 필요한가요.
- readiness 지연과 progress deadline을 실제 이벤트·지연·오류 지표로 어떻게 함께 판단할까요.
