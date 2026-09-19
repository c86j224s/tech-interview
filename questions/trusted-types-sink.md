---
id: trusted-types-sink
title: Trusted Types가 innerHTML 같은 DOM sink의 어떤 문제를 줄이나요?
difficulty: 중하
category: 보안
tags:
  - Trusted Types
  - DOM XSS
  - 브라우저
related:
  - security-csp-nonce
---
# Trusted Types가 innerHTML 같은 DOM sink의 어떤 문제를 줄이나요?

## 구두 답변

Trusted Types의 핵심 효과는 `innerHTML` 같은 DOM injection sink에 임의 문자열이 직접 도달하는 경로를 브라우저 타입 경계에서 드러내고 제한하는 것입니다. `element.innerHTML = userInput`처럼 값이 HTML로 해석되는 코드는 enforcement가 적용된 지원 환경에서 TrustedHTML이 아니면 보고되거나 차단됩니다. 먼저 HTML이 필요하지 않은 화면이라면 `textContent`나 구조화된 `createElement`·`setAttribute`로 바꾸는 것이 더 좁은 설계입니다. 제한된 서식이 필요할 때만 policy의 `createHTML()`에 입력을 보내고 sanitizer가 허용한 결과를 `TrustedHTML`로 반환하게 합니다. `require-trusted-types-for 'script'`는 이 sink 계약을 CSP로 집행하지만 서버 권한이나 저장 데이터 검증을 대신하지 않습니다.

예를 들어 `<img onerror=...>`가 포함된 사용자 문자열을 만능 wrapper가 그대로 TrustedHTML로 감싸면 타입 검사는 통과해도 XSS는 남습니다. HTML 문서, `href`, 동적 script URL은 서로 다른 문맥이므로 하나의 policy로 합치지 않고, URL은 파싱 후 scheme·host·경로를 allowlist로 확인하거나 안전한 링크 API로 처리합니다. CSP nonce가 있는 script도 실행 후 `innerHTML`을 호출할 수 있으므로 Trusted Types가 발견하는 sink와 코드 리뷰를 함께 운영합니다. policy 생성 권한과 호출 모듈을 제한하고, 지원하지 않는 브라우저에서는 escaping·안전한 DOM API·sanitizer를 계속 적용합니다. enforcement가 모든 DOM XSS와 서버 저장 HTML을 자동 수정한다는 주장은 범위를 넘습니다.

일반 링크의 `href`를 위한 범용 TrustedURL 타입이 존재하는 것은 아닙니다. `TrustedScriptURL`은 스크립트 로딩 문맥용이며, 일반 탐색 URL은 애플리케이션의 scheme·host 검증으로 제한합니다. 여기서 URL 정책은 그런 애플리케이션 검증 함수를 뜻합니다.

## 득점 포인트

- TrustedHTML 타입 경계와 policy 내부 sanitizer 책임을 분리합니다.
- innerHTML 대신 textContent·구조화 DOM을 먼저 선택합니다.
- HTML·URL·script URL 문맥과 미지원 브라우저 fallback을 설명합니다.

## 감점 포인트

- Trusted Types가 모든 XSS를 자동 수정한다고 말합니다.
- policy wrapper나 CSP nonce만으로 안전성을 증명합니다.

## 더 파고들 거리

- 제3자 위젯이 sink를 호출할 때 격리와 review를 어떻게 적용하겠습니까?
- 공격 fixture에서 sanitizer와 최종 DOM을 어떤 기준으로 검사하겠습니까?
