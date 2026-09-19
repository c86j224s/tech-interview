---
id: browser-trusted-types-dom-sinks
title: Trusted Types와 DOM XSS sink
topic: 보안
summary: >-
  Trusted Types policy·CSP enforcement와 innerHTML 등 injection sink의 타입 경계를 출력
  인코딩·정화와 구분합니다.
questionIds: []
prerequisites:
  - browser-request-security
related:
  - browser-request-security
  - input-object-boundary
reviewedAt: '2026-09-19'
---
# Trusted Types와 DOM XSS sink

## DOM sink를 별도의 보안 경계로 보는 이유

XSS는 비신뢰 문자열이 HTML·스크립트·URL 같은 브라우저 문법으로 해석되는 순간 생깁니다. `textContent`처럼 텍스트로만 취급하는 API와 `innerHTML`, `outerHTML`, `insertAdjacentHTML`처럼 문자열을 문서 구조로 해석하는 API는 위험 경계가 다릅니다. Trusted Types는 이 sink에 전달되는 값을 단순 문자열에서 `TrustedHTML`, `TrustedScript`, `TrustedScriptURL`처럼 정책이 만든 신뢰 값으로 제한하는 브라우저·CSP 계약입니다.

이 기능은 sanitizer 자체가 아니며, 애플리케이션의 모든 XSS를 자동 수정하지도 않습니다. 정책이 위험한 문자열을 그대로 감싸는 wrapper라면 타입만 통과한 안전하지 않은 HTML이 다시 sink에 도착합니다. 따라서 “어떤 코드가 신뢰 값을 만들 수 있는가”와 “그 코드가 입력을 어떻게 정화하는가”를 나눠 설계합니다.

## 문자열 sink와 Trusted 값

Trusted Types enforcement의 사고 순서는 `문자열 입력 → 정책 함수 → 검증·정화된 Trusted 값 → 위험 sink`입니다. 애플리케이션이 직접 `element.innerHTML = userInput`을 수행하면 enforcement가 켜진 환경에서 차단되거나 보고 대상이 됩니다. 반면 `element.textContent = userInput`은 데이터로 표시하는 경로이므로 굳이 HTML 정책을 거치지 않는 편이 의미상 더 좁습니다.

정책 함수가 반환하는 `TrustedHTML`은 “이 정책을 통과했다”는 타입 의미를 담을 뿐, 신뢰 판단의 이유를 설명해 주지 않습니다. URL을 받는 `<script src>`나 동적 import 경로는 HTML 문서 정화와 다른 위험을 가지므로 `TrustedScriptURL` 경로와 허용 scheme·host·경로를 별도로 둡니다. 정책의 이름이나 결과 객체의 존재만 검사하고 실제 입력 출처와 허용 문법을 추적하지 않으면 방어가 형식에 그칩니다.

## CSP require-trusted-types-for 적용

CSP의 `require-trusted-types-for 'script'` 지시어는 지원 브라우저에서 script 관련 injection sink가 Trusted Types 값을 요구하도록 enforcement를 켜는 운영 장치입니다. 허용할 정책 이름을 제한하는 `trusted-types` 정책과 함께 사용하면 애플리케이션이 임의로 새 정책을 만드는 범위를 줄일 수 있습니다. 다만 CSP는 브라우저가 집행하는 계층이므로 서버 API, 네이티브 앱, 오래된 브라우저와 같은 다른 소비 경로를 대신 보호하지 않습니다.

enforce로 바로 전환하면 제3자 라이브러리나 오래된 컴포넌트가 sink를 호출해 정상 화면이 깨질 수 있습니다. 먼저 Report-Only 정책으로 위반 위치·stack·페이지·정책명을 수집하고, 보고 누락과 브라우저 지원을 고려한 뒤 코드를 바꿉니다. 보고가 0건인 것은 모든 경로가 안전하다는 증거가 아니라 해당 브라우저와 트래픽에서 관측되지 않았다는 뜻일 수 있습니다.

```diagram
{"title":"Trusted Types는 sink 앞에 타입 경계를 둡니다","caption":"CSP enforcement는 위험 sink의 문자열 입력을 제한하지만, 정책 함수 안의 정화 의미와 다른 출력 문맥은 애플리케이션이 책임집니다.","rows":[[{"id":"data","label":"비신뢰 문자열","detail":["사용자 입력 · 외부 문서"]}],[{"id":"safe","label":"안전한 DOM API","detail":["textContent · 속성 API"]},{"id":"policy","label":"Trusted Types policy","detail":["문맥별 정화","TrustedHTML 등"]}],[{"id":"sink","label":"DOM injection sink","detail":["innerHTML · script URL"]}],[{"id":"csp","label":"CSP enforcement","detail":["허용 정책·타입 검사"]}]],"edges":[{"from":"data","to":"safe","label":"문자열을 데이터로 표시"},{"from":"data","to":"policy","label":"HTML 문맥이면 입력"},{"from":"policy","to":"sink","label":"Trusted 값만 전달"},{"from":"safe","to":"sink","label":"가능하면 sink 우회"},{"from":"sink","to":"csp","label":"브라우저가 차단·보고"}]}
```

## Policy ownership과 sanitizer 경계

