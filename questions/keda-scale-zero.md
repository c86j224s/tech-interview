---
id: keda-scale-zero
title: "KEDA로 consumer Deployment를 0 replica까지 줄였다가 첫 메시지를 처리할 때 지연은 어디에서 생기나요?"
difficulty: 중하
category: 인프라
tags: ["KEDA","scale to zero","콜드 스타트"]
related: ["keda-hpa-role","k8s-hpa-scaling"]
---

# KEDA로 consumer Deployment를 0 replica까지 줄였다가 첫 메시지를 처리할 때 지연은 어디에서 생기나요?

## 구두 답변

Pod가 0개이면 새 이벤트를 감지한 뒤 확장기가 활성화되고, replica 생성·스케줄링·노드 공급·이미지 다운로드·초기화·readiness를 거쳐야 첫 메시지를 처리할 수 있습니다. 이를 cold start(유휴 상태에서 첫 작업을 시작하기까지의 지연)라고 하며, polling interval 하나가 아니라 `감지 + Pod/노드 준비 + 애플리케이션 초기화`의 합입니다. 수 초의 지연을 허용하는 비동기 작업과 즉시 응답 API의 정책은 달라야 합니다.

노드도 scale-to-zero라면 Pod를 늘리는 것만으로는 실행되지 않으므로 Karpenter나 다른 node autoscaler의 준비 시간을 포함해 측정하겠습니다. 첫 이벤트가 큐에 남아 있는 시점부터 실제 외부 효과가 커밋되는 시점까지를 기록하고, 최소 replica를 둘지, warm pool(미리 준비한 실행 용량)을 둘지, pre-pull(이미지를 미리 내려받기)을 할지 비용 대비 필요한지 비교합니다. 초기화 중 readiness(새 요청을 받을 준비 상태)가 너무 빨리 성공하면 실제 처리 실패가 cold start 뒤에 숨을 수 있습니다. 예를 들어 프로세스는 떴지만 소비 연결이 아직 없는데 준비 성공을 반환하면 첫 메시지가 오류로 끝날 수 있습니다.

버스트가 짧은 간격으로 반복되면 scale down과 재기동이 출렁일 수 있어 cooldown과 stabilization window, minReplica를 함께 정합니다. scaler 메트릭 접근이 실패하면 작업이 쌓여도 활성화되지 않을 수 있으므로 경보와 fallback을 둡니다. 긴 유휴 뒤 단일 메시지, 반복 버스트, 노드 공급 지연, 메트릭 장애를 각각 시험해 비용 절감과 첫 처리 지연·재처리·회복 실패를 함께 판단하겠습니다.

## 득점 포인트

- cold start를 감지부터 업무 커밋까지의 단계 합으로 설명한다.
- Pod와 node scale-to-zero를 구분한다.
- 출렁임·메트릭 장애·warm capacity의 비용을 검증 대상으로 삼는다.

## 감점 포인트

- 0에서 첫 처리가 즉시 시작된다고 말한다.
- polling interval만 cold start 시간으로 계산한다.
- 실시간 요청과 비동기 작업에 같은 scale-to-zero 정책을 적용한다.

## 더 파고들 거리

- 대기 메시지와 처리 중 메시지를 분리한 지표라면 scale-down 조건을 어떻게 바꿀까요?
- 노드 공급이 느릴 때 warm Pod와 warm node 중 무엇을 유지할지 어떤 기준으로 정할까요?
- ScaledJob의 긴 작업은 scale-down과 종료 유예를 Deployment consumer와 어떻게 다르게 다뤄야 하나요?
