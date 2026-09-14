---
id: node-provisioning
title: Karpenter 노드 공급의 제약 교집합과 준비 단계
topic: 인프라
summary: Pod 확장과 node 공급을 분리하고 NodePool·PVC zone·DaemonSet·클라우드 용량·인스턴스 다양성·실제 Ready 용량을 설명합니다.
questionIds: [karpenter-node-provisioning, pvc-nodepool-zone-conflict, cloud-capacity-instance-diversity]
---

# Karpenter 노드 공급의 제약 교집합과 준비 단계

## Replica를 늘리는 Controller와 기계를 공급하는 Controller는 다릅니다

HPA가 desired를 3에서 10으로 늘리면 workload controller가 Pod를 만듭니다. 기존 노드에 배치할 수 없는 Pod를 관찰한 Karpenter는 그 Pod의 요구와 허용 정책을 만족하는 노드 용량을 공급합니다. Karpenter가 앱의 적절한 replica 수나 DB 처리 병렬성을 직접 결정하는 것은 아닙니다.

NodeClaim 생성 성공도 최종 용량이 아닙니다. 클라우드 인스턴스 시작·노드 등록·플러그인·DaemonSet·Pod 배치·이미지·초기화·readiness를 거쳐야 합니다.

## 후보는 모든 필수 제약의 교집합입니다

| 입력 | 확인할 조건 | 교집합이 없을 때 |
| --- | --- | --- |
| Pod requests | CPU·메모리·확장 자원 | 크기 맞는 노드 없음 |
| Pod placement | selector·affinity·taint·spread | 허용 위치 없음 |
| NodePool·NodeClass | 유형·architecture·zone·capacity type·클라우드 설정 | 공급 후보 없음 |
| PVC·PV | 볼륨 topology·접근·attach | compute가 있어도 저장소 불일치 |
| 클라우드 | quota·subnet IP·실제 capacity·권한 | 생성·등록 실패 |

이미 zone A에 Bound된 PV인데 NodePool은 zone B만 허용하면 노드 수를 늘려도 해결되지 않습니다. WaitForFirstConsumer의 미바인딩 볼륨과 이미 위치가 정해진 볼륨을 구분합니다. 제약을 무조건 지우면 데이터 위치·보안·성능 요구를 어길 수 있습니다.

requests는 순간 사용량보다 노드 선택의 직접 입력입니다. 너무 작게 적으면 실제 working set을 못 감당하고, 너무 크게 적으면 불필요한 비용·Pending을 만들 수 있습니다. 새 노드의 allocatable·배치될 DaemonSet·Pod overhead·IP·volume attach 상한도 반영합니다.

```diagram
{"title":"NodeClaim부터 사용자 용량까지 따로 확인합니다","caption":"화살표는 공급 단계입니다. 어디서 멈췄는지에 따라 정책·클라우드·부트스트랩·앱 중 조사할 경계가 달라집니다.","rows":[[{"id":"pending","label":"배치 불가 Pod 관찰"}],[{"id":"claim","label":"후보 계산·NodeClaim"}],[{"id":"node","label":"인스턴스·Node Ready"}],[{"id":"pod","label":"Pod 배치·앱 Ready"}],[{"id":"capacity","label":"실제 처리량·지연 확인"}]],"edges":[{"from":"pending","to":"claim","label":"요구·정책 교집합"},{"from":"claim","to":"node","label":"클라우드·등록"},{"from":"node","to":"pod","label":"플러그인·초기화"},{"from":"pod","to":"capacity","label":"요청 분산"}]}
```

## 상태별로 조사 위치를 좁힙니다

NodeClaim이 없으면 Pod의 scheduling event와 NodePool 적합성·제한·controller 로그를 봅니다. NodeClaim은 있지만 인스턴스가 안 생기면 quota·IAM·subnet·capacity·provider 오류를 봅니다. 인스턴스는 있는데 Node Ready가 아니면 bootstrap·kubelet·CNI·등록 권한을 확인합니다.

Node Ready 뒤 Pod가 Pending이면 PVC topology·taint·실제 allocatable·확장 자원을 다시 대조합니다. Running인데 Ready가 아니면 앱 초기화와 probe입니다. NodeClaim condition 이름·reason은 Karpenter·provider 버전의 실제 계약을 따라 읽고 숫자 하나로 모든 원인을 뭉뚱그리지 않습니다.

## 인스턴스 후보를 넓혀도 동등한 서비스 용량은 아닙니다

여러 유형·영역·Spot/on-demand 후보는 capacity 확보 가능성을 높일 수 있습니다. 하지만 architecture·native library·CPU 명령·네트워크 대역폭·메모리 대역폭·보안 기능·가격이 다릅니다. multi-arch 이미지가 있다고 모든 native 의존성과 성능이 검증된 것은 아닙니다.

허용 후보와 비용 상한·핵심 최소 용량을 정책으로 선언하고 혼합 하드웨어에서 실제 요청 p99·처리율·메모리·Ready 시간을 비교합니다. 동일 vCPU 숫자를 동일 처리 성능으로 세지 않습니다. 후보 확장은 검증된 범위 안에서 하고 보안 요구를 capacity 부족의 임시 핑계로 우회하지 않습니다.

## 부팅 지연을 흡수할 준비 용량을 계산합니다

수요 감지·Pod 생성·Pending 관찰·노드 공급·앱 준비 동안 기존 용량이 버텨야 합니다. warm node·warm Pod·최소 replica·사전 확장과 진입 제한을 조합합니다. 새 노드를 공급해도 DB·단일 partition 병목은 그대로이므로 하위 완료율을 확인합니다.

테스트는 burst·좁은 zone·PVC 충돌·DaemonSet overhead·클라우드 capacity 부족·새 architecture를 나눕니다. 현재 작업에서 Karpenter·클라우드 인스턴스를 실행하거나 생성하지 않았습니다. 이 노트는 정책과 상태 진단 절차입니다.
