---
id: ssr-csr-hydration
title: "서버가 보낸 HTML은 바로 보이는데 버튼은 잠시 반응하지 않고 hydration 경고도 납니다. SSR·CSR·hydration은 각각 언제 실행되며 무엇을 확인해야 하나요?"
answerMinutes: 5
followups: [{"id":"browser-rendering-layout","prompt":"hydration 중 서버 DOM과 클라이언트 DOM이 달라 layout이 반복될 때 네트워크·script·layout 비용을 어떻게 분리하나요?"},{"id":"browser-url-navigation","prompt":"SSR HTML은 빨리 도착했지만 번들과 서브리소스가 늦다면 탐색 waterfall에서 표시와 상호작용 시점을 어떻게 나누나요?"},{"id":"api-backward-compatibility","prompt":"오래 캐시된 웹 번들이 새 서버의 데이터 필드·상태 값을 받을 때, hydration과 API 계약의 호환성을 어떤 조합으로 검증하나요?"}]
difficulty: 중하
category: 웹
tags: ["SSR","CSR","hydration","React","렌더링"]
related: ["browser-rendering-layout"]
---

# 서버가 보낸 HTML은 바로 보이는데 버튼은 잠시 반응하지 않고 hydration 경고도 납니다. SSR·CSR·hydration은 각각 언제 실행되며 무엇을 확인해야 하나요?

## 구두 답변

SSR은 서버가 요청 시점의 데이터로 HTML을 만들어 보내는 방식이고, CSR은 브라우저의 JavaScript가 화면을 구성하거나 갱신하는 방식입니다. 두 방식은 배타적이지 않아서 서버가 첫 HTML을 보내고 브라우저가 번들을 실행하는 혼합 구조가 흔합니다. 이때 hydration은 HTML을 빈 화면부터 다시 그리는 것이 아니라, 이미 있는 서버 HTML과 클라이언트의 최초 렌더 트리를 연결해 이벤트와 상태 로직을 활성화하는 과정입니다.

### 표시와 상호작용 시작을 구분합니다

SSR의 HTML은 JavaScript가 아직 내려오지 않아도 텍스트와 일부 구조를 빨리 보여 줄 수 있고 검색·공유 문서에도 유리합니다. 그러나 버튼 handler가 연결되는 시점은 번들 로드·실행·hydration 뒤일 수 있어 ‘보인다’와 ‘상호작용 가능하다’ 사이에 간격이 생깁니다. CSR은 초기 HTML이 작거나 placeholder일 수 있지만 이후 화면 전환과 개인화 상호작용을 브라우저에서 처리하기 쉽습니다. 초기 JavaScript 크기와 hydration 비용, 네트워크·기기 성능을 함께 선택 기준으로 삼겠습니다.

hydration의 전제는 서버 HTML과 클라이언트 최초 렌더 결과가 일치하는 것입니다. 서버와 브라우저의 현재 시각·난수·로케일·timezone·데이터 버전이 다르거나, 렌더 중 `window`, `localStorage`, viewport처럼 브라우저에만 있는 값으로 분기하면 텍스트·속성·노드 구조가 달라질 수 있습니다. 프레임워크가 일부를 복구하더라도 경고를 숨기는 것으로 끝내지 않겠습니다. DOM을 다시 만들거나 이벤트가 예상하지 않은 요소에 연결되고 추가 렌더 비용이 생길 수 있습니다.

### 불확실한 값은 최초 출력 뒤에 바꿉니다

브라우저 전용 값이 필요하면 서버와 클라이언트 최초 렌더에서 같은 placeholder를 사용하고 hydration 뒤 effect나 명시적인 client state 전환으로 실제 값을 표시합니다. 현재 시각·난수는 서버에서 생성해 payload로 전달하거나 안정적인 초기 값을 사용합니다. locale과 timezone은 사용자 설정을 서버와 공유하거나 최초에는 중립 표현을 사용합니다. 의도적으로 한 텍스트만 달라지는 영역에 예외 억제 옵션을 쓸 수 있지만, 넓은 subtree의 불일치를 숨기는 데 남용하지 않겠습니다.

SSR HTML을 CDN이나 공유 캐시에 넣는다면 개인화된 사용자 정보가 다른 사람에게 전달되지 않도록 캐시 키·private/no-store 정책과 데이터 주입 범위를 확인합니다. 서버 데이터와 client fetch의 버전이 다르면 hydration 뒤 값이 튀므로 응답에 버전·시점 정보를 포함하거나 같은 snapshot을 사용하겠습니다. 스트리밍 SSR과 부분 hydration은 첫 콘텐츠와 상호작용 시점을 개선할 수 있지만 경계별 일치·오류·취소 계약이 추가됩니다.

검증은 서버가 보낸 원문 HTML, 클라이언트 최초 출력, hydration 경고, handler 연결 시점, effect 뒤 의도된 변경, 개인화 캐시 노출을 각각 비교합니다. 느린 네트워크와 저사양 기기에서 버튼이 언제 활성화되는지 측정하고, SSR이 있다는 이유로 JavaScript·hydration 비용이 없다고 가정하지 않겠습니다. 좋은 선택은 SSR/CSR의 유행이 아니라 첫 콘텐츠와 최신성·개인화·상호작용 비용의 계약을 맞추는 것입니다.

서버 HTML을 공유 캐시할 때는 hydration 코드 자체가 아니라 데이터 계약의 수명도 중요합니다. 오래 캐시된 웹 번들이 새 서버가 추가한 필드나 상태 값을 모르면 최초 렌더 뒤 client code가 예외를 내거나 fallback으로 잘못 표시할 수 있습니다. 서버는 구버전 번들이 이해할 수 없는 enum을 갑자기 보내지 말고, 새 필드는 무시 가능한 형태로 추가하거나 계약 버전을 분리합니다. 반대로 새 번들이 오래된 서버 응답을 받는 경우에도 필수 필드가 없을 때의 기본값과 기능 제한을 정합니다. 실제 배포에서는 캐시된 구번들·새 HTML·구 API 응답과 새 API 응답의 조합을 모두 시험하고, hydration 경고와 API 계약 오류를 구분해 관찰하겠습니다.

## 득점 포인트

- SSR·CSR·hydration을 HTML 생성·브라우저 구성·상호작용 연결로 구분한다.
- 서버와 클라이언트 최초 출력 일치가 필요한 이유와 불일치 비용을 설명한다.
- 브라우저 전용 값을 placeholder·effect·서버 전달값으로 지연 처리한다.
- 첫 콘텐츠·handler 연결·개인화 캐시·hydration 경고를 별도 측정한다.

## 감점 포인트

- hydration이 서버 HTML을 항상 빈 화면부터 완전히 다시 그린다고 말한다.
- 프레임워크가 모든 불일치를 안전하게 고치므로 경고를 무시한다.
- SSR이면 JavaScript와 hydration 비용이 없다고 말한다.
- 개인화 HTML을 공유 캐시에 넣어도 사용자 데이터 노출이 없다고 가정한다.

## 더 파고들 거리

- 스트리밍 SSR·부분 hydration이 상호작용 경계와 오류 처리를 어떻게 바꿀까요?
- 서버·클라이언트 데이터 버전을 같은 초기 snapshot으로 맞추는 방법은 무엇일까요?
- 개인화된 SSR 응답에서 CDN 캐시와 브라우저 캐시의 키를 어떻게 설계할까요?
