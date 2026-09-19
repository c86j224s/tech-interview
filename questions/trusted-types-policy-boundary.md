---
id: trusted-types-policy-boundary
title: Trusted Types policy를 하나의 만능 sanitizer로 만들면 왜 위험한가요?
difficulty: 중하
category: 보안
tags:
  - Trusted Types
  - sanitization
  - 정책
related:
  - html-sanitization-url-schemes
---
# Trusted Types policy를 하나의 만능 sanitizer로 만들면 왜 위험한가요?

## 구두 답변

Trusted Types가 보장하는 것은 “어떤 타입의 값이 sink에 들어갔는가”이지 “그 타입을 만든 함수의 판단이 올바른가”가 아닙니다. 따라서 하나의 만능 policy가 모든 문자열을 `TrustedHTML`로 감싸면 입력 출처와 sink 문맥이 사라집니다. 게시물 본문은 허용 요소·속성·URL scheme을 가진 HTML sanitizer가 필요하지만, `href`는 URL parser로 scheme·host·경로와 상대 URL 기준을 검사해야 합니다. 동적 script URL은 더 좁은 `TrustedScriptURL` 경계와 정적 allowlist를 사용하거나 동적 구성을 없애는 편이 낫습니다. 이름이 `safePolicy`라는 사실은 어떤 검사를 했는지 증명하지 않습니다.

구체적으로 댓글 문자열 `<a href="javascript:...">`를 HTML policy에 넣는 흐름과 링크 입력을 URL policy에 넣는 흐름을 분리합니다. 전자는 허용 태그와 속성을 정화하고, 후자는 URL을 해석해 javascript/data 같은 scheme과 허용되지 않은 외부 host를 거절합니다. 저장 시 정화했다면 렌더링 템플릿이 나중에 event handler나 다른 URL 속성을 붙이지 않는지 재검사하고, 원문 보관 여부는 감사·재처리 요구와 별도로 결정합니다. policy 생성은 전역 호출자에게 열지 않고 신뢰한 모듈과 코드 소유권에 묶습니다. 가능한 sink를 안전한 DOM API로 먼저 없앤 뒤 남은 policy만 Report-Only로 관찰하고, enforce 오류를 없애려고 모든 문자열을 감싸는 fallback을 만들지 않습니다.

일반 링크의 `href`를 위한 범용 TrustedURL 타입이 존재하는 것은 아닙니다. `TrustedScriptURL`은 스크립트 로딩 문맥용이며, 일반 탐색 URL은 애플리케이션의 scheme·host 검증으로 제한합니다. 여기서 URL 정책은 그런 애플리케이션 검증 함수를 뜻합니다.

## 득점 포인트

- Trusted Types는 타입 흐름만 강제하고 policy 의미는 애플리케이션 책임임을 말합니다.
- HTML·URL·script URL마다 입력 파싱과 allowlist를 분리합니다.
- policy 생성 권한과 저장·재조합 시점의 경계를 구체화합니다.

## 감점 포인트

- 모든 문자열을 하나의 TrustedHTML policy로 감쌉니다.
- attribute escape나 policy 이름만으로 javascript scheme을 해결합니다.

## 더 파고들 거리

- 원문 보관과 저장 시 정화 중 어떤 선택이 재처리에 유리한지 비교해 보세요.
- base 요소와 상대 URL이 policy 결과에 미치는 영향을 어떻게 시험하겠습니까?
