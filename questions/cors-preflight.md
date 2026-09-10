---
id: cors-preflight
title: "웹 앱에서 다른 출처의 API에 요청했더니 OPTIONS가 먼저 전송되고 본 요청은 막힙니다. 브라우저는 무엇을 확인하며, 이 검사와 API 인증은 어떻게 다른가요?"
difficulty: 하
category: 웹
tags: ["CORS","출처","OPTIONS","preflight","credentials"]
related: ["csrf-vs-xss","authentication-vs-authorization"]
---

# 웹 앱에서 다른 출처의 API에 요청했더니 OPTIONS가 먼저 전송되고 본 요청은 막힙니다. 브라우저는 무엇을 확인하며, 이 검사와 API 인증은 어떻게 다른가요?

## 구두 답변

CORS preflight는 브라우저가 다른 출처의 요청을 보내기 전에 서버가 그 조합을 허용하는지 확인하는 절차입니다. 출처(origin)는 스킴, 호스트, 포트의 조합이므로 호스트 이름만 같아도 포트나 스킴이 다르면 다른 출처일 수 있습니다. 단순 요청 조건을 벗어난 메서드나 요청 헤더를 사용하면 브라우저가 자동으로 `OPTIONS` 요청을 보냅니다. 이 요청에는 `Origin`, 실제로 사용하려는 메서드를 나타내는 `Access-Control-Request-Method`, 요청 헤더 목록을 나타내는 `Access-Control-Request-Headers`가 포함됩니다.

서버는 허용할 출처·메서드·헤더를 `Access-Control-Allow-*` 응답 헤더로 알려 줍니다. 검사가 통과해야 브라우저가 실제 요청을 보내며, 서버가 OPTIONS에 200을 반환했다는 사실만으로 실제 요청까지 성공한 것은 아닙니다. 서버는 preflight에서 실제 등록·수정 작업을 실행하지 않고, 허용 정책을 확인해 응답해야 합니다. 브라우저는 preflight 결과를 일정 기간 캐시할 수도 있어 `Access-Control-Max-Age`와 정책 변경 시점도 함께 관리합니다.

CORS는 브라우저의 출처 간 응답 읽기 통제이고 사용자 인증은 요청자가 누구인지 확인하는 별도 문제입니다. preflight를 통과했다고 사용자가 로그인한 것은 아니며, 반대로 인증 실패 응답에 CORS 헤더가 없으면 브라우저 코드가 그 응답을 읽지 못할 수 있습니다. 쿠키나 인증정보를 포함하려면 클라이언트의 credentials 설정과 서버의 `Access-Control-Allow-Credentials: true`가 맞아야 하고, credentials를 허용하면서 `Allow-Origin: *`를 사용할 수는 없습니다.

CORS는 악성 사이트가 사용자의 브라우저 권한으로 응답을 읽는 것을 제한하지만, 쿠키 기반 상태 변경을 자동으로 보내는 문제를 CSRF 방어 대신 해결하지는 않습니다. 따라서 preflight 없는 요청은 서버에 이미 도착한 뒤 브라우저의 응답 읽기만 차단될 수도 있으므로, 서버는 CORS 허용 목록, 인증·인가, CSRF 방어를 각각 설계하고 실제 요청의 서버 검증을 생략하지 않겠습니다.

## 득점 포인트

- preflight의 자동 OPTIONS와 세 가지 요청 헤더의 역할을 설명한다.
- CORS와 사용자 인증·인가 및 CSRF를 다른 경계로 구분한다.
- credentials와 와일드카드 출처의 제약을 구체적으로 말한다.

## 감점 포인트

- OPTIONS 응답이 성공하면 사용자가 인증된 것으로 본다.
- CORS가 서버의 API 인가를 대신한다고 말한다.
- 쿠키를 포함하면서 모든 출처에 `*`를 허용해도 된다고 말한다.

## 더 파고들 거리

- 어떤 요청이 CORS safelisted 조건을 벗어나 preflight를 유발하는지 분류해 보세요.
- preflight 캐시가 정책 변경 후에도 남을 때 운영 전환을 어떻게 검증할까요?
- 서버 간 호출이나 네이티브 앱 호출에서 브라우저 CORS가 적용되지 않는 이유는 무엇인가요?
