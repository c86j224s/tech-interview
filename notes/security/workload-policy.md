---
id: workload-policy
title: Pod의 네트워크 허용과 API 최소 권한
topic: 보안
summary: NetworkPolicy 선택·방향·허용 합집합과 ServiceAccount 신원·RBAC·토큰 회전을 구분해 workload의 두 접근 경계를 설명합니다.
questionIds: [k8s-network-policy, k8s-serviceaccount-token]
---

# Pod의 네트워크 허용과 API 최소 권한

## 네트워크 도달성과 API 호출 권한

Pod가 Kubernetes API 서버에 TCP 연결할 수 있어도 Secret을 읽을 권한이 있어야 하는 것은 아닙니다. 반대로 RBAC가 좁아도 앱이 인터넷 모든 곳으로 데이터를 보낼 수 있으면 유출 경로가 남습니다. 네트워크 도달 범위와 API 행동 권한은 서로 다른 통제입니다.

NetworkPolicy는 지원하는 네트워크 구현에서 선택된 Pod의 ingress·egress를 제한합니다. ServiceAccount는 workload의 API 신원을 나타내며, 그 신원이 어떤 verb·resource·namespace에 접근하는지는 RBAC 등 인가가 결정합니다.

Kubernetes workload의 접근 경계는 네트워크 패킷이 도달할 수 있는가와 API가 허용하는 행동이 무엇인가로 나뉩니다. NetworkPolicy, ServiceAccount, RBAC, 토큰 회전을 한 흐름으로 추적하되 각 경계의 판정 주체와 실패 증거는 따로 확인해야 합니다.

접근 trace를 `Pod의 egress 허용 → API endpoint 도달 → ServiceAccount token 인증 → RBAC verb/resource 판정`으로 나누면 실패 지점을 구분할 수 있습니다. 네트워크는 성공했지만 RBAC에서 403이 날 수 있고, RBAC가 넓어도 egress가 차단되어 API에 도달하지 못할 수 있습니다. 연습에서는 같은 Pod에 라벨을 바꾸고 다른 namespace peer를 추가한 뒤 적용 정책의 합집합을 다시 계산하며, 토큰 파일이 회전된 뒤 앱이 새 파일을 읽는지와 옛 토큰이 만료·철회 시 거절되는지를 별도로 기록합니다.

## NetworkPolicy 대상 Pod와 격리 범위

| 항목 | 의미 | 확인할 점 |
| --- | --- | --- |
| metadata namespace | 정책이 놓인 범위 | 다른 namespace Pod에 자동 적용 안 됨 |
| podSelector | 이 정책의 대상 Pod | 라벨 변경·선택되지 않은 Pod |
| policyTypes | ingress·egress 방향 | 읽기 쉬운 명시적 선언 |
| peer·port | 허용 통신 범위 | DNS·DB·모니터링 필수 경로 |

기본 NetworkPolicy에서 특정 방향의 정책에 선택되지 않은 Pod는 일반적으로 그 방향에서 격리되지 않습니다. Pod가 선택되어 격리된 뒤에는 적용되는 정책들의 허용 규칙을 합집합으로 계산하므로, 제한 정책 하나가 있어도 다른 넓은 허용 정책이 통신을 열 수 있습니다. 두 Pod 사이 연결에서는 source의 egress와 destination의 ingress가 각각 격리되어 있으면 양쪽 허용을 모두 만족해야 합니다. 그래서 한 정책만 보고 결론 내리지 말고 대상 Pod에 적용되는 정책들을 함께 읽어야 합니다.

`namespaceSelector`와 `podSelector`를 **같은 peer 항목**에 넣으면 ‘지정한 namespace 안에서 지정한 Pod를 고르는’ 결합 조건이 됩니다. 둘을 **별도 peer 항목**으로 나누면 두 조건 중 하나에 맞는 대안적 허용 범위가 합쳐집니다. 그래서 YAML의 단어가 같아도 들여쓰기만 달라지면 좁은 결합 조건이 넓은 허용으로 바뀔 수 있습니다.

