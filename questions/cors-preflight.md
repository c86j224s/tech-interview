---
id: cors-preflight
title: "웹 앱에서 다른 출처의 API에 요청했더니 OPTIONS가 먼저 전송되고 본 요청은 막힙니다. 브라우저는 무엇을 확인하며, 이 검사와 API 인증은 어떻게 다른가요?"
answerMinutes: 5
followups: [{"id":"csrf-vs-xss","prompt":"preflight가 발생하지 않는 쿠키 기반 POST가 서버에 도착할 수 있다면 CORS 외에 어떤 CSRF 방어를 적용해야 하나요?"},{"id":"http-get-post-semantics","prompt":"검색은 GET이고 등록은 POST인데 CORS 정책과 별개로 메서드 의미·캐시·재시도 계약을 어떻게 정하나요?"},{"id":"authentication-vs-authorization","prompt":"허용된 출처에서 보낸 인증 요청이라도 다른 사용자의 주문을 읽지 못하게 하려면 어떤 자원별 인가가 필요한가요?"}]
difficulty: 하
category: 웹
tags: ["CORS","출처","OPTIONS","preflight","credentials"]
related: ["csrf-vs-xss","authentication-vs-authorization"]
---

# 웹 앱에서 다른 출처의 API에 요청했더니 OPTIONS가 먼저 전송되고 본 요청은 막힙니다. 브라우저는 무엇을 확인하며, 이 검사와 API 인증은 어떻게 다른가요?

## 구두 답변

CORS preflight는 브라우저가 다른 출처의 실제 요청을 보내기 전에 서버가 해당 출처·메서드·요청 헤더 조합을 허용하는지 확인하는 절차입니다. 출처는 scheme·host·port의 조합이므로 host가 같아도 포트나 scheme이 다르면 교차 출처입니다. 이 검사는 브라우저가 응답을 읽도록 허용할지를 판단하는 정책이고, API 인증·인가나 서버의 신뢰 판단을 대신하지 않습니다.

### OPTIONS가 무엇을 묻는지 봅니다

단순 요청의 조건을 벗어난 메서드나 요청 헤더를 사용하면 브라우저가 자동으로 `OPTIONS`를 보냅니다. 여기에는 `Origin`, 사용하려는 메서드를 나타내는 `Access-Control-Request-Method`, 요청 헤더 목록인 `Access-Control-Request-Headers`가 들어갑니다. 서버는 `Access-Control-Allow-Origin`, `Access-Control-Allow-Methods`, `Access-Control-Allow-Headers`로 허용 범위를 응답합니다. 이 조합이 맞아야 브라우저가 실제 요청을 보내며, OPTIONS에 200을 반환했다고 실제 POST가 성공한 것은 아닙니다.

preflight handler는 정책 확인만 하고 주문 생성·삭제 같은 실제 부수 효과를 실행하지 않아야 합니다. 응답은 브라우저의 출처에 따라 동적으로 달라질 수 있으므로 캐시되는 응답의 `Vary: Origin`과 `Access-Control-Max-Age`를 함께 관리합니다. 정책을 바꿨는데 브라우저의 preflight 캐시가 남아 이전 허용이 유지될 수 있으므로 전환 시간을 검증하겠습니다.

### CORS와 인증·CSRF를 분리합니다

preflight 통과는 사용자가 로그인했다는 뜻이 아닙니다. 반대로 인증 실패 응답에 CORS 헤더가 없으면 브라우저 JavaScript가 그 응답 본문을 읽지 못할 수 있지만 서버가 인증을 수행하지 않아도 된다는 뜻은 아닙니다. 쿠키나 자격 정보를 교차 출처로 보낼 때 클라이언트의 credentials 설정과 서버의 `Access-Control-Allow-Credentials: true`가 맞아야 하며, credentials를 허용하면서 `Access-Control-Allow-Origin: *`를 사용할 수는 없습니다. 허용 출처는 필요한 정확한 목록으로 제한하고 임의의 Origin을 그대로 반사하지 않겠습니다.

CORS는 주로 브라우저의 응답 읽기 통제입니다. 단순 요청처럼 preflight가 없는 상태 변경은 서버까지 도착한 뒤 응답 읽기만 막힐 수 있으므로, 쿠키 기반 상태 변경에는 별도 CSRF 토큰·Origin 검증·SameSite 정책이 필요합니다. 서버 간 호출·네이티브 앱은 브라우저의 CORS 집행 주체가 아니므로, 서버는 그 호출도 인증·인가로 보호해야 합니다.

문제 분석에서는 브라우저가 실제로 보낸 Origin과 preflight 요청 헤더, 서버의 allow 응답, credentials 여부, preflight cache, 실제 요청 도착 여부를 순서대로 기록합니다. 테스트는 허용·비허용 출처, 허용·비허용 메서드·헤더, credentials와 wildcard 조합, preflight 없는 상태 변경, 인증 실패 응답을 포함합니다. 브라우저 콘솔의 CORS 오류만 고치는 것이 아니라 서버 정책과 API 보장을 각각 확인해야 합니다.

CORS 오류를 해결하려고 서버가 요청의 `Origin`을 무조건 `Access-Control-Allow-Origin`에 복사하는 구현은 허용 목록 검사가 아닙니다. 신뢰할 출처를 정규화해 정확히 비교하고, `Vary: Origin`이 필요한 동적 응답인지 확인하겠습니다. preflight 응답의 성공 코드는 정책 헤더와 함께 판단되며, 실제 요청이 인증·인가에서 거절될 수 있다는 점을 계약 테스트로 남깁니다. 또한 OPTIONS가 인증 없이 도달해야 하는 인프라에서는 preflight를 통과시키는 것과 실제 API를 인증 없이 허용하는 것을 라우팅 단계에서 분리합니다.

## 득점 포인트

- preflight의 Origin·요청 메서드·요청 헤더와 allow 응답의 역할을 설명한다.
- CORS의 브라우저 응답 읽기 통제와 API 인증·인가를 구분한다.
- credentials·wildcard·Vary·preflight cache의 조건을 제시한다.
- preflight 없는 실제 요청과 CSRF를 별도로 방어한다.

## 감점 포인트

- OPTIONS 성공을 사용자 인증 성공으로 해석한다.
- CORS가 서버의 자원 인가를 대신한다고 말한다.
- credentials와 `*`를 함께 허용해도 된다고 말한다.
- preflight가 없으면 요청도 서버에 도착하지 않는다고 단정한다.

## 더 파고들 거리

- 어떤 safelisted 조건을 벗어날 때 preflight가 생기는지 분류해 보세요.
- preflight cache가 정책 변경 뒤 남아 있는 동안 안전하게 전환하는 방법은 무엇일까요?
- 서버 간 호출과 네이티브 앱 호출에 CORS 대신 어떤 인증·인가 경계를 둘까요?
