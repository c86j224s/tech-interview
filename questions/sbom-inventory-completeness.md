---
id: sbom-inventory-completeness
title: SBOM에 openssl이 없다는 사실만으로 artifact를 안전하다고 판단할 수 없는 이유는 무엇인가요?
difficulty: 중하
category: 인프라
tags:
  - provenance
  - SBOM
  - signature
related:
  - container-image-reproducibility
---
# SBOM에 openssl이 없다는 사실만으로 artifact를 안전하다고 판단할 수 없는 이유는 무엇인가요?

## 구두 답변

SBOM에 `openssl`이 없다는 것은 그 generator와 입력 범위에서 해당 식별자가 관찰되지 않았다는 뜻일 뿐, artifact에 OpenSSL이 전혀 없거나 안전하다는 증명이 아닙니다. 정적 링크된 binary, bundled 파일, 다른 image layer, 다른 package 이름, runtime download를 scanner가 놓칠 수 있습니다. 먼저 SBOM 생성 도구, 입력 digest, filesystem·binary·layer coverage를 확인하고 독립 inventory와 대조합니다.

예를 들어 SBOM에는 libX와 libY만 있지만 최종 binary가 OpenSSL 코드를 정적으로 포함하거나 시작 시 외부 URL에서 TLS library를 받는다면 목록과 실행 구성은 다릅니다. 또한 SBOM은 signer identity, source revision, builder, 악성 코드 부재, CVE database의 최신성도 증명하지 않습니다. vulnerability 결과는 당시 identifier mapping 범위로 한정해 기록합니다. 따라서 같은 digest의 provenance subject와 signature를 확인하되 그것도 inventory completeness를 대신한다고 말하지 않습니다.

이 문서에서는 SPDX 2.3 페이지의 normative package/file/relationship 본문을 충분히 읽지 못했으므로 schema 세부를 출처처럼 인용하지 않습니다. completeness는 SPDX의 자동 보장이 아니라 generator coverage와 독립 scan으로 검증할 운영 주장입니다. 의도적으로 component 하나를 누락한 fixture에서 binary·layer 대조가 경고를 내는지 확인하며, 실제 artifact scan은 실행하지 않았습니다. 동일 digest를 filesystem scanner와 binary scanner가 다르게 보는 경우 component name normalization과 static-link evidence를 대조합니다. coverage가 확인되지 않은 “없음”은 allow rule이 아니라 review 경고로 보내야 false assurance를 줄일 수 있습니다.

## 득점 포인트

- inventory·coverage·vulnerability·악성 부재를 독립 주장으로 분리합니다.
- 정적 링크·layer·runtime download 누락 경로를 구체화합니다.

## 감점 포인트

- SBOM에 없으면 bytes에도 절대 없다고 합니다.
- 읽지 못한 SPDX 세부를 normative 사실처럼 인용합니다.

## 더 파고들 거리

- 독립 inventory와 generator attestation의 coverage를 어떻게 비교하나요?
- 서명·provenance가 유효하지만 scanner가 놓친 component를 어떤 gate가 잡나요?
