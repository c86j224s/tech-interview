---
id: workload-policy
title: Pod의 네트워크 허용과 API 최소 권한
topic: 보안
summary: NetworkPolicy 선택·방향·허용 합집합과 ServiceAccount 신원·RBAC·토큰 회전을 구분해 workload의 두 접근 경계를 설명합니다.
questionIds: [k8s-network-policy, k8s-serviceaccount-token]
---

# Pod의 네트워크 허용과 API 최소 권한

## 연결할 수 있다는 말과 호출할 권한이 있다는 말은 다릅니다

Pod가 Kubernetes API 서버에 TCP 연결할 수 있어도 Secret을 읽을 권한이 있어야 하는 것은 아닙니다. 반대로 RBAC가 좁아도 앱이 인터넷 모든 곳으로 데이터를 보낼 수 있으면 유출 경로가 남습니다. 네트워크 도달 범위와 API 행동 권한은 서로 다른 통제입니다.

NetworkPolicy는 지원하는 네트워크 구현에서 선택된 Pod의 ingress·egress를 제한합니다. ServiceAccount는 workload의 API 신원을 나타내며, 그 신원이 어떤 verb·resource·namespace에 접근하는지는 RBAC 등 인가가 결정합니다.

## 정책이 실제로 어떤 Pod를 격리하는지 먼저 확인합니다

| 항목 | 의미 | 확인할 점 |
| --- | --- | --- |
| metadata namespace | 정책이 놓인 범위 | 다른 namespace Pod에 자동 적용 안 됨 |
| podSelector | 이 정책의 대상 Pod | 라벨 변경·선택되지 않은 Pod |
| policyTypes | ingress·egress 방향 | 읽기 쉬운 명시적 선언 |
| peer·port | 허용 통신 범위 | DNS·DB·모니터링 필수 경로 |

기본 NetworkPolicy에서 해당 방향의 정책에 선택되지 않은 Pod는 일반적으로 그 방향에서 격리되지 않습니다. 선택되어 격리되면 적용 정책들의 허용 규칙 합집합으로 허용을 계산합니다. 제한 정책 하나를 만들었어도 다른 넓은 허용 정책이 통신을 열 수 있습니다. 개별 Pod 사이 연결은 source egress와 destination ingress가 각각 격리되어 있으면 양쪽 허용을 모두 만족해야 합니다.

namespaceSelector와 podSelector를 **같은 peer 항목**에 넣으면 그 namespace의 해당 Pod라는 결합 조건이 됩니다. **별도 peer 항목**으로 나누면 대안적 허용 범위가 합쳐집니다. 같은 단어가 YAML 들여쓰기만 달라져 넓은 정책이 되는 이유입니다.

```diagram
{"title":"패킷 허용 뒤에도 API 인가가 남습니다","caption":"화살표는 접근 순서입니다. CNI의 정책 집행과 API 서버의 인증·인가가 서로 다른 경계를 담당합니다.","rows":[[{"id":"pod","label":"앱 Pod","detail":["선택 라벨·ServiceAccount"]}],[{"id":"network","label":"실제 네트워크 정책","detail":["방향·peer·port"]}],[{"id":"auth","label":"API 신원 검증","detail":["토큰 audience·만료"]}],[{"id":"rbac","label":"RBAC 자원·행동 검사"}]],"edges":[{"from":"pod","to":"network","label":"연결 시도"},{"from":"network","to":"auth","label":"도달 허용"},{"from":"auth","to":"rbac","label":"인증된 주체"}]}
```

정책 객체 생성 성공은 CNI가 실제 패킷을 제한한다는 증거가 아닙니다. hostNetwork·노드 트래픽·NAT 전후 IP·기존 연결에 새 정책이 적용되는 동작도 구현별로 확인합니다. 기본 정책이 FQDN·HTTP 경로·사용자별 인가를 모두 표현한다고 가정하지 않습니다.

## ServiceAccount에는 필요한 동작만 부여합니다

앱이 자기 namespace의 ConfigMap 하나를 읽으면 충분한데 cluster-admin을 부여할 이유는 없습니다. 필요한 resource·verb·namespace·가능한 resourceNames를 좁히고, 목록 조회와 단일 이름 조회의 RBAC 제약 차이도 확인합니다. 권한 거절을 만나면 실제 필요한 API를 조사하지 않고 넓은 role을 붙이지 않습니다.

Secret 읽기는 다른 자격을 얻는 간접 권한입니다. Pod 생성·변경 권한도 다른 ServiceAccount를 쓰거나 마운트할 수 있는지에 따라 더 큰 영향을 가질 수 있으므로 직접 동작뿐 아니라 권한 확장 경로를 검토합니다. API를 쓰지 않는 workload에는 자동 토큰 마운트를 불필요하게 제공하지 않습니다.

## 토큰은 회전하는 파일이며 모든 대상의 자격이 아닙니다

projected ServiceAccount token의 audience·만료·bound object·회전 계약을 확인하고 앱은 교체된 토큰을 재읽을 수 있어야 합니다. 파일 한 번 읽고 문자열을 영구 캐시하면 플랫폼이 회전해도 오래된 토큰을 보낼 수 있습니다. 긴 연결이나 SDK 내부 캐시가 언제 새 자격을 사용하는지도 확인합니다.

Kubernetes API용 토큰을 클라우드 API가 자동으로 받아들여야 하는 것은 아닙니다. workload identity 교환에서는 신뢰 issuer·audience·서비스 계정 매핑과 최종 클라우드 권한을 별도로 제한합니다. 토큰을 이미지·로그·모델 문맥에 복사하지 않습니다. Pod 삭제·권한 철회가 어떤 검증 경로에서 언제 거절되는지 제품의 실제 계약을 시험합니다.

## 정책 파일과 실제 거절 결과를 같이 봅니다

테스트 namespace에 허용 Pod·비허용 Pod·다른 namespace Pod를 두고 DNS·DB·외부 통신을 각각 검사합니다. 두 정책의 합집합과 라벨 변경도 시험합니다. 정책이 기대대로 보여도 통신이 계속되면 selector·방향·다른 허용 규칙·CNI 지원·우회 경로를 순서대로 조사합니다.

API 권한은 테스트 ServiceAccount 자격으로 필요한 조회는 성공하고 다른 namespace·Secret·변경 작업은 거절되는지 확인합니다. 토큰 만료·회전·Pod 삭제·RBAC 철회를 포함합니다. 이 노트는 Kubernetes 설계 설명이며 실제 클러스터에 정책을 배포해 시험한 결과는 아닙니다.
