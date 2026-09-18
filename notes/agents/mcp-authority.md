---
id: agent-mcp-authority
title: MCP 토큰의 대상·발급자·실행 권한
topic: AI 에이전트
summary: HTTP OAuth의 resource·audience·issuer·PKCE·요청별 token 전달과 scope·대상 소유권·step-up·STDIO 자격 경계를 설명합니다.
questionIds: [agent-mcp-authorization]
---

# MCP 토큰의 대상·발급자·실행 권한

이 노트의 기본 모델은 자격을 세 층으로 나누는 것입니다. authorization server는 토큰을 발급하고, MCP server는 그 토큰이 자기 자원을 대상으로 하는지와 실행 권한을 검사하며, host는 사용자가 실제로 승인한 행동과 외부 전송 범위를 통제합니다. 어느 한 층의 성공을 다른 층의 승인으로 바꾸지 않아야 토큰 혼동과 권한 우회를 추적할 수 있습니다.

## 로그인 성공과 도구별 실행 승인

문서 read token이 있어도 delete scope나 다른 tenant 문서의 소유권은 없을 수 있습니다. host는 사용자 행동 승인·외부 전송 범위를, server는 token validity·scope·대상 접근을 검사합니다. 모델이 제안한 tenant ID를 인가 근거로 사용하지 않습니다.

실패를 진단할 때는 먼저 HTTP 401인지 403인지, 토큰의 issuer·audience·만료와 요청의 resource가 일치하는지, 마지막으로 tool 인자에 대한 사용자·tenant·소유권 검사가 통과했는지 순서대로 분리합니다. 예를 들어 유효한 read token으로 delete를 호출하면 인증 성공 뒤 실행 인가에서 멈춰야 하며, 다른 tenant ID를 인자에 넣었다고 권한이 생겨서는 안 됩니다. 이 순서는 재인가가 필요한 문제와 모델 입력을 거절해야 하는 문제를 구분하게 합니다.

## HTTP Token의 resource 지정과 intended audience 검증

2026-09-15 확인한 MCP 2026-07-28 인가 명세의 적용 대상은 HTTP transport입니다. 보호된 server의 resource metadata에서 authorization server를 찾은 뒤, 검증한 metadata의 issuer를 요청 기록에 저장합니다. authorization 요청과 token 요청 모두에서 resource에는 호출할 MCP server의 canonical URI를 지정합니다.

server는 token이 자신을 intended audience로 발급된 것인지 검증합니다. 다른 API token을 받아 그대로 하위 API로 통과시키는 token passthrough는 정상 위임이 아닙니다. 하위 서비스용으로 적절한 별도 자격·위임 흐름이 필요합니다.

```diagram
{"title":"토큰을 발급자와 대상 자원에 연결합니다","caption":"화살표는 인가 후 API 호출입니다. MCP 자격이 다른 하위 API의 포괄 자격으로 자동 전환되는 것은 아닙니다.","rows":[[{"id":"client","label":"client · 검증된 issuer·PKCE·resource"}],[{"id":"as","label":"authorization server · 제한된 token"}],[{"id":"mcp","label":"MCP server · audience·scope·대상 검사"}],[{"id":"downstream","label":"하위 API · 별도 적합한 자격"}]],"edges":[{"from":"client","to":"as","label":"사용자 인가·코드 교환"},{"from":"as","to":"mcp","label":"client가 대상 token으로 호출"},{"from":"mcp","to":"downstream","label":"적절한 위임 계약"}]}
```

## Issuer·PKCE의 검증 대상과 혼동 방지 범위

PKCE는 code 교환을 verifier에 묶지만 잘못된 issuer·redirect·resource로 자격을 보내는 문제를 전부 해결하지 않습니다. client credential은 발급 issuer별로 저장하고 server가 바뀌었다고 다른 issuer에 재사용하지 않습니다.

확인한 명세에서는 authorization response에 iss가 있으면 저장된 issuer와 비교합니다. metadata가 iss 지원을 광고했는데 응답에 iss가 없으면 거절하고, 지원을 광고하지 않았더라도 응답에 iss가 있으면 비교합니다. metadata가 iss 지원을 광고하지 않고 응답에도 iss가 없는 호환 경로를 임의 issuer를 받아들이는 것과 혼동하지 않습니다. 비교하기 전에 임의의 host case folding·trailing slash 정규화로 서로 다른 issuer를 하나로 합치지도 않습니다.

## Token 전달과 세부 실행 인가 검사

| 경계 | 검사 |
| --- | --- |
| HTTP request | Authorization 헤더·대상 server |
| token | 유효기간·issuer 신뢰·intended audience |
| tool 실행 | scope·사용자·tenant·대상 소유권 |
| 추가 권한 | 현재 작업의 step-up·사용자 승인 |
| 하위 API | 그 API에 맞는 자격·원래 위임 범위 |

token을 URL query·model 문맥·일반 로그에 넣지 않습니다. scope challenge는 현재 작업에 필요한 권한 설명이지 사용자 동의입니다. 기존 scope와 새 요구를 고려해 적절히 재인가하거나 중단하며 반복 횟수를 제한합니다. 401·403·만료·정책 거절을 모두 같은 무한 retry로 처리하지 않습니다. 거절을 다른 연결·다른 agent로 우회하지 않습니다.

재현 연습은 같은 요청을 (1) 토큰 없음, (2) 만료 토큰, (3) 올바른 issuer지만 다른 audience, (4) 올바른 토큰이지만 scope 부족, (5) 다른 tenant 대상으로 나눠 보내는 것입니다. 예상 결과는 각각 인증 요구, 401, audience 검증 실패, 403 또는 scope challenge, 대상 소유권 거절입니다. 이 노트의 범위에서는 실제 authorization server 연동을 실행하지 않았으므로 결과 코드는 배포한 server 계약으로 확정해야 합니다.

## STDIO와 HTTP OAuth 실행 경계

STDIO는 이 HTTP OAuth 흐름을 그대로 따르는 대신 환경 등에서 자격을 얻는 방식이 사용됩니다. 그렇다고 모든 host 환경 변수를 자식에 물려주어도 된다는 뜻은 아닙니다. 프로세스 권한·환경 비밀·생성 코드·로그 접근을 제한합니다.

잘못된 audience/issuer, 만료 token, scope 부족, 다른 tenant, 철회 뒤 retry, endpoint 변경을 시험합니다. 이 작업에서는 인가 server 연동 시험을 실행하지 않았습니다. 본문은 [MCP 2026-07-28 Authorization](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)의 확인된 계약과 방어 설계입니다.
