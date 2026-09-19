---
id: kubernetes-crd-version-storage
title: Kubernetes CRD schema 변환과 storage version
topic: Kubernetes
summary: >-
  CRD의 served·storage version, structural schema, conversion webhook과 storage
  version migration을 API 호환·저장 형식의 문제로 구분합니다.
questionIds: []
prerequisites:
  - api-meaning
  - reconciliation
related:
  - schema-cutover
reviewedAt: '2026-09-19'
---
# Kubernetes CRD schema 변환과 storage version

CustomResourceDefinition의 version은 URL에 붙는 문자열 하나가 아니라, 클라이언트가 요청하는 표현, API 서버가 변환하는 내부 객체, etcd에 기록하는 저장 표현을 나누는 계약이다. `served: true`는 해당 version endpoint를 노출한다는 뜻이고, `storage: true`는 여러 version 중 하나를 현재 저장 형식으로 선택한다는 뜻이다. storage version을 바꿔도 기존 객체가 즉시 전부 다시 쓰인다고 말할 수 없다. Kubernetes 공식 문서는 기존 객체를 새 stored version으로 바꾸려면 Storage Version Migration을 실행하거나 모든 객체를 읽고 다시 쓰는 절차를 별도로 제시한다.

## Served와 storage 상태

두 version `v1beta1`, `v1`을 모두 served로 두고 `v1`만 storage로 표시할 수 있다. 구 client가 `/apis/example.com/v1beta1`로 GET해도 API 서버는 저장된 표현과 요청 표현 사이를 변환해 응답한다. 새 client가 v1으로 생성한 객체는 v1 형식으로 저장된다. 오래된 객체가 아직 v1beta1로 남아 있을 가능성이 있더라도 두 endpoint를 당장 하나만 남기는 것은 별개의 호환성 결정이다.

다음 표는 URL과 저장을 분리해 읽는 최소 상태다.

| 상태 | 의미 | 바로 결론 내리면 안 되는 것 |
| --- | --- | --- |
| served=true | client 요청 경로 제공 | 모든 기존 객체가 그 형식으로 저장됨 |
| storage=true | 새 저장·재저장의 기준 version | 기존 객체의 즉시 일괄 변환 완료 |
| status.storedVersions | 과거에 storage였던 version 목록 | 각 객체의 정확한 분포를 직접 보여줌 |
| conversion=Webhook | 표현 변환 시 webhook 호출 경로 | webhook 장애가 API와 무관함 |

CRD에는 한 번에 하나의 storage version이 있어야 한다. 그러나 `status.storedVersions`에 과거 storage version이 남는 동안에는 그 형식의 객체가 존재할 수 있다. path를 v1으로 바꿨다는 사실만으로 etcd의 모든 byte를 확인한 것이 아니다.

## Schema와 structural 조건

`spec.versions[*].schema.openAPIV3Schema`는 요청을 검증하고, structural schema 조건과 pruning 설정은 알려지지 않은 필드가 보존되는지에 영향을 준다. 예를 들어 `spec` 아래 `replicas`만 허용하는 schema에 `spec.debug=true`를 넣었는데 unknown field 보존이 허용되지 않으면 저장 전 pruning으로 사라질 수 있다. 이 현상은 version conversion webhook이 필드를 버린 것과 다르다. 어떤 단계에서 관찰했는지를 확인하려면 요청 직후 같은 version GET, 다른 version GET, 저장·재저장 뒤 GET을 따로 비교한다.

defaulting도 변환 손실과 혼동하기 쉽다. v1에서 `mode`가 없을 때 `safe`를 default로 채우면, v1beta1 응답에서 값이 나타난 것은 webhook이 임의로 데이터를 만들었다는 증거가 아니다. 반대로 v1beta1의 `hostPort`를 v1의 `host`와 `port`로 나누는 의미 변화는 `None` 전략으로 처리하면 안 된다. Kubernetes 문서는 schema가 다르고 필드 배치가 달라지면 custom conversion이 필요하다고 설명한다.

## None 전략과 conversion webhook

`conversion.strategy: None`은 version 간 schema가 사실상 같고 apiVersion 문자열을 바꾸는 정도의 상황을 위한 경로다. schema가 다르면 API 서버가 요청 version과 storage version 사이를 안전하게 변환하지 못한다. `Webhook` 전략에서는 API 서버가 ConversionReview 요청을 보내고 webhook이 각 객체를 대상 version으로 변환한다. 하나의 요청에 여러 객체가 들어올 수 있어 webhook은 객체를 독립적으로 변환하되 요청 순서를 유지하는 응답을 만들어야 한다.

conversion은 단순 admission과 다르다. 변환 webhook이 name·namespace·UID 같은 metadata identity를 바꾸려 하면 요청이 거절될 수 있고, labels·annotations 외 metadata 변경은 허용 범위가 좁다. webhook endpoint, TLS, Service port, `conversionReviewVersions`가 실제 API 서버와 맞지 않으면 GET뿐 아니라 LIST·UPDATE 등 변환이 필요한 경로가 영향을 받는다. “구 version GET이 한 번 성공했다”는 것은 모든 target version 조합이 정상이라는 증거가 아니다.

```diagram
{"title":"CRD 요청 표현과 저장 표현","caption":"client version, conversion, storage version은 서로 다른 단계이며 저장 version 변경은 별도의 객체 재작성 절차를 요구합니다.","rows":[[{"id":"client","label":"client 요청","detail":["v1 또는 v1beta1"]}],[{"id":"convert","label":"API 변환","detail":["None 또는 webhook"]}],[{"id":"store","label":"현재 storage","detail":["etcd 저장 표현"]}],[{"id":"migrate","label":"migration·재저장","detail":["기존 객체를 별도 갱신"]}]],"edges":[{"from":"client","to":"convert","label":"served endpoint"},{"from":"convert","to":"store","label":"현재 storage로 기록"},{"from":"store","to":"migrate","label":"기존 객체 처리"}]}
```

