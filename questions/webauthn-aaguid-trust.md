---
id: webauthn-aaguid-trust
title: AAGUID 기반 허용 목록을 운영할 때 어떤 변경과 복구를 준비하나요?
difficulty: 중하
category: 보안
tags:
  - WebAuthn
  - AAGUID
  - 신뢰 목록
related:
  - secret-key-rotation
---
# AAGUID 기반 허용 목록을 운영할 때 어떤 변경과 복구를 준비하나요?

## 구두 답변

AAGUID는 authenticator 모델·계열을 정책에 연결하는 값이지 credential ID나 계정의 유일한 소유권 증명이 아닙니다. 허용 목록은 AAGUID만 배열로 두지 않고 metadata 출처, 수집·검증 시각, metadata 버전, 상태와 폐기 사유, 정책 버전을 함께 저장합니다. 등록 요청에서 AAGUID가 새 값이면 “모르는 값”과 “위험한 값”을 구분해 pending으로 보류할 수 있고, 이미 등록된 credential의 assertion은 별도의 위험 정책으로 평가해야 합니다. 이 분리를 하지 않으면 한 모델의 metadata 갱신이 기존 사용자 전체 로그인 장애로 번집니다.

예를 들어 회사가 새 인증기 A를 도입하면 v12 목록에 A를 추가한 뒤 신규 등록부터 허용하고, 기존 자격은 정상 assertion·UV·계정 상태를 계속 확인합니다. 나중에 A의 취약점이 확인되면 v13에서 신규 등록을 닫고 고위험 작업에 재인증을 요구하며, 모든 credential을 즉시 차단할지 단계적 회수할지는 실제 위험 신호와 복구 수단을 함께 보고 결정합니다. metadata 서비스가 다운되었다고 서명과 RP binding을 생략해 전체 허용으로 전환하지 않으며, 신규 등록 보류·마지막 검증본의 짧은 유예·승인된 관리자 예외처럼 명시된 fallback만 사용합니다. 목록은 서명된 설정이나 승인 배포로 버전 관리하고, 잘못된 폐기 목록을 되돌릴 절차와 영향받은 credential 조회를 준비합니다. AAGUID 기반 신뢰는 attestation·UV·계정 연결 상태와 결합해야 하며 AAGUID만으로 모든 사용자 보안을 동일하다고 단정할 수 없습니다.

## 득점 포인트

- AAGUID·metadata 출처·상태·정책 버전을 함께 관리합니다.
- 신규 등록 허용과 기존 credential 로그인을 분리해 오탐 장애를 줄입니다.
- metadata 장애와 폐기 목록 오류에 제한적 fallback·복구 절차를 둡니다.

## 감점 포인트

- AAGUID 하나가 사용자 소유권과 동일하다고 봅니다.
- 목록 갱신 실패 시 모든 credential을 무조건 허용하거나 차단합니다.

## 더 파고들 거리

- 새 모델 승인과 기존 자격의 고위험 작업 제한을 어떤 순서로 배포하겠습니까?
- 잘못된 AAGUID 폐기 목록의 영향 범위를 어떻게 되돌리겠습니까?
