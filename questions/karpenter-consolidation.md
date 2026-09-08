---
id: karpenter-consolidation
title: "Karpenter consolidation은 비어 있는 노드 삭제와 달리 실행 중인 Pod에 어떤 변화를 일으키나요?"
difficulty: 중하
category: 인프라
tags: ["Karpenter","consolidation","비용"]
related: ["k8s-pdb-eviction"]
---

# Karpenter consolidation은 비어 있는 노드 삭제와 달리 실행 중인 Pod에 어떤 변화를 일으키나요?

## 구두 답변

빈 노드 삭제는 이미 워크로드가 없는 노드를 제거하는 단순한 정리입니다. Karpenter의 consolidation은 여기에 더해 실행 중인 Pod를 다른 노드로 재배치하거나, 더 적은·더 적합한 용량으로 노드를 교체해 비용과 낭비를 줄이는 최적화입니다. 따라서 대상 노드가 비어 있지 않아도 eviction(노드에서 Pod를 내보내는 작업), 새 노드 부팅, 이미지·캐시 재예열이 발생할 수 있습니다. 실행 중인 API Pod가 다른 노드로 옮겨지는 동안 연결이 끊기거나 준비 시간이 다시 생길 수 있다는 뜻입니다.

가벼운 stateless API는 재배치 비용이 작을 수 있지만, 장기 게임 세션·큰 캐시·로컬 임시 데이터는 연결 끊김과 콜드 스타트를 만듭니다. PDB(동시에 중단할 Pod 수를 제한하는 예산)는 자발적 eviction(노드에서 Pod를 내보내는 작업)의 동시 중단을 제한하는 데 도움을 주지만 모든 교체가 안전하다는 보장은 아닙니다. 애플리케이션 종료 처리와 `terminationGracePeriod`(종료 유예 시간)도 필요합니다. NodePool(노드 후보와 제약을 묶은 정책)의 조건, 인스턴스 가격, consolidateAfter(통합을 기다리는 시간)와 Karpenter 버전을 명시적으로 확인하겠습니다. 세션 Pod를 무리하게 내보내면 연결이 끊기는 사례를 재현해 PDB만으로 충분하지 않은지 확인합니다.

성공 기준은 노드 수와 비용만이 아닙니다. 재시작 횟수, eviction 거절, 캐시 재구축 시간, 요청 오류율, 연결 재수립, 스케줄 대기와 절감액을 함께 보겠습니다. 비용만 줄고 이동 직후 오류율이 오르면 통합을 성공으로 보지 않겠습니다. 부하가 줄었다가 다시 늘어나는 패턴과 이동 불가능한 Pod를 시험해 통합이 반복되거나 피크 직전 용량을 잃지 않는지 확인하겠습니다.

## 득점 포인트

- 빈 노드 삭제와 Pod 재배치를 동반하는 consolidation을 구분한다.
- PDB·grace period·세션·캐시의 중단 비용을 함께 본다.
- 비용 외 사용자 영향과 반복 통합을 성공 기준에 넣는다.

## 감점 포인트

- consolidation은 빈 노드에만 적용된다고 말한다.
- PDB만 있으면 모든 eviction이 안전하다고 말한다.
- 노드 비용 감소 하나만으로 성공을 판단한다.

## 더 파고들 거리

- 장기 세션 Pod를 자발적 disruption에서 보호하면서 강제 장애와 구분하려면 어떻게 할까요?
- consolidateAfter를 길게 할 때 비용 절감과 안정성이 어떻게 바뀌나요?
- 노드 drift 교체와 consolidation의 목적·조건·관측 지표는 무엇이 다른가요?
