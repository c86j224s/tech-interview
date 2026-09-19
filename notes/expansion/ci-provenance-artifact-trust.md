---
id: ci-provenance-artifact-trust
title: CI build provenance·SBOM·artifact 서명
topic: 플랫폼
summary: >-
  빌드 provenance, SBOM, artifact 서명이 각각 무엇을 증명하고 무엇을 증명하지 않는지 분리해 CI 산출물 검증 체계를
  설명합니다.
questionIds: []
prerequisites:
  - reproducible-image
  - workload-policy
related: []
reviewedAt: '2026-09-19'
---
# CI build provenance·SBOM·artifact 서명

공급망 검증에서 서명, SBOM, provenance는 서로 다른 질문에 답합니다. 서명은 특정 bytes의 digest와 서명 identity를 연결하고, SBOM은 생성기가 관찰한 구성 inventory를 표현하며, provenance는 어떤 builder가 어떤 build definition과 resolved dependencies로 subject를 만들었다는 출처를 주장합니다. 따라서 “서명됨”이나 “SBOM에 취약점 없음”을 곧바로 안전함으로 읽으면 검증 계층을 건너뜁니다.

## Artifact identity와 digest

배포 기준은 `app:prod` 같은 tag가 아니라 manifest digest로 고정합니다. 예를 들어 10:00에 `app:prod → sha256:A`, 10:05에 같은 tag가 `sha256:B`를 가리키게 되면 A에 대한 검증 결과는 B의 배포 근거가 될 수 없습니다. tag를 입력으로 받더라도 먼저 registry가 반환한 digest와 manifest를 기록하고 이후 signature·provenance·SBOM을 그 digest에 연결합니다.

서명 검증은 “허용된 identity가 이 digest에 서명했는가”를 판단합니다. 서명 파일의 존재만으로 tag가 그 digest를 가리킨다거나 image code가 악성이 아니라는 결론은 나오지 않습니다. signer identity, OIDC issuer 또는 trust root, repository·workflow 조건을 정책으로 좁혀야 테스트 CI가 production registry에 서명하는 경로를 막을 수 있습니다.

## SLSA v1.0 provenance

SLSA v1.0에서는 subject와 함께 `runDetails.builder`, `buildDefinition.externalParameters`, `buildDefinition.resolvedDependencies`를 중심으로 읽습니다. 오래된 v0.2의 `materials`라는 이름을 v1.0 문서에 섞어 쓰지 않습니다. resolved dependency의 URI와 immutable revision이 승인된 repository·commit인지, external parameters가 release workflow와 branch 규칙에 맞는지, builder가 허용된 CI identity인지 각각 확인합니다.

builder가 trusted여도 source가 자동으로 안전해지지 않습니다. 승인된 runner가 공격자의 PR revision을 빌드할 수 있고, build script가 provenance에 충분히 기록되지 않은 외부 URL을 내려받을 수 있습니다. subject digest가 배포 대상과 같은지 먼저 비교한 뒤 builder, invocation parameters, resolved dependencies의 policy를 독립적으로 평가합니다.

```diagram
{"title":"세 증거와 배포 정책","caption":"digest 서명·SLSA v1.0 provenance·SBOM은 각각 bytes, build 입력, 관찰된 구성에 대한 근거이며 최종 허용은 정책 조합입니다.","rows":[[{"id":"digest","label":"Artifact digest","detail":["검증 대상 bytes"]}],[{"id":"signature","label":"Signature","detail":["signer·issuer"]},{"id":"provenance","label":"Provenance","detail":["builder·resolved deps"]},{"id":"sbom","label":"SBOM inventory","detail":["관찰된 components"]}],[{"id":"gate","label":"Deploy gate","detail":["subject·source·risk policy"]}]],"edges":[{"from":"digest","to":"signature","label":"bytes 서명"},{"from":"digest","to":"provenance","label":"subject 연결"},{"from":"digest","to":"sbom","label":"inventory 대상"},{"from":"signature","to":"gate","label":"identity 검사"},{"from":"provenance","to":"gate","label":"입력·builder 검사"},{"from":"sbom","to":"gate","label":"coverage·취약점 검사"}]}
```

## SBOM inventory와 completeness

이 문서에서는 SPDX 2.3의 세부 package/file/relationship 스키마를 원문으로 충분히 확인하지 못했으므로 그 구조를 근거로 과장하지 않습니다. 대신 안정적인 주장만 사용합니다. SBOM에 `openssl` 항목이 없다는 것은 생성기와 입력 범위에서 그 식별자가 관찰되지 않았다는 뜻이지, 최종 bytes나 실행 시 다운로드에 OpenSSL이 없다는 증명이 아닙니다.

