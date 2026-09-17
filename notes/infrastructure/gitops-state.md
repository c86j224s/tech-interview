---
id: gitops-state
title: Argo CD의 Drift·Sync·Health와 필드 책임
topic: 인프라
summary: Git 조회·비교·self-heal·실제 준비를 분리하고 HPA replicas 제외·sync 적용·긴급 변경의 만료와 감사 경계를 설명합니다.
questionIds: [argocd-gitops-reconcile, argocd-hpa-field-ownership, argocd-source-error-vs-health]
---

# Argo CD의 Drift·Sync·Health와 필드 책임

## Git 선언과 앱 장애의 구분

Git에 replicas=4인데 운영자가 클러스터를 8로 바꾸면 선언과 실제 상태의 drift가 생깁니다. Argo CD가 OutOfSync로 표시할 수 있지만 언제 4로 돌아가는지는 자동 sync·self-heal·일시 중지·필드 제외·적용 정책에 달렸습니다. “GitOps니까 언제나 즉시 덮는다”는 설명은 불충분합니다.

반대로 Git의 잘못된 이미지나 설정을 그대로 적용하면 Synced여도 앱은 실패할 수 있습니다. 원하는 선언과 일치하는지, Kubernetes 리소스가 건강한지, 사용자 기능이 정상인지 세 축을 구분합니다.

| 축 | 근거 | 자동으로 증명하지 않는 것 |
| --- | --- | --- |
| Source·comparison | Git revision·렌더 결과·비교 오류 | 앱 현재 중단 |
| Sync | 원하는 리소스와 관찰 리소스 차이 | 사용자 기능 성공 |
| Health | 리소스별 상태 해석 | 모든 업무 불변식 |
| 사용자 지표 | 실제 오류·지연·효과 | 선언과 일치 여부 |

## Git 조회 실패와 잘못된 선언의 실패 위치

Git 인증·네트워크 오류는 새로운 원하는 상태를 가져오지 못하는 문제입니다. 이미 실행 중인 Pod가 그 즉시 사라진다는 뜻은 아닙니다. 마지막 비교·동기화 revision과 오류를 보며 기존 서비스 상태를 별도로 확인합니다.

Git을 읽은 뒤에도 실패 지점은 순서대로 갈립니다. template 렌더가 먼저 실패하면 Kubernetes에 보낼 객체가 없고, 렌더된 객체가 API 검증에서 거절되면 해당 객체의 적용이 실패합니다. 다른 객체가 일부 적용될 수 있는지는 sync wave·apply 방식과 부분 실패에 달려 있으므로, API 적용까지 성공한 뒤 Pod readiness가 실패하는 경우와 분리해 기록합니다. 저장소가 복구되었을 때 현재 의도·긴급 변경 이력·다시 적용될 revision을 대조해 낡은 선언을 무심코 되살리지 않습니다.

```diagram
{"title":"선언 조회와 적용과 실제 기능은 별도 단계입니다","caption":"화살표는 GitOps 전달 경로입니다. self-heal은 잘못된 선언을 올바르게 고치는 기능이 아니라 그 선언으로 수렴시키는 정책입니다.","rows":[[{"id":"git","label":"신뢰한 Git revision 조회"}],[{"id":"diff","label":"렌더·diff·sync 정책"}],[{"id":"apply","label":"Kubernetes 적용"}],[{"id":"health","label":"리소스 Health·Ready"}],[{"id":"user","label":"사용자 요청 검증"}]],"edges":[{"from":"git","to":"diff","label":"원하는 상태"},{"from":"diff","to":"apply","label":"허용된 sync"},{"from":"apply","to":"health","label":"controller 수렴"},{"from":"health","to":"user","label":"업무 결과 확인"}]}
```

## HPA replicas 필드의 Controller 책임

HPA가 `replicas`를 8로 조정했는데 Git 선언이 4로 고정돼 있으면, 한 controller가 늘린 직후 다른 controller가 되돌리는 진동이 생깁니다. autoscaling 정책 자체는 Git에서 관리하되 workload의 `replicas` 필드처럼 HPA가 쓰는 값은 HPA를 실제 권위자로 둘지 결정하고, 그 결정에 맞게 Application의 적용 정책을 구성합니다.

변경 뒤에는 `metadata.managedFields`, HPA 상태, Application 정책을 함께 읽어 누가 값을 썼고 다음 sync가 무엇을 덮는지 확인합니다.

`ignoreDifferences`를 설정해 화면의 diff만 숨기는 것과 sync 때도 해당 필드를 덮어쓰지 않는 것은 다릅니다. 실제 sync 동작을 바꾸려면 `RespectIgnoreDifferences` 같은 적용 옵션이 켜져 있는지, 그리고 그 옵션이 이미 존재하는 대상 리소스에만 적용되는 조건을 확인해야 합니다. 리소스 전체를 제외하지 말고 필요한 필드만 지정해야 image·권한·port drift를 계속 볼 수 있습니다.

제외한 replicas의 수동 변경을 Argo diff가 여전히 알려 준다고 기대하지 않습니다. HPA min/max·변경 감사·현재 replica 이상 탐지로 보완합니다. 필드 소유권은 보안 인가를 대신하지 않으므로 누가 수동 patch할 수 있는지도 제한합니다.

## 긴급 변경의 기록과 종료 시각

일시적인 증설·설정 완화가 필요하면 변경 주체·이유·범위·만료·복구 책임을 기록하고 Git에 일시 패치나 정식 변경으로 반영합니다. 동기화를 멈추는 경우에도 언제 어떤 revision으로 재개할지 정합니다. self-heal을 영구 끄는 것으로 drift 관리가 해결되지는 않습니다.

재개 전에 실제 클러스터와 Git의 차이를 다시 검토합니다. rollback할 때도 최신 revision 자동 재적용과 경쟁하지 않게 기준을 명확히 합니다. 앱 버전 복귀가 DB·삭제 데이터·회수 자격을 자동 되돌리는 것은 아닙니다.

## 상태 조합별 동작 테스트

테스트 Application에서 수동 replica 변경, HPA 정상 조정, Git 접근 오류, 렌더 실패, 잘못된 readiness를 따로 재현합니다. OutOfSync와 Healthy가 공존하는 경우, Synced지만 실제 기능이 실패하는 경우도 관찰합니다. 제외한 필드와 제외하지 않은 image의 drift가 예상대로 처리되는지 확인합니다.

현재 작업에서는 Argo CD를 실행하거나 동기화를 변경하지 않았습니다. 본문은 제어 상태와 운영 책임을 설명하는 노트이며 실제 배포 결과가 아닙니다.
