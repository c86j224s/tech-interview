---
id: oidc-logout-local-session
title: OP 로그아웃 성공 응답 뒤 RP의 local session과 refresh token은 어떻게 처리하나요?
difficulty: 중하
category: 보안
tags:
  - OIDC
  - 세션
  - refresh token
related:
  - refresh-token-rotation
  - jwt-vs-server-session
---
# OP 로그아웃 성공 응답 뒤 RP의 local session과 refresh token은 어떻게 처리하나요?

## 구두 답변

OP의 성공 redirect는 OP가 자신의 로그아웃 endpoint 처리를 마쳤다는 신호일 뿐 RP의 저장소를 변경하는 명령이 아닙니다. RP는 logout 버튼을 받은 즉시 현재 브라우저의 session row를 `revoked`로 바꾸고, cookie에 만료 시각과 동일한 경로·도메인의 `Set-Cookie`를 내려 브라우저 자격을 없앱니다. session row에 연결된 refresh family도 별도 revoke 시각을 기록합니다. refresh endpoint는 발급 전에 session 상태와 family version을 확인하므로, callback이 유실되거나 OP가 일시 장애여도 같은 브라우저에서 다시 갱신되지 않습니다. logout과 refresh가 동시에 오면 `UPDATE ... WHERE id=? AND revoked_at IS NULL AND version=?` 같은 원자 조건으로 한 쪽만 유효하게 만들고, 이미 revoke된 반복 logout은 성공적인 멱등 결과로 처리합니다.

예를 들어 S2에서 로그아웃했을 때 S1의 session row까지 지우지 않으며, “모든 기기” 버튼은 account security version을 올리는 별도 범위로 구현합니다. access token은 이미 발급된 값이므로 cookie 삭제만으로 즉시 회수되지 않을 수 있습니다. 민감한 API는 session 상태 또는 계정 보안 버전을 권위 저장소에서 재검사하고, 일반 API는 짧은 access-token TTL을 둡니다. OP callback에 도착했다고 결제·메일 같은 외부 효과가 취소되는 것도 아닙니다. 사용자에게는 local RP sign-out과 OP sign-out 결과를 구분해 보여 주고, refresh family revoke, cache·replica 지연, 동시 요청 결과를 감사 로그와 통합 테스트로 확인하겠습니다.

## 득점 포인트

- cookie 만료·server session revoke·refresh family revoke를 각각 처리합니다.
- OP callback 유실과 local logout을 분리하고 동시 refresh의 원자 조건을 제시합니다.
- access token과 이미 발생한 외부 효과의 별도 만료·취소 계약을 설명합니다.

## 감점 포인트

- OP callback이 RP DB를 자동 삭제한다고 가정합니다.
- cookie만 지우고 refresh endpoint의 상태 검사를 생략합니다.

## 더 파고들 거리

- logout과 refresh가 동시에 도착할 때 승패를 어떤 version 조건으로 결정하겠습니까?
- 현재 기기와 모든 기기의 family revoke 범위를 어떻게 저장하겠습니까?
