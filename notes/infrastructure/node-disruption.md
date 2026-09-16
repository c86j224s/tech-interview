---
id: node-disruption
title: Karpenter Consolidation·Drift와 세션 중단 비용
topic: 인프라
summary: 빈 노드 정리와 실행 Pod 재배치를 구분하고 consolidateAfter·drift 목적·PDB·보호 예외·장기 세션·보안 업데이트의 절충을 설명합니다.
questionIds: [karpenter-consolidation, karpenter-consolidate-after-churn, karpenter-drift-versus-consolidation, karpenter-session-disruption-policy]
---

# Karpenter Consolidation·Drift와 세션 중단 비용

## 사용률이 낮다고 실행 중인 Pod를 지워도 되는 것은 아닙니다

두 노드의 workload가 한 노드에 들어갈 수 있다면 consolidation으로 더 적은 노드나 적합한 저비용 용량으로 재배치할 수 있습니다. 빈 노드만 지우는 것과 달리 실행 중 Pod의 eviction·재시작·이미지·캐시 예열·연결 재수립이 발생할 수 있습니다.

스케줄링상 옮길 수 있다는 것과 게임 세션·처리 중 결제·로컬 파일이 안전하게 이어진다는 것은 다릅니다. 앱의 메모리 상태를 Karpenter가 자동 이전하지 않습니다.

## 통합과 Drift 교체는 다른 목적입니다

| 사건 | 목적 | 함께 볼 조건 |
| --- | --- | --- |
| 빈 노드 정리 | 불필요한 유휴 용량 제거 | system workload·비용 |
| consolidation | 배치·용량·가격 효율 | 재배치 가능성·준비 지연·중단 예산 |
| drift 교체 | 원하는 node 구성과 실제 차이 해소 | 이미지·구성·보안 업데이트·보호 범위 |
| 강제 장애·interruption | 이미 또는 곧 사라질 용량 복구 | 알림 없는 손실·대체 용량 |

예를 들어 consolidation 후보가 사라지거나 drift 교체가 멈췄다면, 먼저 사용 중인 Karpenter 버전의 계약에서 NodePool disruption budget·정책·보호 annotation·grace 설정이 해당 원인에 어떻게 적용되는지 나누어 확인합니다. 이어서 실제 NodeClaim의 `reason`과 이벤트를 대조해 원인이 consolidation·drift·만료·Spot 회수 중 무엇인지 확인합니다.

`consolidateAfter` 하나가 drift·만료·Spot 회수까지 모두 같은 방식으로 막는다고 가정하지 않고, 그 대기 동작도 버전별 정책 계약으로 확인합니다.

## 대체 배치와 실제 준비 시간을 확인합니다

Pod requests·affinity·topology·PDB·PVC zone·local storage와 대체 노드 capacity를 같이 검사합니다. 신규 용량을 먼저 준비하는지, 기존 노드의 여유로 이동 가능한지, 대체 준비 중 다른 수요가 그 자리를 소비할 수 있는지 살핍니다. 앱의 readiness가 부실하면 형식적인 이동 완료 뒤 사용자 오류가 생깁니다.

```diagram
{"title":"이동 가능성 계산 뒤에도 앱 복구가 필요합니다","caption":"화살표는 정상 자발적 교체의 개념적 경로입니다. 실제 세부 순서는 정책·버전에 따르며 스케줄 적합성이 메모리 세션 이전을 보장하지 않습니다.","rows":[[{"id":"candidate","label":"통합·drift 후보 선택"}],[{"id":"capacity","label":"대체 배치·용량 확인"}],[{"id":"drain","label":"예산 안 eviction·앱 drain"}],[{"id":"ready","label":"재시작·Ready·연결 복구"}]],"edges":[{"from":"candidate","to":"capacity","label":"제약·정책 검사"},{"from":"capacity","to":"drain","label":"허용된 중단"},{"from":"drain","to":"ready","label":"앱 수명 계약"}]}
```

PDB는 지원 eviction의 동시 중단을 조절하지만 노드 손실을 막거나 모든 앱 상태를 복구하지는 않습니다. 지나치게 엄격하면 유지보수가 막힐 수 있고 너무 느슨하면 여러 준비 용량이 한 번에 줄 수 있습니다. 제약 때문에 멈췄다면 이유와 실제 요구를 확인하지 않고 무조건 해제하지 않습니다.

## ConsolidateAfter는 유휴 비용과 반복 예열 비용의 절충입니다

`consolidateAfter`를 짧게 잡고 노드가 통합 조건을 만족하면, 짧은 burst가 끝난 뒤 통합 대상으로 검토될 수 있습니다. 다음 burst에서 다시 노드를 늘리면 부팅·이미지·캐시·rebalance 비용이 반복됩니다. 값을 늘리면 이런 churn을 줄일 수 있지만 수요가 없는 동안 유휴 노드 비용을 더 냅니다. 따라서 부하 주기와 예열 시간을 비용·p99와 함께 비교하고, 대기 타이머가 어떤 변화에서 시작·초기화되는지는 사용 중인 Karpenter 버전의 정책 계약과 실제 이벤트로 확인합니다.

비교 지표는 시간당 인프라 비용뿐 아니라 재스케줄 수·노드 Ready 시간·앱 예열·p99·오류·메시지 재처리량입니다. 부하 주기와 캐시 재생 비용을 함께 측정해 적절한 대기와 최소 용량을 정합니다.

## 장기 세션 보호에는 만료와 강제 장애 복구가 필요합니다

게임 세션이 끝날 때까지 자발적 교체를 줄이는 보호를 둘 수 있습니다. 그러나 보호를 무기한 유지하면 노드 보안 업데이트·비용·운영 교체가 막힐 수 있으므로 최대 세션 수명·보호 만료·운영 책임을 정합니다. 보호 annotation의 적용 원인과 예외를 실제 버전에서 확인합니다.

강제 손실은 언제든 가능하므로 주기 snapshot·입력 로그·재접속·owner 세대 전환·멱등 보상을 원래부터 설계해야 합니다. 새 Pod가 같은 IP나 이름을 얻는 것만으로 메모리 상태가 이어지지 않습니다. 큐 소비는 새 fetch를 멈추고 실제 효과 확정 후 ACK하거나 재전달 가능하게 종료합니다.

## 자발적 교체와 알림 없는 장애를 따로 시험합니다

테스트 노드의 낮은 부하·반복 burst·drift 변경·PDB 차단·장기 세션 보호를 나눠 봅니다. 이후 별도 강제 손실 시나리오에서 재접속·checkpoint·중복 효과를 확인합니다. 비용 절감이 사용자 실패·복구 비용을 늘리지 않았는지 전체로 판단합니다.

현재 작업에서 Karpenter 노드 통합·교체를 실행하지 않았습니다. 본문은 정책 목적과 앱 수명 비용을 설명하며 실제 비용 절감·무중단 검증 결과가 아닙니다.
