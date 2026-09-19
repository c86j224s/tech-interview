---
id: provenance-builder-material-policy
title: >-
  trusted builder provenance가 있어도 악성 source revision을 빌드할 수 있습니다. materials와
  builder를 어떤 정책으로 검증하나요?
difficulty: 중하
category: 인프라
tags:
  - provenance
  - SBOM
  - signature
related:
  - container-image-reproducibility
---
# trusted builder provenance가 있어도 악성 source revision을 빌드할 수 있습니다. materials와 builder를 어떤 정책으로 검증하나요?

## 구두 답변

SLSA v1.0에서는 v0.2의 `materials`라는 표현 대신 `subject`, `runDetails.builder`, `buildDefinition.externalParameters`, `buildDefinition.resolvedDependencies`를 기준으로 정책을 씁니다. 먼저 provenance subject digest가 배포할 image digest와 같은지 확인하고, builder identity·issuer, invocation parameter, resolved dependency의 repository와 immutable revision을 각각 검사합니다. trusted builder 하나만 확인하면 승인된 runner가 공격자 PR revision을 빌드하는 경로가 남습니다.

예를 들어 builder가 `runner-prod`이고 허용됐지만 resolved dependency가 release 정책 밖의 `repo@r2`라면 거절합니다. revision은 허용돼도 build script가 외부 URL에서 최신 파일을 내려받으면 external parameter와 실제 다운로드 trace를 추가로 확인합니다. branch 이름만 저장하면 force-push와 ref 이동을 구분하지 못하므로 commit digest와 repository URI를 정책 입력으로 둡니다. fork PR에는 release signing·deploy 권한을 주지 않습니다.

SLSA attestation은 출처 주장을 구조화하지만 source가 악성이 아니라거나 secret이 log·cache로 새지 않았다는 보증은 아닙니다. 예외에는 승인자와 만료를 붙이고, subject mismatch·builder mismatch·dependency mismatch를 서로 다른 거절 이유로 남깁니다. 실제 CI attestation을 검증하지 않았으므로 이 답변의 r1/r2는 설명용 상태이며 운영에서는 v1.0 schema와 builder 계약을 고정합니다. resolvedDependencies는 선언 목록의 존재만으로 실제 network input을 전부 증명하지 않습니다. build egress를 제한하고 fetch URL·checksum을 기록해야 provenance 정책과 실행 trace가 어긋나는 지점을 찾을 수 있습니다.

## 득점 포인트

- SLSA v1.0의 resolvedDependencies와 builder·externalParameters를 올바른 필드로 사용합니다.
- subject·revision·builder·invocation 정책을 독립 검사합니다.

## 감점 포인트

- v1.0 문서에 materials를 그대로 사용합니다.
- trusted builder가 source와 secret safety까지 증명한다고 합니다.

## 더 파고들 거리

- reusable workflow와 fork PR의 builder·resolvedDependencies 정책을 어떻게 분리하나요?
- provenance subject와 재현 빌드 digest가 다를 때 어느 증거부터 조사하나요?
