---
id: artifact-digest-signer-verification
title: mutable tag에 서명하지 말고 immutable digest와 signer identity를 검증해야 하는 이유는 무엇인가요?
difficulty: 중하
category: 인프라
tags:
  - provenance
  - SBOM
  - signature
related:
  - container-image-reproducibility
---
# mutable tag에 서명하지 말고 immutable digest와 signer identity를 검증해야 하는 이유는 무엇인가요?

## 구두 답변

tag는 재지정 가능한 이름이고 digest는 특정 manifest bytes의 immutable identity이므로 배포 gate는 digest에 묶어야 합니다. `app:prod`가 10:00에는 A, 10:05에는 B를 가리킬 수 있습니다. A의 서명이 유효해도 현재 tag가 B를 가리킨다면 A의 검증 결과를 B에 재사용할 수 없습니다. tag를 입력으로 받아도 먼저 registry resolution 결과인 digest를 기록하고 그 digest에 대해 signature·provenance·SBOM을 다시 평가합니다.

검증은 대상 digest를 직접 지정하고, 서명의 signer identity와 OIDC issuer가 허용된 repository·workflow 정책인지 확인하는 순서입니다. Cosign 공식 verification 문서의 expected identity·issuer 조건을 조직 정책에 맞춰 고정하며, SLSA provenance subject 검사는 별도 단계로 둡니다. 서명 object가 있다는 사실만으로 현재 tag bytes가 승인됐거나 image가 안전하다고 결론내리지 않습니다.

예를 들어 deploy trace에 `tag=prod, resolved=A`가 기록됐는데 tag가 B로 이동한 뒤 controller가 다시 resolve했다면 새 trace는 `resolved=B`가 되고 B의 서명과 signer를 재검사해야 합니다. identity를 좁히지 않으면 테스트 workflow도 같은 registry에 서명할 수 있습니다. 이 작업에서는 registry tag 이동과 cosign 실행을 하지 않았으므로 실제 성공이 아니라 검증 절차이며, 적용 도구 버전과 trust root를 함께 고정합니다. 검증 결과에는 요청 tag, resolve한 digest, 서명된 digest, signer identity, issuer를 모두 저장합니다. 각 값이 기대한 정책·대상과 불일치하면 “서명은 존재하지만 요청 artifact를 승인하지 못함”으로 거절 사유를 분리합니다.

## 득점 포인트

- tag resolution과 digest signature를 시간순 trace로 분리합니다.
- Cosign identity·issuer와 SLSA subject를 별도 gate로 평가합니다.

## 감점 포인트

- tag 이름이 bytes identity라고 합니다.
- 서명 존재만으로 현재 tag와 signer trust가 검증됐다고 합니다.

## 더 파고들 거리

- image digest와 provenance subject가 다를 때 manifest·signature 저장소를 어떤 순서로 대조하나요?
- keyless issuer와 workflow 조건을 조직 trust policy로 어떻게 좁히나요?
