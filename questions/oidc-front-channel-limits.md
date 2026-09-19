---
id: oidc-front-channel-limits
title: OIDC front-channel logout이 브라우저 상태를 완전히 정리하지 못하는 이유는 무엇인가요?
difficulty: 하
category: 보안
tags:
  - OIDC
  - front-channel logout
  - 브라우저
related:
  - csrf-vs-xss
---
# OIDC front-channel logout이 브라우저 상태를 완전히 정리하지 못하는 이유는 무엇인가요?

## 구두 답변

Front-channel logout은 OP가 사용자의 브라우저에서 각 RP logout URI를 열도록 하는 전달 방식입니다. RP 서버가 OP로부터 인증된 서버 간 메시지를 받는 back-channel과 달리, 브라우저가 iframe을 만들고 요청을 완료해야 다음 단계가 진행됩니다. 사용자가 창을 닫거나 네트워크가 끊기거나 iframe이 차단되면 RP URI에 도착하지 않을 수 있습니다. 제3자 cookie 차단 환경에서는 iframe 요청에 RP cookie가 붙지 않아 어느 local session을 지울지 알 수 없고, SameSite·브라우저 저장소 정책도 결과를 바꿉니다. `HttpOnly` cookie는 iframe의 JavaScript가 값을 읽어 삭제할 수 있는 대상도 아니므로 서버가 세션을 revoke하고 만료 `Set-Cookie`를 내려야 합니다.

예를 들어 OP 페이지가 RP-A와 RP-B의 logout iframe을 삽입했는데 브라우저가 third-party cookie를 막았다면, 화면상 iframe element가 만들어졌다는 사실만으로 두 RP의 server session이 회수됐다고 말할 수 없습니다. RP-A는 front-channel URI가 호출되었을 때 상관 정보가 맞는지 확인하고 local session을 멱등적으로 revoke하되, 그 결과를 OP 전체 로그아웃의 증거로 확대하지 않습니다. 자체 local logout 버튼은 이 채널과 독립적으로 cookie 만료와 서버 세션 폐기를 먼저 수행하고, back-channel이 제공되면 서버 간 token 검증 경로도 둡니다. 따라서 모니터링은 iframe load가 아니라 실제 revoke 행, refresh 차단, 재로그인 결과를 측정해야 하며, 전달 실패를 조용히 성공으로 기록하지 않습니다.

## 득점 포인트

- 브라우저 iframe 전달과 서버 간 내구 통지를 구분합니다.
- third-party cookie·SameSite·창 종료가 RP session 식별을 깨뜨리는 경로를 제시합니다.
- local revoke와 back-channel을 front-channel 성공과 독립적으로 둡니다.

## 감점 포인트

- iframe load만으로 server session과 refresh 회수를 증명합니다.
- HttpOnly cookie를 iframe script가 직접 삭제한다고 설명합니다.

## 더 파고들 거리

- front-channel endpoint가 중복 호출될 때 어떤 멱등 키를 사용하겠습니까?
- 전달 실패를 사용자에게 어떻게 표시하고 재시도하겠습니까?