하나의 만능 policy가 모든 문자열을 HTML로 바꾸면 호출자는 입력의 출처와 문맥을 잊습니다. 문서 본문용 HTML, 제한된 링크용 URL, 정적 스크립트 URL은 정책과 허용 목록을 분리합니다. HTML sanitizer는 허용 요소·속성·URL scheme·상대 URL 해석·`base` 영향까지 최종 DOM 의미를 기준으로 검사해야 하고, 단순히 `<script>` 문자열을 삭제하는 정규식에 의존하지 않습니다.

정화 시점도 계약으로 정합니다. 저장 전에 정화할지, 출력 직전에 정화할지, 원문과 안전 표현을 각각 보관할지에 따라 재처리와 감사가 달라집니다. 정화된 값을 다시 템플릿·라이브러리가 조합하면서 `style`, event handler, URL 속성을 붙이면 최초 policy 결과의 의미가 깨질 수 있습니다. 정책을 호출할 수 있는 모듈을 좁히고, review 대상 sink와 policy 생성 위치를 코드 소유권으로 연결합니다.

## Report-Only에서 enforce로 가는 전환

전환은 헤더 한 줄을 바꾸는 일이 아니라 발견·수정·차단·되돌림 순서입니다. 첫 단계에서 모든 페이지와 사용자 흐름의 violation 보고를 수집하되 보고 endpoint에 입력 원문이나 민감 URL이 과도하게 남지 않게 합니다. 다음으로 stack trace를 기준으로 직접 sink, third-party sink, 테스트·관리자 경로를 구분하고 `textContent`나 구조화된 DOM API로 바꿉니다.

그 뒤 허용한 policy 생성 횟수와 Trusted 값의 문맥을 테스트합니다. enforce에서 차단된 요청은 단순히 policy를 넓혀 통과시키지 말고 원래 기능이 HTML이 필요한지, 더 좁은 표현이 가능한지 다시 판단합니다. CSP header와 HTML 응답을 shared cache가 섞어도 정책이 일관되는지, 캐시된 페이지에서 이전 정책과 새 스크립트가 혼합되지 않는지도 확인합니다. 롤백은 임시로 Report-Only를 복구할 수 있지만, 그 순간 차단 보장이 사라진다는 운영 상태를 명시합니다.

## 제3자 코드와 브라우저 지원 경계

서드파티 위젯은 자체적으로 sink를 호출하거나 policy를 만들 수 있습니다. 조직이 policy 이름을 허용 목록으로 제한해도 그 내부 구현의 정화 품질까지 검증해 주지는 않습니다. 위젯을 별도 origin이나 iframe으로 격리할 수 있는지, 데이터만 postMessage로 교환할지, 필요한 최소 sink만 wrapper로 제공할지 선택합니다.

Trusted Types가 지원되지 않는 브라우저에서는 CSP enforcement가 같은 방식으로 작동하지 않을 수 있습니다. 이 경우 기본 escaping, 안전한 DOM API, sanitizer, CSP, 자원 인가가 계속 필요합니다. feature detection 뒤에 보안 검사를 생략하는 fallback을 만들지 않고, 지원 브라우저·미지원 브라우저 모두에서 최종 DOM이 의도한 구조인지 비교합니다.

일반 링크의 `href`를 위한 범용 TrustedURL 타입이 존재하는 것은 아닙니다. `TrustedScriptURL`은 스크립트 로딩 문맥용이며, 일반 탐색 URL은 애플리케이션의 scheme·host 검증으로 제한합니다. 여기서 URL 정책은 그런 애플리케이션 검증 함수를 뜻합니다.

## 검증 사례와 남는 한계

`innerHTML = userInput`은 enforce 환경에서 보고 또는 차단되고, `policy.createHTML(userInput)`은 policy 내부의 sanitizer가 공격 문자열을 제거할 때만 안전한 흐름이 됩니다. HTML policy로 `javascript:` URL을 처리하려고 하면 문맥이 섞이므로 URL policy 또는 아예 링크 전용 API를 사용해야 합니다. 템플릿이 비신뢰 문자열로 script 태그를 생성하거나 제3자 코드가 정책을 만들 수 있는 사례도 별도로 확인합니다.

이 방어는 DOM sink로 연결되는 코드 경로를 줄이는 보조 계층입니다. 서버가 안전하지 않은 HTML을 저장하거나 CSP가 허용한 신뢰 script가 자체적으로 `innerHTML`을 호출하는 경우는 여전히 검토 대상입니다. 실제 브라우저별 sink 목록과 정책 이름 지원은 목표 브라우저에서 실행해 확인해야 하며, 이 노트는 W3C Editor’s Draft를 읽은 설계 설명이지 브라우저 호환성 시험 결과가 아닙니다.

## 참고 자료와 적용 순서

근거는 [W3C Trusted Types Editor’s Draft](https://w3c.github.io/trusted-types/dist/spec/)와 저장소의 [쿠키 요청 위조와 스크립트 실행의 다른 경계](/tech-interview/notes/browser-request-security/)입니다. 구현 순서는 sink inventory 작성, 문자열 sink를 안전한 API로 축소, 문맥별 policy·sanitizer 계약 정의, Report-Only 관찰, 제3자 경로 정리, enforce 전환 순서가 됩니다. 브라우저 지원 버전, sanitizer 구현과 캐시 계층은 이 문서만으로 확정하지 않았으므로 배포 환경에서 따로 검증해야 합니다.