## 저장 version 변경의 시간축

초기 storage가 v1beta1일 때 객체 A를 만들면 A는 v1beta1로 저장된다. 이후 CRD에서 v1을 served와 storage로 바꾸면 새 객체 B는 v1로 저장될 수 있다. A를 v1beta1 endpoint로 읽으면 응답 apiVersion이 v1beta1이고, v1 endpoint로 읽으면 변환된 v1 표현이다. A가 실제로 v1으로 다시 저장되는 시점은 A를 update하거나 migration 절차가 A를 write할 때다.

설명용 상태 추적은 다음과 같다.

```text
T0: storage=v1beta1, create A -> storedVersions 후보 {v1beta1}
T1: storage=v1, create B -> A는 이전 표현, B는 v1
T2: GET A at v1 -> 응답만 v1로 변환, 저장 byte는 자동 확정하지 않음
T3: update A or migration -> 현재 storage(v1)로 재작성
```

공식 문서가 제시하는 수동 절차는 CRD의 storage를 새 version으로 설정한 뒤 모든 기존 객체를 list하고 같은 내용을 write해 backend가 새 storage version으로 저장하게 하는 방식이다. Storage Version Migration 리소스를 사용하는 경로도 있다. migration 성공 후 `status.storedVersions`에서 옛 version이 제거됐는지 확인한 다음에야 오래된 version 제거와 webhook 지원 중단을 검토한다. 클러스터에서 이 절차를 실제 실행하지 않았으므로 “즉시 모두 바뀌었다”는 결과는 주장하지 않는다.

## Conversion 장애의 경계

webhook이 down이면 API 서버가 변환이 필요한 요청을 완료하지 못하거나 오류를 반환할 수 있다. storage가 v1이고 client가 v1을 직접 요청하는 등 변환이 불필요한 경로가 있더라도, 한 종류의 성공을 근거로 다른 version GET/LIST/UPDATE가 모두 성공한다고 일반화하지 않는다. 캐시된 응답이나 이미 변환된 내부 경로가 보이는 상황도 API 서버 버전과 요청에 따라 달라질 수 있다.

장애 진단은 요청 version, 저장 version, 작업 종류(GET/LIST/CREATE/UPDATE), webhook target version, timeout 또는 TLS 오류를 함께 기록한다. UPDATE가 실패했다고 객체가 저장에서 사라진 것은 아니며, 반대로 GET 실패가 저장 손실을 뜻하는 것도 아니다. webhook을 복구한 뒤에는 round-trip에서 spec 의미와 identity가 보존되는지 확인하고, 실패한 write를 무작정 재시도해 controller가 중복 부수 효과를 만들지 않는지도 살핀다.

## Pruning·defaulting·변환 손실 분리

unknown field의 소실 원인을 정하려면 같은 입력을 각 version schema에 넣고 다음 세 지점을 비교한다. 첫째 요청 직후 API 서버가 응답한 객체에서 이미 사라졌는지 확인한다. 둘째 다른 version으로 GET할 때만 사라지는지 본다. 셋째 storage migration 또는 UPDATE 뒤에만 사라지는지 추적한다. 첫째라면 schema pruning 가능성이 크고, 둘째라면 conversion mapping이나 대상 schema 표현을 의심하며, 셋째라면 재저장 과정의 default·prune·webhook 구현을 조사한다.

구조적 동일성을 byte-for-byte YAML 비교로 검사해서는 안 된다. server가 `resourceVersion`, managedFields, apiVersion을 바꾸는 것은 보통 의미 보존 검사의 대상과 다르다. 반면 UID·name·namespace가 바뀌거나 `spec`의 수량·단위가 달라지면 identity 또는 업무 의미 손실이다. 의도한 default는 명시적 expected value와 구분해 비교한다.

## Round-trip 검증과 운영 선택

샘플 객체 집합에는 최소한 각 version의 필드 조합, unknown field, 빈 값과 생략, default 대상, status, labels/annotations를 넣는다. v1beta1→v1→v1beta1 변환에서 `spec`의 의미가 돌아오는지 비교하고, 허용되는 표현 차이 목록을 고정한다. UID·namespace·name은 보존해야 하며 `resourceVersion`은 write 시 바뀔 수 있으므로 동일성 조건에서 제외하거나 변화 규칙을 기록한다.

운영 rollout은 두 version을 먼저 served로 유지하고 webhook과 schema를 배포한 뒤, 읽기·쓰기 client를 점진 이동하고, storage migration 진행률과 `status.storedVersions`를 확인하는 순서가 안전하다. old version을 served=false로 내리는 결정은 client 로그와 장기 미접속 client까지 검토한 뒤 내린다. 이 문서의 수치와 상태는 설명용이며 실제 cluster migration·webhook 장애를 실행한 결과가 아니다.

## 참고자료와 버전 범위

참고자료: https://kubernetes.io/docs/tasks/extend-kubernetes/custom-resources/custom-resource-definition-versioning/ 및 https://kubernetes.io/docs/tasks/extend-kubernetes/custom-resources/custom-resource-definitions/ (website main의 본문, control-plane patch 미고정, 2026-09-19 확인). 문서는 `served`, `storage`, `status.storedVersions`, None/Webhook conversion, schema pruning과 기존 객체 업그레이드 절차를 설명한다. 페이지가 특정 Kubernetes release를 이 문서의 target으로 고정하지 않으므로, 실제 적용 때는 control plane 버전과 CRD API 버전을 별도로 기록해야 한다. Storage Version Migration의 설치·권한·가용성은 클러스터 구성에 따라 달라질 수 있다.
