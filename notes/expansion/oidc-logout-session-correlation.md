---
id: oidc-logout-session-correlation
title: OIDC 로그아웃과 세션 상관관계 한계
topic: 보안
summary: RP-Initiated·back-channel logout의 sid·iss 상관관계와 브라우저 세션 종료 보장의 한계를 구분합니다.
questionIds: []
prerequisites:
  - oidc-foundations
  - session-authority
related:
  - oidc-foundations
  - session-authority
  - login-transaction
reviewedAt: '2026-09-19'
---
# OIDC 로그아웃과 세션 상관관계 한계

## 로그아웃을 하나의 사건으로 보지 않는 이유

OIDC에서 로그아웃은 “사용자가 버튼을 눌렀다”와 “모든 자격이 즉시 사라졌다” 사이에 여러 권위와 전달 경로를 둡니다. RP(relying party)는 자기 애플리케이션의 브라우저 쿠키와 서버 세션을 소유하고, OP(OpenID Provider)는 OP 브라우저 세션과 발급한 자격을 관리합니다. RP-Initiated Logout은 RP가 OP의 로그아웃 endpoint로 사용자를 보내는 시작 계약이고, Back-Channel Logout은 OP가 RP의 서버 endpoint로 logout token을 전달하는 통지 계약입니다. Front-Channel Logout은 브라우저를 매개로 RP의 logout URI를 불러오는 전달 방식입니다.

따라서 한 채널의 성공을 다른 채널의 성공으로 확대 해석하면 안 됩니다. OP endpoint가 redirect를 반환했다는 사실은 RP DB의 세션 행이 삭제됐다는 증거가 아니고, RP가 local session을 삭제했다는 사실도 다른 기기의 OP 세션까지 끝냈다는 증거가 아닙니다. 먼저 “어느 세션을, 어느 권위가, 어떤 메시지로 종료시키는가”를 그립니다.

## RP-Initiated Logout 요청 구성

RP는 사용자를 OP의 로그아웃 endpoint로 보낼 때 `id_token_hint`, `logout_hint`, `client_id`, `post_logout_redirect_uri`, `state` 같은 매개변수를 프로필에 맞게 사용합니다. 이 중 모든 매개변수를 모든 OP가 같은 방식으로 처리한다고 가정해서는 안 됩니다. 특히 redirect URI는 RP가 미리 등록한 값과 정확히 매칭해야 하며, 요청의 임의 URL을 그대로 받아서 OP에 전달하거나 callback 위치로 사용하면 open redirect와 피싱 경로가 됩니다.

`id_token_hint`를 받는 RP 또는 OP 구현은 그 토큰의 issuer와 client 문맥을 확인해야 합니다. 토큰의 `iss`가 우리 서비스가 신뢰하는 OP인지, `aud`가 이 RP client인지, 만료와 서명 정책이 맞는지를 확인하고, 내부에서 보관한 로그인 거래나 세션과 연결할 수 있어야 합니다. 다만 RP-Initiated Logout 사양이 특정 구현의 모든 서버 세션과 refresh token을 어떤 저장소에서 어떻게 삭제하라고 대신 정해 주는 것은 아닙니다. RP가 보유한 session ID와 refresh family를 별도로 회수해야 합니다.

## sid·iss 상관관계

Back-Channel Logout의 핵심은 logout token을 일반 로그인용 ID token으로 취급하지 않는 것입니다. token에는 로그아웃을 일으킨 OP의 `iss`, 대상 RP를 지정하는 `aud`, 계정 주체인 `sub`가 들어갈 수 있고, 특정 OP 세션을 가리키는 `sid`가 선택적으로 들어갈 수 있습니다. RP는 먼저 서명을 검증하고 issuer와 audience가 자기 설정과 맞는지 확인한 뒤, `sid`가 있으면 `(iss, sid)` 또는 RP가 정한 동등한 session correlation key로 특정 세션을 찾습니다.

예를 들어 같은 사용자가 휴대전화 S1과 노트북 S2에서 로그인했고 OP가 S2 세션만 종료했다면, `sid=S2`인 통지는 S2의 RP 세션과 refresh 계열만 회수해야 합니다. `sub`만 보고 사용자의 모든 세션을 삭제하면 더 넓은 조치가 됩니다. 반대로 정책상 특정 사용자 전체를 종료해야 한다면 그 범위를 명시적인 계정 보안 사건으로 처리해야 하며, sid가 없다는 사실을 전체 삭제의 근거로 자동 변환해서는 안 됩니다. logout token의 audience를 확인하지 않으면 다른 RP용 통지가 우리 세션을 지우는 교차 대상 문제가 생깁니다.

```diagram
{"title":"OIDC 로그아웃은 세 권위 사이를 연결합니다","caption":"RP 시작 요청은 브라우저를 통한 시작이고, back-channel 통지는 서버 간 전달입니다. 각 경로의 성공은 자기 저장소에서 확인해야 합니다.","rows":[[{"id":"rp","label":"RP 세션","detail":["cookie · server session","refresh family"]},{"id":"op","label":"OP 세션","detail":["브라우저 S2","issuer authority"]}],[{"id":"start","label":"RP-Initiated 요청","detail":["registered redirect"]},{"id":"token","label":"Back-Channel logout token","detail":["iss · aud · sid"]}],[{"id":"revoke","label":"RP 회수 처리","detail":["sid 범위 적용","중복 안전"]}]],"edges":[{"from":"rp","to":"start","label":"사용자 logout 시작"},{"from":"op","to":"start","label":"OP endpoint 방문"},{"from":"op","to":"token","label":"세션 종료 통지"},{"from":"start","to":"revoke","label":"local session 별도 종료"},{"from":"token","to":"revoke","label":"상관 키 검증 후 회수"}]}
```

