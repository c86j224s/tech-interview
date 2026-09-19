---
id: webauthn-attestation-policy
title: WebAuthn attestation을 필수로 할지 선택적으로 받을지 무엇으로 결정하나요?
difficulty: 중하
category: 보안
tags:
  - WebAuthn
  - attestation
  - 정책
related:
  - authentication-vs-authorization
---
# WebAuthn attestation을 필수로 할지 선택적으로 받을지 무엇으로 결정하나요?

## 구두 답변

attestation을 필수로 할지는 “피싱을 막고 싶은가”가 아니라 “허용할 인증기의 provenance가 접근 정책에 필요한가”로 결정합니다. 일반 소비자 서비스에서는 challenge, origin, RP ID hash, authenticator data와 공개키 검증이 기본이고, attestation은 개인정보 노출과 인증서·metadata 운영 비용 때문에 `none` 또는 제한된 결과를 허용할 수 있습니다. 반면 회사 소유 단말만 등록해야 하는 관리형 업무 시스템이라면 승인된 AAGUID·인증서 체인을 등록 단계에서 확인하는 편이 정책에 맞습니다. 그래도 attestation은 특정 기기 계열의 증명이지 사용자가 현재 사람이라는 증거가 아닙니다.

UV와의 차이를 등록 결과에 명시해야 합니다. UV가 true인 credential은 인증기에서 PIN·생체 등 사용자 확인이 수행됐다는 신호지만, 그 인증기가 회사 승인 모델이라는 뜻은 아닙니다. 반대로 제조자 attestation이 검증됐어도 나중의 사용자가 계정 주인인지, 현재 인증 화면 앞에 있는지는 assertion의 user verification과 별개입니다. 예를 들어 일반 계정은 `none` 등록을 허용하되 고위험 관리자 그룹은 승인 AAGUID와 UV를 모두 요구할 수 있습니다. 정책을 바꿀 때 신규 등록만 차단할지 기존 credential 로그인도 단계적으로 중단할지, metadata 장애 때 신규 보류·기존 허용 같은 복구 규칙을 먼저 정합니다. attestation 필수 설정만으로 피싱·계정복구·서버 권한 문제를 해결한다고 말하지 않고, 목표 브라우저와 검증 라이브러리의 지원 범위를 별도 확인합니다.

## 득점 포인트

- provenance가 실제 접근 조건일 때만 attestation 비용을 요구합니다.
- UV와 attestation을 사용자 확인과 기기 provenance라는 별도 신호로 둡니다.
- 일반 사용자와 관리형 기기의 신규 등록·기존 로그인 정책을 분리합니다.

## 감점 포인트

- attestation 필수가 자동 피싱 방지라고 단정합니다.
- metadata 장애에서 검증을 생략해 전체 허용합니다.

## 더 파고들 거리

- 정책 변경 때 기존 credential을 단계적으로 회수할 조건은 무엇입니까?
- privacy와 지원 비용을 어떤 자산 위험과 비교하겠습니까?
