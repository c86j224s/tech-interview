---
id: web-observer-delivery-feedback
title: IntersectionObserver·ResizeObserver 전달 피드백
topic: 웹
summary: 두 Observer의 비동기 전달과 callback이 레이아웃 조건을 바꾸는 feedback loop를 진단합니다.
questionIds: []
prerequisites:
  - rendering-layout
  - web-platform-rendering-lab
related:
  - rendering-layout
reviewedAt: '2026-09-19'
---
# IntersectionObserver·ResizeObserver 전달 피드백

두 Observer는 DOM 변경 즉시 동기 callback을 호출하는 감시문이 아닙니다. 브라우저가 기하 상태를 계산하고 관찰 결과를 entry로 큐에 넣은 뒤, 정해진 전달 단계에서 묶어서 callback을 실행합니다. callback이 다시 크기·스타일·위치를 바꾸면 그 write가 다음 계산의 입력이 됩니다. 따라서 “callback이 몇 번 불렸나”만으로 문제를 설명하지 말고, 기하 입력, 큐, 전달, write, 다음 계산을 분리해서 추적해야 합니다.

## IntersectionObserver의 기하

IntersectionObserver는 root와 root margin, clipping을 반영해 대상의 교차 상태를 계산합니다. 양의 면적을 가진 대상에서는 `intersectionRatio`를 교차 면적과 대상 bounding box 면적의 비율로 이해할 수 있지만, zero-area target에는 별도 규칙이 있으므로 단순 나눗셈으로 일반화하면 안 됩니다. `isIntersecting`과 ratio를 함께 읽고 대상의 면적·경계 조건을 로그에 남깁니다.

threshold는 매 frame 알림 빈도가 아니라 이전 threshold index와 현재 index가 달라지는 경계를 정의합니다. `[0, .5, 1]`에서 ratio가 .2→.7이면 .5를 아래에서 위로 넘은 entry가 큐에 들어갈 수 있습니다. 0.1 단위로 중간값을 모두 전달하는 것은 아니며, entry가 callback에 도착할 때의 현재 ratio와 `time`을 사용합니다.

## ResizeObserver의 상자

ResizeObserver는 관찰 옵션과 entry 필드가 나타내는 상자를 맞춰야 합니다. `contentBoxSize`는 padding·border를 제외한 논리 축의 크기이고, `borderBoxSize`는 padding과 border를 포함합니다. `inlineSize`와 `blockSize`는 writing mode를 반영하므로 세로 쓰기에서 물리적 width·height로 고정하면 의미가 뒤집힐 수 있습니다. `devicePixelContentBoxSize`는 content box를 device pixel 축에서 읽으려는 선택지이며, DPR과 분수 CSS 크기·반올림·지원 여부를 함께 확인해야 합니다.

예를 들어 CSS content 300px, padding 8px, border 1px이면 가로 쓰기에서 content inline은 300, border inline은 300+16+2=318 CSS px입니다. 세로 쓰기에서는 inline/block 명칭이 물리 가로/세로와 달라집니다. DPR 2라면 이상적인 정수 content device 폭은 600이지만 실제 분수 레이아웃과 엔진 지원을 이 산술 하나로 확정하지 않습니다.

## 큐와 전달 단계

```diagram
{"title":"기하 입력과 observer feedback","caption":"entry 전달 뒤 callback write가 새 기하 입력이 됩니다. Resize loop error의 알고리즘 경계와 엔진별 paint 시점을 구분합니다.","rows":[[{"id":"geometry","label":"기하 계산","detail":["크기·교차·clip"]}],[{"id":"queue","label":"entry 큐","detail":["threshold·box 변화"]}],[{"id":"deliver","label":"callback 전달","detail":["묶음 처리"]}],[{"id":"write","label":"DOM write","detail":["style·class·width"]}],[{"id":"again","label":"재계산","detail":["새 관찰 입력"]}]],"edges":[{"from":"geometry","to":"queue","label":"변화 기록"},{"from":"queue","to":"deliver","label":"비동기 전달"},{"from":"deliver","to":"write","label":"응답 코드"},{"from":"write","to":"again","label":"기하 변경"},{"from":"again","to":"queue","label":"새 entry 가능"}]}
```

