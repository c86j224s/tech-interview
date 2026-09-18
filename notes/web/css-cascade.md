---
id: css-cascade
title: CSS 선언의 승자와 상속 경계
topic: 웹
summary: 출처·중요도·레이어·명시도의 순서를 예제로 비교하고 where·is·initial·inherit·unset의 차이를 설명합니다.
questionIds: [css-cascade-specificity, css-cascade-layer-priority, css-where-is-specificity, css-unset-inherit-initial]
---

# CSS 선언의 승자와 상속 경계

CSS cascade는 선택자 점수 하나로 승패를 정하는 규칙이 아니라, 매칭된 선언을 출처·중요도·레이어·명시도·scope·순서의 단계로 좁혀 최종 값을 고르는 과정입니다. 상속과 초기값은 그 경쟁에 직접 참여하지 않는 별도 경계이므로 두 과정을 먼저 분리해 읽어야 합니다.

## 부모 선택자와 자식 직접 선언의 상속 경계

부모 `#panel`에 color:red를 주고 자식 p에 color:blue를 주면 p는 보통 파랑입니다. 부모의 ID 명시도가 더 높아도 자식에게 직접 적용된 선언과 같은 경쟁을 하는 것이 아닙니다. 상속은 자식의 값이 결정되지 않을 때 적용되는 별도 과정입니다.

CSS 디버깅은 “더 긴 선택자가 이긴다”가 아니라 어떤 요소에 어떤 선언이 적용되는지, 그 선언들이 **cascade의 어느 단계**에서 비교되는지부터 확인해야 합니다.

## 매칭 선언과 cascade 우선순위 비교

스타일이 기대와 다르면 먼저 해당 선택자가 요소에 매칭되는지와 `media` 조건이 활성인지 확인합니다. 그 후보들 사이에서 출처·중요도, 레이어, 명시도, `scope` 근접성, 소스 순서 등의 규칙으로 승자를 정하며, 애니메이션·트랜지션·inline 선언과 Shadow DOM 경계도 결과에 영향을 줄 수 있습니다. 아래 예는 같은 문서의 작성자 스타일이며 animation·transition·inline·scope 경쟁이 없으므로, 그 제한 안에서 레이어와 명시도의 관계에 집중합니다.

```diagram
{"title":"명시도는 앞 단계가 같을 때 비교합니다","caption":"화살표는 판단 순서의 요약입니다. 이 그림은 모든 특수 cascade 규칙을 대체하지 않으며, 같은 출처·중요도·레이어 안에서 명시도를 비교한다는 점이 핵심입니다.","rows":[[{"id":"match","label":"요소·조건 매칭 확인"}],[{"id":"origin","label":"출처·중요도·레이어"}],[{"id":"specific","label":"선택자 명시도"}],[{"id":"order","label":"scope 근접성·소스 순서"}]],"edges":[{"from":"match","to":"origin","label":"적용 후보"},{"from":"origin","to":"specific","label":"앞 조건이 같으면"},{"from":"specific","to":"order","label":"명시도도 같으면"}]}
```

사용자 important 규칙은 작성자 important보다 높은 우선순위를 가질 수 있고, 활성 transition 값은 important보다 우선하는 등 단순 “important가 항상 최상위”도 아닙니다. 실제 computed style에서 어떤 규칙 때문에 탈락했는지 확인해야 합니다.

개발자 도구에서는 먼저 규칙이 취소선인지보다 selector match, media/container 조건, shadow 경계를 확인하고 그 뒤 단계별로 탈락 원인을 읽습니다. 같은 요소에서 computed value와 used value가 달라질 수 있는 속성도 있으므로, “선언의 승자”와 최종 레이아웃 결과를 같은 것으로 단정하지 않습니다. 이 문서의 순서 설명은 명시된 제한 조건 안에서 해석합니다.

## 레이어 우선순위와 명시도 비교 순서

```css
@layer base, components;
@layer base { #save { color: red; } }
@layer components { .button { color: blue; } }
```

`id=save`, `class=button`인 같은 요소에서 일반 선언은 뒤 components 레이어의 파랑이 이깁니다. ID가 높은 명시도여도 앞선 레이어 우선순위를 넘지 못합니다. 레이어 밖의 일반 작성자 선언은 레이어 안 일반 선언보다 우선합니다.

| 같은 작성자 출처의 선언 | 레이어 사이 우선순위 |
| --- | --- |
| 일반 | 뒤 레이어 > 앞 레이어, 레이어 밖 일반이 우선 |
| important | 앞 레이어 > 뒤 레이어, 레이어 안 important가 레이어 밖 important보다 우선 |

important는 레이어 순서가 뒤집힙니다. 따라서 기존 스타일을 레이어로 감쌀 때 일반 규칙의 승자뿐 아니라 important 규칙도 따로 시험해야 합니다. 라이브러리 기본값을 낮은 레이어로 두는 방식은 중요도 경쟁을 무한히 키우지 않고 책임을 나누는 데 도움이 됩니다.

