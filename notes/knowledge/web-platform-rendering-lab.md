---
id: web-platform-rendering-lab
title: 웹 플랫폼 렌더링 관찰 실습
topic: 웹
summary: 작은 접근 가능한 아코디언으로 DOM·CSSOM·computed style·레이아웃 기하·CSS 방법론·프레임 측정의 책임과 실패 경계를 직접 추적합니다.
questionIds: []
prerequisites: [web-platform-tooling, css-cascade, css-reset, event-delegation, rendering-layout]
related: [browser-navigation, hydration]
reviewedAt: '2026-09-18'
---

# 웹 플랫폼 렌더링 관찰 실습

## 실습의 경계

브라우저 화면은 HTML 문자열이 곧 픽셀이 되는 과정이 아닙니다. HTML을 파싱해 DOM 트리를 만들고, CSS 규칙을 매칭해 CSSOM과 계산 스타일을 얻고, 그 결과로 레이아웃 상자의 크기와 위치를 계산한 뒤, 필요한 영역을 paint하고 합성합니다. 이 설명은 유용한 책임 모델이지만 모든 브라우저의 내부 구현이 같은 전역 순서로 실행된다는 뜻은 아닙니다. 변경의 종류와 무효화 범위에 따라 일부 결과를 재사용할 수 있습니다.

이 실습은 이 모델에서 관찰 가능한 경계를 고릅니다. DOM 속성은 `aria-expanded`와 `hidden`으로 확인하고, CSSOM은 `getComputedStyle()`로 최종 값을 읽으며, 레이아웃은 `getBoundingClientRect()`로 기하를 측정합니다. `::after`의 generated content도 CSSOM에서 확인합니다. 실제 paint 명령, raster 타일, GPU 레이어 생성은 개발자 도구의 별도 trace 대상이며 이 lab이 자동으로 증명하지 않습니다.

기존 [URL 입력부터 화면 표시까지의 의존 경로](/tech-interview/notes/browser-navigation/), [레이아웃 계산과 화면 이동](/tech-interview/notes/rendering-layout/), [CSS 선언의 승자와 상속 경계](/tech-interview/notes/css-cascade/), [기본 스타일 정리와 폼 접근성 보존](/tech-interview/notes/css-reset/), [DOM 이벤트 위임의 대상과 전파 경계](/tech-interview/notes/event-delegation/)를 실행 가능한 작은 흐름으로 묶는 것이 이 실습의 목적입니다. 브라우저의 모든 기능이나 CSS 방법론 전체를 다루지는 않습니다.

## 핵심 모델

아코디언의 초기 상태를 `S0 = { expanded: false }`라고 하겠습니다. 버튼의 `aria-expanded="false"`와 패널의 `hidden`은 같은 논리 상태를 다른 계약으로 표현합니다. 사용자가 버튼을 누르면 다음 순서가 필요합니다.

```diagram
{"title":"아코디언 상태에서 화면 관찰까지","caption":"DOM 상태를 먼저 갱신하고 CSSOM과 기하를 같은 브라우저 시점에 읽는 실습 흐름입니다. paint와 합성은 이 lab의 자동 관찰 범위 밖입니다.","rows":[[{"id":"input","label":"button 입력","detail":["Enter·Space·click","native button"]}],[{"id":"dom","label":"DOM 상태 S1","detail":["aria-expanded","panel.hidden"]}],[{"id":"cssom","label":"CSSOM 관찰","detail":["computed style","generated content"]}],[{"id":"layout","label":"기하 관찰","detail":["getBoundingClientRect"]}]],"edges":[{"from":"input","to":"dom","label":"상태 전이"},{"from":"dom","to":"cssom","label":"스타일 계산 결과"},{"from":"cssom","to":"layout","label":"상자 측정"}]}
```

`aria-controls`는 버튼이 제어하는 패널의 ID를 가리키고, `aria-expanded`는 패널의 표시 상태와 일치해야 합니다. `button`을 사용했으므로 키보드 활성화, 포커스, 이름과 역할의 기본 계약을 `div`에 다시 구현하지 않아도 됩니다. 다만 CSS로 outline을 지우거나 native control을 넓게 reset하면 별도의 접근성 문제가 생기므로 `:focus-visible`과 실제 상태 표시를 함께 검사해야 합니다.

