---
id: volume-recovery
title: PVC 연결·영역 배치·데이터 복구의 다른 보장
topic: 인프라
summary: Bound·attach와 데이터 내구성·fencing을 나누고 WaitForFirstConsumer·snapshot 일관성·WAL·논리 백업·복구 검증을 설명합니다.
questionIds: [k8s-stateful-storage, wait-for-first-consumer-topology, storage-snapshot-database-consistency]
---

# PVC 연결·영역 배치·데이터 복구의 다른 보장

## 볼륨 재연결과 데이터 최신성의 별도 보장

노드 장애 뒤 새 db-0이 같은 PVC를 붙이고 프로세스를 시작했다고 합시다. PVC Bound와 mount 성공은 사용할 저장소 연결을 확보했다는 뜻입니다. 마지막 커밋 데이터가 남았는지, 복제본이 어느 영역에 있는지, 옛 writer가 멈췄는지는 별도로 확인해야 합니다.

PVC는 저장소 요청, PV는 공급된 저장소 자원, CSI는 해당 저장소 공급·연결 동작의 구현 경로입니다. 데이터 복제·WAL·합의·백업·쓰기 소유권은 각 저장소와 앱의 계약입니다.

## 접근 모드와 Fencing의 구분

ReadWriteOnce는 일반적으로 한 노드의 읽기·쓰기 mount 범위를 나타내며 한 Pod만의 독점 쓰기라는 뜻은 아닙니다. ReadWriteOncePod 같은 모드는 별도 지원 조건이 있습니다. 어떤 접근 모드도 분리된 옛 프로세스의 모든 외부 쓰기를 포괄적으로 막는 앱 fencing과 같다고 단정하지 않습니다.

옛 노드가 네트워크만 단절된 채 계속 쓰고 있을 수 있으므로 새 attach 전에 스토리지·노드 수준의 안전한 격리와 이전 소유 종료를 확인합니다. 강제 detach·강제 Pod 삭제는 데이터 손상 가능성을 평가하고 승인할 별도 운영 행동입니다. 이름이 같은 새 Pod가 떴다는 사실이 옛 실행의 종료 증명은 아닙니다.

```diagram
{"title":"재연결 뒤에도 복구와 쓰기 허가가 남습니다","caption":"화살표는 안전한 복구의 개념적 순서입니다. 실제 CSI·DB 계약에서 옛 writer 격리와 복구 완료를 확인한 뒤 새 쓰기를 허용합니다.","rows":[[{"id":"fence","label":"옛 Writer 격리·소유 종료"}],[{"id":"attach","label":"허용 영역에 볼륨 연결"}],[{"id":"recover","label":"페이지·WAL 복구·검사"}],[{"id":"serve","label":"새 읽기·쓰기 허가"}]],"edges":[{"from":"fence","to":"attach","label":"중복 소유 방지"},{"from":"attach","to":"recover","label":"저장 바이트 확보"},{"from":"recover","to":"serve","label":"데이터 계약 충족"}]}
```

## WaitForFirstConsumer와 Pod·볼륨 배치 정합

볼륨을 먼저 영역 A에 만들고 Pod는 affinity 때문에 영역 B에만 배치할 수 있으면 Pending이 될 수 있습니다. WaitForFirstConsumer는 소비 Pod의 스케줄링 제약을 고려할 때까지 바인딩·공급을 늦춰 이런 불일치를 줄입니다. 데이터를 다른 영역에 복제하거나 장애 후 자동으로 새 영역에 옮기는 기능은 아닙니다.

먼저 StorageClass의 allowed topology와 PV node affinity가 허용하는 영역을 확인하고, Pod의 affinity·taint 조건과 NodePool의 실제 영역 용량을 같은 표에 놓고 겹치는지 봅니다. scheduler를 우회해 nodeName을 직접 지정하면 WaitForFirstConsumer가 소비 Pod의 제약을 반영하기 전에 흐름이 달라질 수 있으므로, 이 설정 조합이 지연 바인딩과 맞는지 확인합니다.

이미 만들어진 단일 영역 볼륨은 다른 영역에 compute 여유가 있어도 접근할 수 없다는 제약이 그대로 남습니다.

## Snapshot과 일관된 복구 집합

| 종류 | 보존하는 관점 | 필요한 확인 |
| --- | --- | --- |
| crash-consistent snapshot | 갑자기 중단된 저장 상태에 가까운 집합 | DB crash recovery 가능한 페이지·로그 |
| 앱 일관 snapshot | 앱이 정한 동결·flush·checkpoint 조건 | 제품의 일관성 프로토콜 |
| 논리 백업 | 스키마·행 등 논리 데이터 | snapshot 범위·객체·권한·복원 시간 |
| 복제본 | 다른 실행 노드의 상태 | 잘못된 삭제·손상도 전파될 수 있음 |

볼륨 snapshot에는 보통 프로세스 메모리가 포함되지 않습니다. 데이터 파일과 WAL이 여러 볼륨에 나뉘면 각각 다른 시점 snapshot이 복구 가능한 조합인지 확인해야 합니다. storage snapshot 성공만으로 DB의 일관된 거래 집합이 자동 생성되는 것은 아닙니다.

논리 백업도 모든 제품에서 같은 snapshot·잠금·DDL 일관성을 보장하지 않습니다. 대형 데이터의 restore·인덱스 재생성·로그 적용 비용을 포함합니다. 백업 파일이 존재한다는 사실보다 독립 환경에서 실제 복원이 되는지가 중요합니다.

## 삭제 정책과 백업 복원의 책임 범위

PV reclaimPolicy가 Delete이면 PVC/PV 수명 종료가 실제 백엔드 볼륨 삭제로 이어질 수 있습니다. Retain도 데이터 복구·접근권한·재바인딩을 자동 완료하지 않습니다. StatefulSet PVC retention 정책과 PV reclaimPolicy는 다른 단계에서 작용하므로 둘 다 확인합니다.

운영 볼륨 삭제 전 실제 참조·보관 요구·백업의 복원 가능성·스냅샷 보존을 확인하고 승인 범위를 분리합니다. 복제본만 있는 상태를 독립 백업으로 보고 삭제·손상 복구를 낙관하지 않습니다.

## RPO·RTO와 Pod Ready 전후의 전체 복구 시간

복원 후 마지막 확인된 커밋과 실제 복구된 레코드를 비교해 허용 유실 범위를 봅니다. 서비스가 정상 쓰기를 다시 허용하기까지 노드 준비·attach·DB 복구·검증·클라이언트 재연결 시간을 모두 측정합니다. 데이터가 남아도 attach가 너무 오래 걸리면 RTO 목표를 놓칠 수 있습니다.

테스트는 Pod 재시작·노드 손실·옛 writer 생존·영역 장애·snapshot 복원·논리 복원을 나눕니다. 현재 작업에서는 CSI·DB·볼륨 복원을 실행하지 않았으며 본문은 저장소 계약과 복구 검증 설계입니다.