작은 회귀 시험은 base의 ID 규칙과 components의 class 규칙을 같은 요소에 적용한 뒤 레이어 선언 순서를 바꾸고 일반/important를 각각 측정합니다. 예상 결과는 일반 규칙과 important 규칙의 레이어 방향이 서로 다르고, 레이어 밖 일반 작성자 규칙이 레이어 안 일반 규칙을 이긴다는 것입니다. 레이어를 도입한 뒤 기존 important가 어디에 속하는지 명시하지 않으면 의도하지 않은 승자가 생길 수 있습니다.

## where와 is의 매칭과 명시도

`:where(.card p)`는 매칭 조건 전체의 명시도를 0으로 만듭니다. `:is(.card,#special) p`는 인자 목록의 가장 높은 명시도인 ID를 반영하므로 실제로 .card 가지로 매칭되더라도 높은 가중치를 가질 수 있습니다. 선택자가 무엇과 매칭되는지와 승자 비교에 어떤 명시도를 주는지는 구분합니다.

같은 앞선 조건에서 ID·클래스/속성/가상 클래스·타입의 개수를 순서대로 비교합니다. 클래스가 아주 많다고 ID 하나의 자리를 산술적으로 넘는 점수 합이 되는 것은 아닙니다. 같은 명시도라면 scope 근접성을 적용하는 경우 이를 먼저 보고, 마지막으로 소스 순서를 봅니다.


`:where`와 `:is`를 비교할 때는 먼저 두 선택자가 모두 같은 요소에 매칭되는지 확인하고, 그 다음 specificity 계산기를 손으로 적습니다. `:is()` 안에 ID가 포함된 경우 실제로 매칭된 branch가 class인지와 무관하게 목록의 최고 명시도가 반영되는 점을 작은 DOM에서 확인합니다. 재사용 컴포넌트는 낮은 명시도의 `:where`를 기본으로 삼고, 예외는 구조보다 역할이 드러나는 선택자로 제한합니다.

## initial·inherit·unset의 초기값·부모값 선택

부모에 margin-left:20px가 있을 때 자식의 세 선언을 비교해 보겠습니다. margin은 기본적으로 상속되지 않습니다.

| 자식 선언 | 뜻 | 예시 결과 |
| --- | --- | --- |
| inherit | 부모의 계산값 사용 | 20px |
| initial | 명세상 초기값 사용 | 0 |
| unset | 비상속 속성이므로 initial | 0 |

color처럼 상속되는 속성에서 unset은 inherit처럼 동작합니다. initial은 “브라우저가 이 태그에 보통 주는 스타일로 복귀”가 아닙니다. 예를 들어 요소별 UA 스타일은 cascade에 참여한 선언이고 명세의 속성 초기값과 다릅니다. revert·revert-layer는 출처·레이어의 이전 단계로 되돌리는 별도 의미이므로 unset과 바꿔 쓰지 않습니다.

검증 DOM에서 부모에 `margin-left:20px`, 자식에 세 키워드를 번갈아 적용하고 computed style을 비교합니다. 예상 결과는 margin처럼 비상속 속성에서 `inherit=20px`, `initial=0`, `unset=0`이고, color처럼 상속되는 속성에서는 `unset`이 부모값을 따른다는 것입니다. UA stylesheet로 돌아가려는 목적이라면 `revert` 계열이 필요한지 별도로 판단합니다.

## 예측 가능한 CSS 기본값 구성

기본 typography와 컴포넌트·상태·사용자 override의 레이어 순서를 명시하고, 기본 선택자는 낮은 명시도로 유지합니다. 충돌 때마다 ID와 important를 추가하면 사용자가 정상적으로 덮어쓸 수 있는 경계가 사라집니다.

브라우저 개발자 도구에서 같은 요소에 위 레이어 예를 적용하고 `computed color`가 어느 선언을 택했는지, `important`를 넣었을 때 결과가 어떻게 바뀌는지 확인합니다. 이어서 `:where`·`:is`와 ID를 섞은 선택자, `margin`의 `inherit`·`initial`·`unset` 세 키워드를 각각 작은 사례로 대조합니다. 테마·동적 클래스·중첩 컴포넌트·브라우저 사용자 스타일도 같은 방식으로 재현하고, 코드에 적은 색과 화면의 색이 다르면 최종 승자와 상속 출처를 도구에서 따라갑니다.

회귀 시험은 테마 클래스·동적 상태·중첩 컴포넌트·사용자 override를 고정한 작은 DOM에서 computed style의 승자와 화면 결과를 함께 캡처하는 방식으로 끝냅니다. 색이 기대와 다르면 선택자 점수를 더 올리기 전에 매칭·레이어·important·상속·UA 선언의 순서로 원인을 좁힙니다. 실제 브라우저별 동작을 주장할 때는 대상 브라우저 버전에서 개발자 도구로 재현해야 합니다.
