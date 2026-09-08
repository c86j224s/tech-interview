---
id: k8s-pod-deployment-statefulset
title: "Kubernetes에서 API 서버와 고정 식별자·디스크가 필요한 저장 서버를 배포합니다. Pod, Deployment, StatefulSet은 어떤 역할이 다른가요?"
difficulty: 하
category: 인프라
tags: ["Kubernetes","Pod","Deployment","StatefulSet"]
related: ["k8s-reconciliation"]
---

# Kubernetes에서 API 서버와 고정 식별자·디스크가 필요한 저장 서버를 배포합니다. Pod, Deployment, StatefulSet은 어떤 역할이 다른가요?

## 구두 답변

Pod는 함께 실행되고 네트워크와 일부 수명을 공유하는 컨테이너 묶음입니다. Deployment는 교체 가능한 Pod 복제본을 유지하고 롤아웃하는 데 쓰고, StatefulSet은 안정적인 이름과 식별·저장소 연결이 필요한 워크로드에 도움을 줍니다. StatefulSet이 데이터 복제나 합의를 자동 구현하는 것은 아닙니다.

Pod는 함께 실행되는 컨테이너의 단위이고, Deployment와 StatefulSet은 Pod들을 유지·교체하는 상위 리소스입니다. API 복제본은 보통 서로 대체 가능하지만 저장 노드는 자기 이름과 디스크 연결이 중요할 수 있습니다. 여기서 안정적인 이름을 제공한다는 것과 데이터를 다른 노드에 복제해 준다는 것은 다른 기능입니다.

상태 없는 API 서버는 어느 Pod로 요청이 가도 처리할 수 있게 만들고 Deployment로 교체하기 좋습니다. 반면 각 노드가 자기 디스크와 식별자로 클러스터에 참여하는 저장 시스템은 StatefulSet의 안정적인 식별이 유용할 수 있습니다. 그래도 노드 실패 시 데이터가 어디서 복구되는지와 여러 프로세스가 같은 저장소에 쓰지 않는지는 애플리케이션 계약입니다.

저는 상태를 메모리에만 들고 있는 서버를 StatefulSet으로 바꿨다고 안전해졌다고 보지 않겠습니다. Pod 재생성 때 잃는 상태, 볼륨 연결 시간, 정상 종료를 확인해야 합니다. 테스트는 재시작과 노드 장애를 구분해서 수행합니다. 리소스 종류 선택은 이름의 상태 유무가 아니라 교체 가능성·식별·저장소 수명의 요구에 맞춰야 합니다.

## 득점 포인트

- 실행 단위와 상위 관리자를 구분한다.
- 안정 식별과 데이터 복제를 분리한다.
- Pod·노드 장애의 상태 손실을 확인한다.

## 감점 포인트

- StatefulSet이면 자동으로 데이터가 복제된다고 말한다.
- Pod 이름이 같으면 프로세스 메모리도 유지된다고 말한다.
- Deployment는 어떤 상태도 가질 수 없다고 단정한다.

## 더 파고들 거리

- Headless Service는 StatefulSet의 발견에 어떤 도움을 주나요?
- PVC 보관 정책과 Pod 삭제의 관계는 무엇인가요?
- 순차 배포와 병렬 배포 중 어떤 조건에서 선택할까요?
