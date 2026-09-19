---
id: dpop-key-rotation
title: DPoP 키를 회전할 때 기존 access token의 유효성을 어떻게 결정하나요?
difficulty: 중하
category: 보안
tags:
  - DPoP
  - 키 회전
  - OAuth
related:
  - secret-key-rotation
---
# DPoP 키를 회전할 때 기존 access token의 유효성을 어떻게 결정하나요?

## 구두 답변

기존 access token의 키 계약은 회전으로 자동 변경되지 않습니다. T1이 `cnf.jkt=A`로 발급됐다면 T1은 키 A proof와만 결합되고, client가 새 키 B를 만든 뒤 T1과 B proof를 제출하면 B의 thumbprint가 달라서 거절됩니다. 이것은 회전 실패가 아니라 sender constraint가 의도대로 작동한 결과입니다. 새 키를 사용하려면 AS가 허용한 refresh 또는 재인증 거래에서 B proof를 제시해 `T2: cnf.jkt=B`를 받아야 합니다.

상태를 `12:00: T1(cnf=A, exp=12:10), current=A`로 두면 T1+A는 통과합니다. 12:01에 current를 B로 바꾼 순간 T1+B는 `cnf mismatch`가 되고, refresh에서 기존 자격과 회전 정책을 통과해 T2를 발급받은 뒤 T2+B가 통과합니다. refresh token도 DPoP-bound라면 refresh 요청은 기존 키 A와 맞아야 하는지, 정상 회전을 위해 새 키를 어떻게 증명할지 별도 계약이 필요합니다.

키 B를 만든 사실만으로 이미 발급된 A token이 즉시 폐기된다고 단정할 수 없습니다. AS가 token family 회수, introspection 상태, 짧은 access-token TTL, refresh rotation 중 무엇을 제공하는지에 따라 A의 잔여 창이 달라집니다. A private key가 유출된 경우 정상 회전과 달리 즉시 회수·재인증을 선택해야 할 수 있습니다. 회수 endpoint나 introspection이 없다면 access token의 짧은 TTL과 refresh family 폐기가 남은 완화책이지만, 이미 탈취된 키가 만료 전 요청을 만드는 창까지 없애지는 못합니다. 모든 공개키를 허용하거나 `cnf` 비교를 생략하는 편법은 회전은 쉽게 하지만 DPoP를 bearer로 되돌립니다. 동시 refresh 결과, 네트워크 재시도, 분실 기기 복구도 테스트해 새 token이 어느 키에 귀속됐는지 결정적으로 남겨야 합니다.

## 득점 포인트

- 기존 token의 `cnf.jkt`가 회전 뒤에도 고정된다는 점을 상태 trace로 보여 준다.
- 새 키에는 새 token 발급 거래와 refresh-bound 조건이 필요하다고 설명한다.
- 유출 키 회수와 TTL은 AS 정책이며 회전만으로 즉시 폐기되지 않는다고 구분한다.

## 감점 포인트

- 모든 공개키를 허용하는 것을 안전한 회전이라고 한다.
- private key 없이 공개키 이름만 바꾸면 기존 token이 된다고 한다.
- 새 키 생성만으로 유출된 token이 즉시 무효화된다고 단정한다.

## 더 파고들 거리

- refresh token까지 sender-constrain할 때 키 연속성은 어떻게 검사할까요?
- 정상 회전과 분실·탈취를 운영 이벤트에서 어떻게 구분할까요?
