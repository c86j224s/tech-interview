---
id: karpenter-consolidation
title: "Karpenter로 사용률이 낮은 노드를 줄이려는데 그 위에 Pod가 실행 중입니다. consolidation은 어떤 이동을 일으키며 중단과 재배치를 어떻게 대비하나요?"
answerMinutes: 5
followups: [{"id":"k8s-pdb-eviction","prompt":"PDB 때문에 consolidation eviction이 계속 거절될 때 가용성 보호와 노드 교체 진행성을 어떤 지표와 승인 기준으로 조정하겠습니까?"},{"id":"karpenter-node-provisioning","prompt":"consolidation으로 Pod를 옮길 대체 노드가 필요할 때 NodePool 제약과 실제 Node Ready까지의 시간을 어떻게 검증하겠습니까?"},{"id":"k8s-rolling-update-capacity","prompt":"consolidation과 롤링 업데이트가 동시에 실행되면 surge·unavailable 용량을 어떻게 계산해 피크 직전의 과도한 중단을 막겠습니까?"}]
difficulty: 중하
category: 인프라
tags: ["Karpenter","consolidation","비용"]
related: ["k8s-pdb-eviction"]
---

# Karpenter로 사용률이 낮은 노드를 줄이려는데 그 위에 Pod가 실행 중입니다. consolidation은 어떤 이동을 일으키며 중단과 재배치를 어떻게 대비하나요?

## 구두 답변

빈 노드를 삭제하는 것은 실행 중인 Pod가 없는 노드를 정리하는 단순한 작업입니다. Karpenter의 consolidation은 더 나아가 실행 중인 Pod를 다른 노드로 옮길 수 있는지 계산하고, 더 적은 노드나 더 저렴하고 적합한 용량으로 교체해 낭비를 줄이는 최적화입니다. 따라서 사용률이 낮다는 이유만으로 단순 종료라고 생각하면 안 됩니다. eviction, 새 노드 부팅, 스케줄링, 이미지 다운로드, 캐시 예열이 사용자 지연과 오류를 만들 수 있습니다.

예를 들어 두 노드 중 하나의 API Pod를 다른 노드에 재배치하면 비용은 줄어도 기존 연결이 끊기고 readiness 대기 시간이 생길 수 있습니다. 큰 캐시나 로컬 임시 파일을 가진 Pod는 재배치 비용이 더 크고, 장기 게임 세션은 메모리 상태를 새 Pod로 자동 이전하지 못합니다. Karpenter가 이동 가능하다고 판단하는 것은 스케줄 제약을 만족할 수 있다는 뜻이지, 애플리케이션 세션과 외부 효과가 안전하게 이어진다는 뜻은 아닙니다.

### 이동 가능성과 중단 가능성을 함께 계산합니다

NodePool의 인스턴스 유형·가용 영역·taint·capacity type·비용 조건, Pod의 requests·affinity·topology spread·PDB·local storage 사용 여부를 확인하겠습니다. 대상 Pod가 다른 노드에 들어갈 자리가 있는지, 새 노드를 먼저 만들지 기존 노드로 재배치할지, 재배치 중 최소 가용 용량이 유지되는지 봅니다. PDB는 자발적 eviction 동시 중단을 제한할 수 있지만, 모든 consolidation이나 모든 장애를 안전하게 만드는 보장은 아닙니다. PDB가 지나치게 엄격하면 비용 최적화와 노드 교체가 멈추고, 너무 느슨하면 여러 API Pod가 동시에 빠질 수 있습니다.

애플리케이션은 종료 신호를 받았을 때 readiness를 먼저 실패시키고 진행 중 요청을 드레이닝해야 합니다. 큐 소비자라면 새 메시지를 받지 않고 처리 중인 메시지를 ACK할지 재전달할지 결정해야 하며, 세션 서버라면 상태 저장·재접속·소유권 이전을 별도로 제공해야 합니다. `terminationGracePeriod`가 짧으면 graceful shutdown을 믿고 있어도 작업이 잘릴 수 있습니다.

### 비용 최적화의 성공 기준을 넓힙니다

노드 수와 시간당 비용만 보면 잘못된 최적화를 성공으로 기록할 수 있습니다. consolidation 전후의 eviction 거절 수, 새 노드 Ready 시간, Pod 스케줄 대기, 이미지·캐시 예열 시간, 연결 재수립, p95/p99 지연, 요청 오류율, 메시지 중복·유실, 비용 절감액을 함께 보겠습니다. 부하가 낮아졌다가 곧 피크로 돌아오는 패턴에서 노드를 계속 줄였다 늘리면 **통합 진동**(consolidation oscillation)이 생기므로 `consolidateAfter`, scale 정책, 최소 용량을 부하 변화보다 충분히 안정적인 값으로 둡니다.

이동할 수 없는 Pod가 있으면 이유를 확인해야 합니다. PDB 때문인지, local storage·node selector·영역 제약 때문인지, requests가 너무 큰지에 따라 해결책이 다릅니다. 무조건 제약을 풀면 안전하지 않은 배치가 됩니다. 드레이닝 중 강제 장애와 정상 eviction을 따로 시험하고, 이동 직후 사용자 경험이 허용 범위에 있는지 확인하겠습니다. 실행 중 Pod를 더 적합한 노드로 바꾸는 이 최적화 동작을 **consolidation**이라고 부르지만, 애플리케이션의 무중단·상태 이전 책임까지 포함하는 용어는 아닙니다.

## 득점 포인트

- 빈 노드 정리와 실행 중 Pod 재배치를 동반하는 consolidation을 구분한다.
- PDB·termination grace period·세션·캐시·local storage의 중단 비용을 연결한다.
- 비용뿐 아니라 eviction·준비 시간·오류율·연결 재수립·진동을 성공 기준에 넣는다.

## 감점 포인트

- consolidation은 빈 노드만 삭제하므로 사용자 영향이 없다고 말한다.
- PDB가 있으면 모든 Pod 이동과 상태 손실이 자동으로 안전하다고 단정한다.
- 노드 비용 감소 하나만으로 최적화 성공을 판단한다.

## 더 파고들 거리

- 장기 세션 Pod를 자발적 disruption에서 보호하면서 강제 장애와 구분하는 정책을 설계해 보세요.
- consolidateAfter를 길게 할 때 비용 절감과 반복 재배치 안정성이 어떻게 달라질까요.
- Node drift 교체와 consolidation을 목적·대상·중단 조건·관측 지표로 비교해 보세요.