CSS 방법론은 이 흐름에 이름과 소유권을 부여하는 관점입니다. `accordion`은 BEM의 block, `accordion__trigger`는 element, `accordion--dense`와 `accordion--warning`은 modifier입니다. SMACSS의 Base/Layout/Module/State/Theme은 분류 체계이고, OOCSS의 구조/skin 및 container/content 분리는 재사용 경계를 설명하는 지침입니다. 어느 방법론도 cascade의 승자나 브라우저의 접근성 보장을 대신하지 않습니다.

## 작동 상태 추적

초기 HTML에서 브라우저는 버튼과 패널을 DOM에 넣습니다. 패널에는 `hidden`이 있으므로 기본 관찰에서 `getComputedStyle(panel).display`는 일반적인 표시 상자와 다르게 계산될 수 있습니다. 사용자가 버튼을 누르면 `setExpanded(true)`가 `aria-expanded`를 `true`로 바꾸고 `panel.hidden = false`로 바꿉니다. 그 다음 아이콘 문자를 갱신하고 `getComputedStyle(trigger)`와 `getComputedStyle(trigger, '::after')`를 읽습니다. 마지막으로 `trigger.getBoundingClientRect()`를 읽어 현재 viewport 기준 상자의 폭·높이·위치를 trace에 남깁니다.

예를 들어 variant가 기본이고 버튼 상자 폭이 480px, 높이가 52px인 환경에서 열린 상태를 읽었다고 합시다. trace에는 `aria-expanded=true`, `display=flex`, `rect=480×52`와 같은 값이 나타날 수 있습니다. 이 숫자는 설명용 상태 trace이며 폰트·viewport·브라우저마다 달라집니다. 중요한 것은 숫자 그 자체가 아니라 DOM 논리 상태, 최종 CSS 값, 기하 결과가 같은 사용자 행동 뒤에 어떤 순서로 관찰되는지입니다.

닫기에서는 `aria-expanded=false`와 `hidden=true`가 다시 함께 바뀌어야 합니다. 둘 중 하나만 바꾸면 보조 기술이 듣는 상태와 실제 화면이 달라질 수 있습니다. `hidden`은 단순히 opacity를 0으로 만드는 스타일과 같지 않으므로, 접근성 트리·포커스·페이지 내 검색까지 같은 것으로 취급하지 않습니다.

## 소스 구조 해설

`index.html`은 의미 있는 `main`, 제목, 실제 `button`, `aria-controls`, `aria-expanded`, `role="region"`, `aria-labelledby`를 제공합니다. 패널 안의 설명은 열렸을 때 읽을 수 있는 일반 콘텐츠입니다. 실패 주입 버튼은 교육용으로만 상태를 깨며, 보안 인가나 서버 검증을 흉내 내지 않습니다.

`styles.css`에서 `.accordion`은 구조와 공통 경계를 소유하고, `accordion--dense`와 `accordion--warning`은 변형을 소유합니다. `.button--primary`, `.button--secondary`, `.button--danger`도 skin과 역할을 명시적으로 분리한 실제 variant입니다. 낮은 레이어를 이용한 cascade 실험 대신 파일을 작게 유지했지만, computed style을 읽는 이유는 선언한 색이 최종 승자라는 가정을 피하기 위해서입니다. `::after`는 trigger의 generated content를 만들어 pseudo-element와 실제 DOM 텍스트가 다르다는 점을 관찰하게 합니다.

`app.js`의 `record()`는 사용자 행동과 관찰 결과를 시간순으로 남깁니다. `readRenderState()`는 DOM attribute를 읽은 뒤 CSSOM과 기하를 읽습니다. `setExpanded()`는 상태 전이를 한 곳에 모아 `aria-expanded`와 `hidden`의 불일치를 줄입니다. variant 버튼은 기존 의미 요소를 교체하지 않고 block에 modifier class만 바꿉니다. 프레임 측정은 custom property를 한 번 쓰고 `getBoundingClientRect()`를 한 번 읽어 읽기·쓰기 교차를 의도적으로 작게 만들지만, 이 duration은 layout·paint 전체 시간이나 다른 컴포넌트의 비용이 아닙니다.