## Front-Channel과 Back-Channel의 전달 차이

Front-Channel은 OP가 브라우저에서 RP의 logout URI를 iframe 등으로 불러 RP가 브라우저 상태를 정리하게 하는 모델입니다. 브라우저 네트워크, iframe 정책, 쿠키의 SameSite·third-party 제한, 사용자의 창 종료와 연결되어 있으므로 서버가 내구적으로 받았다는 보장이 약합니다. iframe이 로드된 것이 확인되어도 그 안에서 RP session cookie를 지웠는지, 서버 세션과 refresh family가 회수됐는지는 별개입니다. HttpOnly 쿠키는 페이지 script가 값을 직접 지울 수 없으므로 서버가 만료 응답을 내거나 별도 session 회수 endpoint를 처리해야 합니다.

Back-Channel은 RP 서버가 logout token을 받는 endpoint를 제공하고, token 검증과 세션 상관을 서버에서 수행합니다. 그렇다고 네트워크 전달이 한 번에 반드시 성공하는 것은 아닙니다. 재전달과 중복을 전제로 logout token의 식별 또는 상관 키를 기록하고, 이미 회수된 session에 다시 도착해도 같은 결과가 되게 만듭니다. sid가 없는 token은 검증된 iss·sub로 해당 RP의 모든 매핑 행을 조회한 뒤 일괄 회수하되, 다른 issuer나 다른 client 행은 포함하지 않습니다. 재시도 횟수와 보관 기간은 이 문서에서 임의로 정할 수 없고 사용 중인 OP 계약과 운영 정책으로 결정해야 합니다.

## RP local session과 refresh 회수

사용자가 RP에서 로그아웃을 누르면 RP는 자기 session cookie를 만료시키고 서버 session을 revoked 상태로 바꿔야 합니다. OIDC callback이 성공했는지 기다리느라 local cookie 삭제를 늦추면 OP 장애가 곧 RP 로그아웃 실패로 번집니다. 반대로 OP 로그아웃 결과를 확인하지 않고 “모든 곳에서 로그아웃 완료”라고 화면에 표시하는 것도 부정확합니다. 사용자에게는 RP local sign-out 완료와 OP sign-out 시도 결과를 분리해 보여 주는 편이 낫습니다.

Refresh token을 저장하는 경우에는 현재 브라우저 session뿐 아니라 해당 session family를 회수합니다. access token은 이미 발급된 짧은 자격일 수 있어 즉시 삭제만으로 이미 진행 중인 요청을 되돌리지는 못합니다. 서버 API가 session 상태나 account security version을 매 요청 확인한다면 이후 요청은 빨리 차단할 수 있지만, 캐시와 replica lag가 있다면 허용 지연을 측정하고 민감한 변경은 권위 저장소에서 재검사합니다. 토큰 회수와 외부 효과 취소는 다른 계약입니다.

## 실패 경계와 멱등 회수

실패 상태를 `OP로 이동 전`, `OP 응답 수신`, `RP local session 회수`, `back-channel token 수신`, `refresh family 회수`로 나눠 기록합니다. 사용자가 탭을 닫거나 redirect 응답을 잃어도 RP는 먼저 자기 세션을 회수할 수 있고, 나중에 재로그인이나 명시적 로그아웃 요청이 남은 OP 상태를 보정할 수 있습니다. 반대로 OP가 RP endpoint에 같은 logout token을 재전달하더라도 revoked 행을 다시 revoked로 만드는 것은 안전해야 합니다.

가장 중요한 검증 사례는 같은 사용자의 S1·S2 중 S2만 로그아웃되는 경우입니다. `sid=S2` 통지가 S1의 refresh family까지 지우지 않는지, 다른 client의 audience를 가진 token을 거절하는지, 변조된 issuer·서명을 거절하는지 확인합니다. Front-Channel iframe이 로드되지 않는 브라우저에서도 local session 만료와 server-side 회수가 작동하는지 별도로 시험합니다. 실제 OP의 retry와 브라우저 정책은 제공자별 차이가 있으므로 읽지 않은 구현 보장을 일반 사실로 쓰지 않습니다.

## 적용 순서와 참고 자료

실제 구현 순서는 첫째, OP별 지원 프로필과 토큰 검증 라이브러리 계약을 고정합니다. 둘째, RP session에 OP issuer, client, sid, session family를 보관하고 여러 기기 세션을 구분합니다. 셋째, RP local logout는 callback과 무관하게 즉시 회수하고, OP 통지는 검증·상관·멱등 처리합니다. 넷째, 허용된 post-logout redirect만 사용하고 로그에는 토큰 원문 대신 issuer·sid 해시·처리 결과를 남깁니다.

확인한 기본 근거는 [OpenID Connect RP-Initiated Logout 1.0](https://openid.net/specs/openid-connect-rpinitiated-1_0.html)과 [OpenID Connect Back-Channel Logout 1.0](https://openid.net/specs/openid-connect-backchannel-1_0.html)입니다. 해당 문서의 정확한 제공자 재시도 정책과 RP 내부 저장소의 회수 원자성은 이 노트가 확정하지 않습니다. 구현 전에 목표 OP의 지원 범위, endpoint 인증, retry와 만료 정책을 별도 확인해야 합니다.
