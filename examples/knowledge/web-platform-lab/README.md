# 브라우저 렌더링 관찰 실습

작은 아코디언으로 DOM 상태, 계산 스타일, generated content, 레이아웃 기하와 접근성 상태의 불일치를 관찰합니다. BEM modifier는 스타일 변형을, `aria-expanded`와 `hidden`은 상호작용 상태를 표현합니다.

## 실행

저장소 루트에서 기존 Playwright 의존성을 사용합니다.

```sh
node examples/knowledge/web-platform-lab/server.mjs
```

브라우저에서 `http://127.0.0.1:4173`을 엽니다. 수동 서버를 종료한 뒤 자동 테스트를 실행하면 Playwright가 서버의 수명을 관리합니다.

```sh
npx playwright test --config=examples/knowledge/web-platform-lab/playwright.config.mjs
```

설정은 설치된 Chrome 채널을 사용합니다. 서버는 loopback에만 bind하고 HTML·CSS·JS 세 파일만 제공합니다. GET/HEAD만 허용하고 응답 크기는 512KiB 이하입니다. `PORT`로 수동 서버 포트를 바꿀 수 있습니다.

## 관찰 순서

1. 아코디언을 열고 `aria-expanded`와 `hidden`의 일치를 확인합니다.
2. 기본·촘촘하게·경고 변형의 계산 스타일과 상자 크기를 비교합니다.
3. 측정 버튼으로 JavaScript 쓰기·읽기 구간을 기록합니다. 프레임 전체 시간이나 paint·GPU 비용이 아닙니다.
4. 계약 깨기로 상태를 어긋나게 만든 뒤 복구합니다.
5. 개발자 도구의 접근성 트리, 스타일, Performance trace를 각각 확인합니다.

BEM·SMACSS·OOCSS는 이름과 책임을 정하는 방법론이지 CSS cascade나 접근성 보장을 대체하지 않습니다.

## 실행 결과와 한계

2026-09-18 Node 26과 설치된 Chrome에서 4개 Playwright 테스트를 통과했습니다. 초기 상태·열기, 스타일 변형, 실패 주입·복구, 400px 수평 overflow를 검사합니다. 번들 Chromium은 미설치 상태로 초기 실행에 실패했고 Chrome 채널로 재실행했습니다. Firefox·WebKit, 실제 모바일 기기, 스크린리더, paint·합성 비용은 검증하지 않았습니다.

[학습 노트](https://c86j224s.github.io/tech-interview/notes/web-platform-rendering-lab/)