동일 digest에 대해 package manager 목록, filesystem과 binary scanner, image layer 목록, 정적 링크된 코드, runtime download 경로를 별도로 대조합니다. 다른 이름으로 기록됐거나 bundled binary에 포함됐거나 scanner가 layer를 건너뛰면 inventory가 비어 보일 수 있습니다. completeness는 SPDX가 자동 보증하는 속성이 아니라 generator coverage와 독립 inventory로 검증할 운영 주장입니다.

SBOM은 source provenance, signer identity, 악성 코드 부재, 아직 등록되지 않은 취약점의 부재도 증명하지 않습니다. vulnerability scanner는 당시 DB와 identifier mapping 범위에 한정됩니다. 따라서 “openssl 없음”을 “CVE 없음”이나 “안전함”으로 변환하지 않고 coverage 경고와 별도 정책 판정으로 저장합니다.

## Keyless signer와 builder

Keyless 서명도 identity policy가 필요합니다. Cosign 공식 verification 문서의 계약에 맞춰 검증 대상 image digest, expected signer identity, OIDC issuer를 직접 지정하고, 조직 정책에서는 repository와 workflow 조건을 추가로 제한합니다. 이때 SLSA provenance subject 검사는 Cosign signature 검사의 대체가 아니라 별도 단계입니다.

비신뢰 PR을 빌드하는 runner가 release signing credential이나 production deploy 권한을 받지 않게 분리합니다. provenance가 builder를 증명해도 secret이 build log, layer, cache로 유출되지 않았다는 뜻은 아닙니다. fork PR, reusable workflow revision, dependency egress를 별도로 검사합니다.

## Attestation 보관과 gate

provenance와 SBOM은 배포 시 다시 생성하지 말고 빌드 때의 digest에 연결해 보관합니다. digest, provenance subject, source revision, builder run ID, SBOM document 식별자, signer identity, verifier 결과, 생성 시각을 하나의 trace로 묶습니다. tag가 이동하면 새 digest에 대해 새 검증을 요구하고 이전 결과를 재사용하지 않습니다.

예를 들어 `digest=A`, signer는 허용, SLSA v1.0의 builder도 허용이지만 `resolvedDependencies`가 release branch 밖의 revision이면 거절합니다. 모든 provenance가 통과해도 binary scanner가 정적 링크를 못 봤다면 SBOM completeness 경고가 남습니다. emergency 예외를 허용할 때는 CVE 사실을 지우지 않고 승인자·만료·완화 조치를 별도 기록합니다.

## 실패 검증과 비용

실제 registry build·sign·verify는 실행하지 않았습니다. 운영 검증에서는 tag를 A에서 B로 이동시킨 fixture, subject가 다른 attestation, 허용되지 않은 issuer, PR revision, 누락된 SBOM component를 각각 넣고 어느 rule이 거절하는지 확인합니다. 저장·스캔·투명성 log·취약점 DB 갱신 비용이 증가하므로 release artifact와 개발 build의 증거 요구 수준을 나누되, 배포 대상에는 digest·identity·source·coverage의 최소 기준을 고정합니다.

## 참고자료와 범위

- [SLSA Provenance v1.0](https://slsa.dev/spec/v1.0/provenance) — subject, `runDetails.builder`, `buildDefinition.externalParameters`, `resolvedDependencies`. SLSA v1.0, 확인일 2026-09-19.
- [SPDX Specification v2.3](https://spdx.github.io/spdx-spec/v2.3/) — 이번 pass에서는 normative 세부 본문을 충분히 읽지 못했으므로 schema 세부 주장의 근거로 사용하지 않았습니다.
- [Cosign signing](https://docs.sigstore.dev/cosign/signing/signing_with_containers/) — digest-oriented signing context.
- [Cosign verification](https://docs.sigstore.dev/cosign/verifying/verify/) — digest, expected identity, OIDC issuer 검증 예시. 문서 release는 고정하지 않았습니다.
- [재현 가능한 이미지](/tech-interview/notes/reproducible-image/) — 입력 고정과 provenance의 인접 설명입니다.

특정 CI provider, registry, Cosign release, SBOM generator를 실행하지 않았습니다. 통합 시 대상 버전과 generator coverage를 고정해야 합니다.
