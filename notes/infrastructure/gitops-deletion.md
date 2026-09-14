---
id: gitops-deletion
title: Argo CD Prune·Cascade와 데이터 복원 경계
topic: 인프라
summary: 파일 삭제·객체 식별자 변경·추적 리소스 prune·Application cascade를 구분하고 PVC 참조·reclaim·검증된 백업·복구 승인을 설명합니다.
questionIds: [argocd-prune-rollback, argocd-application-cascade-delete, gitops-pvc-prune-preflight]
---

# Argo CD Prune·Cascade와 데이터 복원 경계

## YAML을 되돌려도 지운 볼륨의 바이트는 돌아오지 않습니다

Git에서 PVC 선언을 제거하고 prune으로 실제 PVC·백엔드 볼륨까지 삭제되었다면 Git revert는 예전 선언만 되살립니다. 새 PVC가 빈 볼륨을 받는 것은 데이터 복원이 아닙니다. 리소스 선언 복귀와 상태·데이터 복원을 구분해야 합니다.

prune은 Application이 추적하던 실제 리소스 중 원하는 선언에서 빠진 대상을 sync 과정에서 제거하는 동작입니다. 모든 클러스터 객체를 지우는 것도 아니고 Git 파일 삭제 하나가 언제나 실제 객체 삭제와 일대일인 것도 아닙니다. 렌더 결과·추적 방식·resource identity를 확인합니다.

## 삭제의 계기와 대상이 다릅니다

| 변경 | 의미 | 확인할 범위 |
| --- | --- | --- |
| 파일명만 변경 | 렌더된 객체 identity가 같을 수 있음 | GVK·namespace·name |
| metadata.name 변경 | 보통 새 객체와 옛 객체 | 생성·prune 순서·참조 |
| 개별 선언 제거·prune | 추적 리소스 정리 | 보호 옵션·의존 객체 |
| Application cascade 삭제 | finalizer·삭제 옵션에 따른 관리 집합 정리 | 전체 추적 대상·추가 연쇄 |
| Namespace 삭제 | namespace 안 자원 영향 | PVC·Secret·외부 controller |

Application 삭제의 cascading 동작은 Argo CD finalizer와 리소스 추적·삭제 옵션에 달렸습니다. 개별 prune과 같은 계기·동일 범위라고 보지 않습니다. Kubernetes owner reference와 외부 controller가 추가 삭제를 수행할 수 있어 눈앞의 한 객체만 검토해서는 안 됩니다.

## 데이터 자원은 삭제 전 복원 능력을 확인합니다

```diagram
{"title":"삭제 승인 전에 실제 복원 가능성을 확인합니다","caption":"화살표는 검토 순서입니다. snapshot 객체 생성 성공만으로 복원·DB 일관성이 확인된 것은 아니며 삭제 실행은 별도 승인 대상입니다.","rows":[[{"id":"refs","label":"실제 참조·보존 요구 확인"}],[{"id":"policy","label":"PV·CSI·reclaim 정책 확인"}],[{"id":"backup","label":"필요 백업·snapshot 확보"}],[{"id":"restore","label":"독립 환경 복원 검증"}],[{"id":"approval","label":"정확한 삭제 집합 승인"}]],"edges":[{"from":"refs","to":"policy","label":"대상 정체성 확정"},{"from":"policy","to":"backup","label":"손실 영향 평가"},{"from":"backup","to":"restore","label":"복구 집합 검증"},{"from":"restore","to":"approval","label":"RPO·RTO와 책임"}]}
```

PVC를 사용하는 Pod·Job·StatefulSet·관리 도구를 조사하고 데이터 소유자의 보존 요구를 확인합니다. PV reclaimPolicy·스토리지 provisioner·StatefulSet PVC retention·snapshot deletion policy의 각 계층을 봅니다. Delete라면 underlying storage 삭제로 이어질 수 있으며 Retain도 자동 재바인딩·복구를 보장하지 않습니다.

DB snapshot에는 필요한 페이지·WAL·키·설정이 일관된 집합으로 있어야 합니다. 별도 복원 환경에서 마지막 확인된 커밋·핵심 불변식·복구 시간을 검증합니다. 백업 생성 성공을 복구 완료라고 부르지 않습니다.

## 삭제 보호와 잔존 자원의 정리를 함께 설계합니다

중요 리소스에는 수동 승인·prune 보호·작은 sync 범위·적절한 wave를 적용할 수 있습니다. 그러나 삭제를 영원히 막으면 비용·권한·민감 데이터가 계속 남습니다. 누가 어떤 조건에서 보존을 끝내고 정리하는지 명시합니다.

finalizer가 남으면 소유 controller·외부 정리 상태를 먼저 확인합니다. 무조건 강제 제거하면 외부 리소스가 고아로 남고 실제 데이터 정책을 어길 수 있습니다. 이 노트는 보호 우회나 삭제를 실행하지 않으며 운영 삭제에는 대상·백업·영향 범위의 명시적 승인이 필요합니다.

## 사고 뒤에는 추가 자동 변경과 상태를 먼저 확인합니다

의도하지 않은 prune이 진행되었다면 추가 변경을 통제하고 실제 삭제된 객체·남은 PV·backend ID·snapshot을 확인해야 합니다. 같은 이름의 PVC를 급히 재생성하면 빈 새 저장소가 붙어 남아 있는 원본의 정체성을 혼동할 수 있습니다. 원본이 무엇인지 확인한 뒤 복원 경로를 선택합니다.

Git revert·앱 이미지 rollback·DB 복원·외부 자원 복구·키 회수는 각자 다른 행동입니다. 유출 키는 가용성 회복을 위해 다시 살리는 것이 안전하지 않을 수 있습니다. 복구 성공은 Synced 표시가 아니라 필요한 데이터와 자격·서비스 결과가 정책을 만족하는지로 봅니다.

## 추적 집합과 부분 실패를 테스트합니다

데이터 없는 격리 Application에서 파일명 변경·객체명 변경·개별 prune·cascade 삭제를 나눠 예상 삭제 집합과 실제 결과를 대조합니다. 삭제 중간 실패·finalizer 지연·복원 실패도 확인합니다. 현재 작업에서는 Argo CD 삭제나 PVC 복원을 실행하지 않았으며 본문은 안전한 삭제 검토와 복구 설계입니다.