`server.mjs`는 로컬 정적 서버의 운영 경계를 보여줍니다. `127.0.0.1`에만 바인드하고 GET/HEAD만 허용하며, 경로 정규화로 root escape를 거부하고, 응답 파일 크기를 512KiB로 제한하고, SIGINT/SIGTERM에서 서버 close를 기다립니다. 외부 CDN, 인증, 결제, 원격 API는 없습니다. Playwright 설정은 한 worker와 10초 테스트 제한을 사용하고, 서버를 테스트 수명 동안 띄웠다가 정리합니다.

## 실행 절차

저장소 루트에서 기존 Playwright 의존성을 사용합니다. 설정은 설치된 Chrome 채널을 사용하며 테스트 동안 loopback 서버를 시작하고 종료합니다.

```sh
node --check examples/knowledge/web-platform-lab/server.mjs
node --check examples/knowledge/web-platform-lab/app.js
npx playwright test --config=examples/knowledge/web-platform-lab/playwright.config.mjs
```

네 테스트는 아코디언 상태, 스타일 변형, 의도한 불일치와 복구, 폭 400px의 수평 overflow를 검사합니다. 2026-09-18 Node 26과 설치된 Chrome에서 4개 모두 통과했습니다. 번들 Chromium은 설치되어 있지 않아 그 채널의 초기 실행은 실패했으며, Chrome으로 수행한 결과와 구분합니다.

## 고장 주입과 진단

`계약 깨기`는 의도적으로 `aria-expanded`만 반전시키고 `panel.hidden`은 그대로 둡니다. 예를 들어 패널이 닫힌 상태에서 attribute만 `true`가 되면 `expectedHidden=false`인데 실제 `panel.hidden=true`가 되어 FAIL이 됩니다. 이것은 화면을 보면서 “버튼은 열렸다고 말하는데 패널은 보이지 않는다”를 재현하는 최소 상태입니다.

진단은 다음 순서로 합니다. `diagnostic`이 갱신되지 않으면 click listener 또는 module 초기화 오류를 먼저 확인합니다. FAIL이 아니라 PASS라면 검사 함수가 attribute와 property를 실제로 읽는지 확인합니다. `aria-controls`가 잘못되면 패널 ID와 버튼 attribute를 대조합니다. keyboard test가 실패하면 실제 button의 focus와 Enter/Space를 먼저 확인한 뒤, reset이나 pointer 이벤트 중복 연결을 살핍니다. rect가 0이면 hidden, display, 초기화 시점의 차이를 확인하며, rect가 달라졌다는 사실만으로 paint 병목을 주장하지 않습니다.

브라우저 개발자 도구에서는 Elements의 DOM attribute와 Accessibility pane을 함께 보고, Styles/Computed에서 최종 선언과 pseudo-element를 확인합니다. Performance trace에서는 Style Recalculation, Layout, Paint, Composite와 long task를 별도로 봅니다. 이 lab의 frame duration은 해당 trace를 대체하지 않으며, 측정하지 않은 paint·합성 비용을 이 숫자로 추정하지 않습니다.

## 방법론의 선택 기준

BEM은 컴포넌트 이름과 변형이 명확하고 markup과 CSS를 함께 소유할 때 적합합니다. 이미 상태가 데이터 속성이나 ARIA로 표현되는 경우 modifier class를 추가해 상태의 단일 소유자를 만들지 않도록 합니다. SMACSS는 큰 stylesheet에서 Base, Layout, Module, State, Theme의 범주와 파일·규칙 책임을 정리할 때 유용하지만, 분류를 늘리는 것만으로 cascade 충돌이 해결되지는 않습니다. OOCSS는 구조와 시각 skin을 여러 맥락에서 재사용할 때 유리하지만, 모든 시각 변형을 독립 객체로 쪼개면 markup과 의미 관계가 오히려 복잡해질 수 있습니다.