```diagram
{"title":"패킷 허용 뒤에도 API 인가가 남습니다","caption":"화살표는 접근 순서입니다. CNI의 정책 집행과 API 서버의 인증·인가가 서로 다른 경계를 담당합니다.","rows":[[{"id":"pod","label":"앱 Pod","detail":["선택 라벨·ServiceAccount"]}],[{"id":"network","label":"실제 네트워크 정책","detail":["방향·peer·port"]}],[{"id":"auth","label":"API 신원 검증","detail":["토큰 audience·만료"]}],[{"id":"rbac","label":"RBAC 자원·행동 검사"}]],"edges":[{"from":"pod","to":"network","label":"연결 시도"},{"from":"network","to":"auth","label":"도달 허용"},{"from":"auth","to":"rbac","label":"인증된 주체"}]}
```

정책 객체 생성 성공은 CNI가 실제 패킷을 제한한다는 증거가 아닙니다. hostNetwork·노드 트래픽·NAT 전후 IP·기존 연결에 새 정책이 적용되는 동작도 구현별로 확인합니다. 기본 정책이 FQDN·HTTP 경로·사용자별 인가를 모두 표현한다고 가정하지 않습니다.

## ServiceAccount와 최소 API 권한

앱이 자기 namespace의 ConfigMap 하나를 읽으면 충분한데 cluster-admin을 부여할 이유는 없습니다. 필요한 resource·verb·namespace·가능한 resourceNames를 좁히고, 목록 조회와 단일 이름 조회의 RBAC 제약 차이도 확인합니다. 권한 거절을 만나면 실제 필요한 API를 조사하지 않고 넓은 role을 붙이지 않습니다.

Secret 읽기는 다른 자격을 얻는 간접 권한입니다. Pod 생성·변경 권한도 다른 ServiceAccount를 쓰거나 마운트할 수 있는지에 따라 더 큰 영향을 가질 수 있으므로 직접 동작뿐 아니라 권한 확장 경로를 검토합니다. API를 쓰지 않는 workload에는 자동 토큰 마운트를 불필요하게 제공하지 않습니다.

## projected ServiceAccount token의 회전과 audience별 자격 범위

projected ServiceAccount token은 audience·만료·bound object·회전 계약을 가진 파일 자격으로 다뤄야 하며, 앱은 교체된 파일을 다시 읽을 수 있어야 합니다. 앱이 파일을 한 번만 읽어 문자열을 영구 캐시하면 플랫폼이 토큰을 회전해도 오래된 토큰을 보낼 수 있습니다. 긴 연결이나 SDK 내부 캐시가 어느 시점에 새 자격을 사용하는지까지 확인해야 합니다.

`Kubernetes API용 토큰`을 클라우드 API가 자동으로 받아들이는 것은 아닙니다. workload identity 교환을 사용한다면 먼저 신뢰할 issuer·audience·서비스 계정 매핑을 제한하고, 교환 뒤 부여되는 최종 클라우드 권한도 별도로 좁힙니다. 토큰은 이미지·로그·모델 문맥에 복사하지 않습니다. Pod 삭제나 권한 철회가 실제로 어떤 검증 경로에서 언제 거절을 만드는지 제품 계약으로 시험합니다.

## NetworkPolicy·RBAC 정책과 실제 거절 결과

테스트 namespace에 허용 Pod·비허용 Pod·다른 namespace Pod를 두고 DNS·DB·외부 통신을 각각 검사합니다. 두 정책의 합집합과 라벨 변경도 시험합니다. 정책이 기대대로 보여도 통신이 계속되면 selector·방향·다른 허용 규칙·CNI 지원·우회 경로를 순서대로 조사합니다.

API 권한은 테스트 ServiceAccount 자격으로 필요한 조회는 성공하고 다른 namespace·Secret·변경 작업은 거절되는지 확인합니다. 토큰 만료·회전·Pod 삭제·RBAC 철회를 포함합니다. 이 노트는 Kubernetes 설계 설명이며 실제 클러스터에 정책을 배포해 시험한 결과는 아닙니다.