Resize Observer 알고리즘은 깊이와 active observation을 기준으로 전달 가능한 항목을 모읍니다. callback이 조상·자식의 크기를 연쇄적으로 바꾸어 이번 단계에 전달되지 않은 skipped observation이 남으면 loop error가 보고될 수 있습니다. “반드시 다음 frame callback으로 실행된다”는 식으로 알고리즘을 단정하지 않고, 이후 렌더링 주기에서 다시 전달될 수 있다는 관찰 결과와 callback-to-paint 시점의 엔진 의존성을 분리합니다.

## 피드백 수렴 조건

`width += 1px`는 300→301→302처럼 매번 다른 입력을 만들므로 안정점이 없습니다. callback에서 breakpoint class를 계산한다면 현재 class와 새 class가 다를 때만 write하고, 상한과 최소 간격을 둡니다. 부모와 자식이 서로의 크기를 바꾸는 경우 한 owner가 크기를 결정하거나 `contain`, 고정 측정 영역, 서버·레이아웃 모델의 상한을 사용합니다. rAF로 write를 옮겨도 변경이 계속되면 loop는 다음 frame으로 이동할 뿐 사라지지 않습니다.

무한 스크롤에서 IntersectionObserver가 sentinel 교차마다 20개를 추가하고 ResizeObserver가 컨테이너 높이를 바꾸는 상황을 생각해 보겠습니다. 새 카드 때문에 sentinel이 다시 교차하면 `loading` 하나만으로는 늦은 응답 경합을 막지 못합니다. cursor, 요청 세대, 처리한 cursor 집합을 기록하고 서버도 중복 cursor를 안전하게 처리해야 합니다.

## 수명과 해제

DOM에서 노드를 제거하는 것과 observer 등록을 해제하는 것은 별개입니다. owner가 단일 observer를 독점하면 `disconnect()`를 쓰고, 공유 observer에서는 해당 target만 `unobserve()`합니다. 화면 세대 3이 종료된 뒤 같은 DOM 역할을 세대 4가 재사용하면, callback 첫 줄에서 mounted/generation을 확인해 세대 3의 늦은 entry가 세대 4 state를 덮지 못하게 합니다. 이미 큐에 든 entry의 전달 순서와 framework unmount 순서는 target engine에서 확인해야 합니다.

callback 로그가 계속 나온다고 곧 메모리 누수라고 단정하지 않습니다. 다른 observer instance, 재등록, DOM write가 만드는 새 resize, queued delivery를 instance id·generation·entry size와 함께 구분합니다. fetch를 시작하는 callback은 observer 수명과 fetch abort 수명을 같은 owner에 묶습니다.

## 관찰 선택과 비용

화면 진입·lazy loading·sentinel이면 IntersectionObserver가 맞고, 카드 크기·canvas backing store·breakpoint면 ResizeObserver가 맞습니다. 관찰 대상 수보다 callback에서 반복하는 layout read, 네트워크 요청, DOM write가 비용을 결정하는 경우가 많습니다. 불필요한 대상은 unobserve하고 threshold를 필요한 경계만 남깁니다. entry마다 `performance.now()`, target, ratio/box, generation, write를 기록하면 반복 원인을 확인할 수 있습니다.

## 참고 자료와 적용 범위

[Intersection Observer ED](https://w3c.github.io/IntersectionObserver/)의 threshold crossing과 entry queue, [Resize Observer Module Level 1](https://drafts.csswg.org/resize-observer/)의 active observation·depth 전달·loop error·box size 규칙을 근거로 삼았습니다. 두 문서는 2026-09-19에 읽을 수 있는 편집자 초안으로 확인했으며, 구현 버전의 모든 동작을 보장한다고 표현하지 않았습니다. callback과 paint 사이의 정확한 시각, `devicePixelContentBoxSize` 지원, framework cleanup은 Chrome·Firefox·Safari·대상 WebView에서 별도 검증이 필요합니다.