이 lab의 결정은 작고 실행 가능한 한 컴포넌트입니다. 아코디언의 구조는 `.accordion`, 반복 가능한 버튼 모양은 `.button`, 상태는 `aria-expanded`와 `hidden`, 시각 변형은 modifier class가 소유합니다. SSR과 CSR을 별도 대안으로 이중 구현하지 않습니다. 이 페이지는 정적 HTML을 먼저 제공하고 단일 client module이 이벤트를 연결하는 구조이므로, 서버가 같은 UI를 다시 그리는 hydration 실험이 아니라 DOM/CSSOM 관찰 실험입니다. SSR/CSR·hydration의 초기 상태 일치는 [서버 HTML과 hydration의 초기 상태 계약](/tech-interview/notes/hydration/)에서 별도로 다룹니다.

## 검증 범위

Node 문법 검사, 로컬 서버 GET/POST 경계, Chrome Playwright 4개 테스트를 실행했습니다. WebKit·Firefox, 실제 모바일 기기, paint·GPU trace, 스크린리더와 전체 키보드 상호작용 매트릭스는 검증하지 않았습니다. 코드의 duration은 짧은 JavaScript 쓰기·읽기 구간이지 프레임 전체 렌더링 시간이나 성능 벤치마크가 아닙니다.

표준·가이드의 안정성과 초안 상태도 분리합니다. DOM Standard는 확인 당시 Living Standard 페이지였지만 이후 수정 가능성이 있습니다. CSSOM Editor’s Draft와 CSS Pseudo Level 4 Working Draft는 초안이므로 현재 구현의 보장으로 확장하지 않습니다. ARIA APG는 아코디언 상호작용 지침으로 사용했지만 확인 응답에 revision/version이 없으므로 2026-09-18의 최신성은 독립적으로 확정하지 않습니다. BEM quick-start URL은 확인 당시 404였고, SMACSS·OOCSS는 역사적 방법론 자료입니다. 이 실습은 이 자료들의 이름과 원칙을 교육용으로 재구성한 것이며 “모든 공식 기능을 다룬다”고 주장하지 않습니다.

## 참고 자료

- [DOM Standard](https://dom.spec.whatwg.org/) — 2026-09-18 확인 응답에서 `Living Standard — Last Updated 25 August 2026` 확인. DOM node tree와 mutation terminology의 근거로 사용했으나 이후 변경 가능.
- [CSSOM Editor’s Draft](https://drafts.csswg.org/cssom/) — 2026-09-18 확인 응답에서 2026-08-31 Editor’s Draft 및 work in progress 확인. CSSStyleDeclaration/CSSOM 관찰의 용어 근거이며 final Recommendation 아님.
- [CSS Pseudo-Elements Level 4](https://www.w3.org/TR/css-pseudo-4/) — 2026-09-18 확인 응답에서 2025-06-27 Working Draft 확인. generated content 설명에 사용했으며 최신 구현 보장 아님.
- [WAI-ARIA APG Accordion Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/accordion/) — `aria-expanded`, `aria-controls`, Enter/Space 지침에 사용. revision/version은 확인 응답에서 확정하지 못함.
- [BEM quick start](https://bem.info/methodology/quick-start/) — 확인 당시 404. BEM 명명은 lab의 관례로 사용하며 URL의 최신 공식성은 주장하지 않음.
- [SMACSS](https://smacss.com/book/) — Base/Layout/Module/State/Theme 범주를 확인한 역사적 자료.
- [OOCSS wiki](https://github.com/stubbornella/oocss/wiki) — structure/skin, container/content 분리 지침을 확인한 자료; 2023-02-20 latest edit 응답.
- [DOM 이벤트 위임의 대상과 전파 경계](/tech-interview/notes/event-delegation/), [레이아웃 계산과 화면 이동](/tech-interview/notes/rendering-layout/), [CSS 선언의 승자와 상속 경계](/tech-interview/notes/css-cascade/) — 저장소의 인접 심화 노트.

## 코드 위치

[웹 플랫폼 실습 코드](https://github.com/c86j224s/tech-interview/tree/main/examples/knowledge/web-platform-lab/)에서 HTML·CSS·JavaScript·서버·테스트를 함께 확인할 수 있습니다.
