---
id: cors
title: CORS preflight와 API 보호의 경계
topic: 웹
summary: 교차 출처 JSON 요청의 OPTIONS·실제 요청·응답 노출을 추적하고 credentials·캐시·CSRF·인가를 구분합니다.
questionIds: [cors-preflight, cors-safelisted-request-boundary, cors-preflight-cache-policy-change]
---

# CORS preflight와 API 보호의 경계

## OPTIONS 성공은 주문 생성 성공이 아닙니다

예를 들어 `https://app.example`의 브라우저가 `https://api.example`로 JSON POST를 시작하면, 본문을 보내기 전에 OPTIONS를 보낼 수 있습니다. 이 **preflight**는 출처·요청 메서드·요청 헤더 조합을 서버에 미리 보내 브라우저가 그 조건의 실제 요청을 진행해도 되는지 확인하는 단계입니다. 서버가 OPTIONS를 허용해도 이어지는 실제 POST에서는 인증·인가·입력 검사를 다시 수행해야 합니다.

출처는 scheme·host·port의 조합입니다. 같은 host라도 포트나 scheme이 다르면 교차 출처가 될 수 있습니다. CORS는 브라우저가 집행하는 교차 출처 응답 접근 규칙이지 서버 간 호출을 막는 방화벽이 아닙니다.

## 정책 확인과 실제 요청을 나눕니다

```http
OPTIONS /orders
Origin: https://app.example
Access-Control-Request-Method: POST
Access-Control-Request-Headers: content-type
```

허용된 조합이면 서버는 정확한 허용 출처·메서드·헤더를 응답합니다. 다음은 개념적인 응답 헤더 예이며 실제 credentials 정책과 캐시 구성을 함께 맞춰야 합니다.

```http
Access-Control-Allow-Origin: https://app.example
Access-Control-Allow-Methods: POST
Access-Control-Allow-Headers: Content-Type
Vary: Origin
```

```diagram
{"title":"브라우저 정책과 서버 인가는 별도입니다","caption":"화살표는 preflight가 필요한 요청의 순서입니다. OPTIONS는 작업을 실행하지 않으며 실제 POST가 도착한 뒤 서버가 인증·인가를 검사합니다.","rows":[[{"id":"browser","label":"브라우저 fetch"}],[{"id":"preflight","label":"OPTIONS 정책 확인"}],[{"id":"request","label":"실제 POST","detail":["인증 · 인가 · 입력 검사"]}],[{"id":"response","label":"응답 접근 검사","detail":["JS에 응답을 노출할지 판단"]}]],"edges":[{"from":"browser","to":"preflight","label":"허용 조합 질의"},{"from":"preflight","to":"request","label":"통과한 경우"},{"from":"request","to":"response","label":"실제 응답"}]}
```

실제 응답에도 필요한 CORS 헤더가 있어야 JS가 내용을 읽을 수 있습니다. 인증 오류 응답에 헤더가 빠지면 프런트는 상세 오류 대신 CORS 실패를 볼 수 있지만 서버에서 인증하지 않았다는 뜻은 아닙니다.

## 모든 교차 출처 요청이 preflight를 하지는 않습니다

모든 교차 출처 요청이 preflight를 거치는 것은 아닙니다. GET·HEAD·POST 중 일부 요청이 safelisted 헤더와 `Content-Type` 조건을 함께 만족하면 브라우저는 OPTIONS 없이 실제 요청을 먼저 보낼 수 있습니다.

대표적인 폼 `Content-Type`은 `application/x-www-form-urlencoded`, `multipart/form-data`, `text/plain`입니다. 다만 추가 헤더의 값과 업로드 방식 같은 세부 조건도 함께 판정하므로, 이 목록만으로 모든 경우를 분류하면 안 됩니다.

`application/json`이나 사용자 정의 헤더·PUT·DELETE 등은 보통 preflight 조건과 관련됩니다. OPTIONS가 없었다고 보안 검사가 불필요하거나 서버에 요청이 도착하지 않았다고 가정하면 안 됩니다. 일부 요청은 서버 상태를 바꾼 뒤 브라우저에서 응답 읽기만 차단될 수 있습니다.

## Credentials는 양쪽 정책과 쿠키 규칙이 필요합니다

교차 출처 쿠키 요청은 클라이언트 credentials 설정과 서버 `Access-Control-Allow-Credentials:true`가 맞아야 응답 접근이 허용됩니다. 이때 Allow-Origin은 `*`가 아니라 허용한 정확한 origin이어야 합니다. 요청 Origin을 무조건 반사하면 허용 목록 검사가 아닙니다.

CORS 허용이 있어도 SameSite·Secure·브라우저의 제3자 쿠키 제한 등 별도 규칙으로 쿠키가 전송되지 않을 수 있습니다. preflight 자체에는 일반적으로 자격 증명을 싣지 않는 계약이므로 OPTIONS 라우팅과 실제 API 인증을 구분합니다. 프록시에서 모든 OPTIONS에 인증 리다이렉트를 강제하면 정상 흐름을 막을 수 있습니다.

| 장치 | 보호하는 질문 |
| --- | --- |
| CORS | 이 브라우저 출처가 응답을 읽어도 되는가 |
| 인증 | 누구의 요청인가 |
| 인가 | 이 주체가 이 자원을 변경해도 되는가 |
| CSRF 방어 | 사용자의 자격이 원하지 않은 요청에 이용됐는가 |

쿠키가 자동 전송되는 상태 변경에는 CSRF 토큰·Origin 검증·SameSite 등 정책이 필요합니다. CORS를 허용하지 않았다는 이유만으로 상태 변경 공격이 차단됐다고 결론 내리지 않습니다.

## 캐시된 허용은 현재 인가를 대체하지 않습니다

`Access-Control-Max-Age`로 preflight 결과가 브라우저에 남을 수 있습니다. 정책을 바꿔 OPTIONS에서 거절하더라도 이전 허용을 가진 브라우저는 실제 요청을 보낼 수 있습니다. 원본 endpoint가 모든 요청에 현재 권한·상태 규칙을 적용해야 합니다.

출처별로 Allow-Origin을 다르게 반환하는 공유 캐시 응답에는 Vary 등 올바른 캐시 키가 필요합니다. 요청 메서드·헤더에 따라 preflight 응답 내용이 달라지고 중간 캐시에 보관한다면 그 변형 차이도 설계해야 합니다. 브라우저 preflight 캐시와 일반 HTTP 캐시를 같은 저장소라고 생각하지 않습니다.

## 실패 지점을 순서대로 확인합니다

문제가 나면 브라우저 Network에서 해당 요청의 `Origin`, 메서드, 요청 헤더와 `credentials` 설정을 먼저 확인하고, preflight를 보낸 경우에는 OPTIONS 응답과 실제 요청이 서버에 도착했는지를 시간순으로 봅니다. 실제 요청이 실행됐는데 응답을 읽지 못했다면 실제 응답의 CORS 헤더를 확인하고, 서버 로그에서도 OPTIONS의 결과와 실제 작업의 결과를 별도 요청으로 나눠 정책 거절·인증 실패·작업은 실행됐지만 응답 접근만 막힌 경우를 구분합니다.

마지막으로 허용·비허용 출처, JSON·폼 요청, 인증 실패, 기존 preflight 캐시와 정책 변경을 각각 재현합니다.

브라우저 콘솔의 오류를 없애려고 모든 출처를 반사하거나 인증을 제거하지 않습니다. 응답 접근 정책과 실제 상태 변경의 보안 검사가 각각 맞는지를 확인해야 합니다.
