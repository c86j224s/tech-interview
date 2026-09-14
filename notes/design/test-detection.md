---
id: test-detection
title: Red·Property·Mutation으로 테스트 검출력 확인하기
topic: 설계
summary: 의도한 assertion 실패와 환경 실패를 나누고 경계 예제·생성 불변식·shrinking·메타모픽 관계·생존/동등 변이·독립 oracle을 설명합니다.
questionIds: [tdd-red-green-refactor, testing-property-based, mutation-test-detection-power]
---

# Red·Property·Mutation으로 테스트 검출력 확인하기

## 테스트가 실행됐다는 것과 결함을 잡는 것은 다릅니다

5만원 이상 10% 할인이라면 49,999·50,000·50,001의 기대값을 정책에 맞게 정합니다. 새 test가 처음부터 통과하면 이미 구현된 동작을 확인했거나 assertion이 약할 수 있습니다. **Red**에서는 의도한 업무 assertion에서 실패하는지 확인합니다. 문법 오류·모듈 누락으로 실패한 것은 할인 경계를 검출한 증거가 아닙니다.

Green은 요구를 만족시키는 최소 구현, Refactor는 결과·예외·상태를 유지한 구조 정리입니다. 미래 기능 추가나 성공 기준 완화와 섞지 않습니다. test 파일을 먼저 만든 사실만으로 Red-Green-Refactor를 수행했다고 하지 않습니다.

## 기대값을 제품 함수로 다시 계산하면 같은 오류를 공유합니다

테스트가 `expected=discount(input)`으로 값을 만들고 같은 함수를 호출하면 잘못된 구현도 자신과 같아서 통과합니다. 명시적 예제·독립 기준 계산·다른 알고리즘을 사용합니다. 내부 private 함수나 불필요한 호출 순서에 과결합하면 안전한 refactor도 어려워집니다. 외부 효과 횟수처럼 실제 계약인 상호작용은 예외입니다.

| 검사 | 확인하는 것 | 보장하지 않는 것 |
| --- | --- | --- |
| line coverage | 코드가 실행됨 | assertion의 검출력 |
| 예제 test | 명시한 입력·결과 | 다른 모든 입력 |
| property test | 생성 영역의 불변식 | 수학적 완전 증명 |
| mutation test | 선택한 변이를 거절함 | 요구 자체의 정확성 |
| 통합 test | 실제 외부 계약 | 모든 장애 스케줄 |

## 정렬의 성질을 분해해서 검사합니다

정렬 결과가 비내림차순이고 입력의 **다중집합**을 보존해야 합니다. 집합만 같으면 중복 원소 누락을 놓칩니다. 이것만으로 stable sort까지 증명하지 못하므로 같은 key의 원래 순서도 요구라면 추가합니다. encode/decode 왕복·기준 구현 비교·입력 변환에 따른 결과 관계도 유용합니다.

생성기는 빈 값·최대 크기·음수·overflow 경계·중복·정상/비정상 입력을 구분해 만듭니다. random seed·generator version·실패 입력을 보존하고 shrinking으로 실패를 유지하는 작은 사례를 찾습니다. 줄인 사례가 반드시 운영에서 가장 흔한 입력이거나 절대 최소라는 뜻은 아닙니다.

```diagram
{"title":"생성한 실패를 작은 회귀로 남깁니다","caption":"화살표는 검증 순환입니다. 랜덤 횟수보다 성질·분포·실패 유지가 중요하며 기준 자체의 오류도 별도 검토합니다.","rows":[[{"id":"contract","label":"명시적 예제·불변식·독립 기준"}],[{"id":"generate","label":"경계 입력·seed·다양한 분포"}],[{"id":"failure","label":"실패를 검출한 assertion"}],[{"id":"shrink","label":"실패 유지·입력 축소"}],[{"id":"regression","label":"작은 고정 회귀·구현 수정"}]],"edges":[{"from":"contract","to":"generate","label":"검사 조건"},{"from":"generate","to":"failure","label":"실제 반례"},{"from":"failure","to":"shrink","label":"원인 좁히기"},{"from":"shrink","to":"regression","label":"재현 보존"}]}
```

셔플은 길이·원소 다중집합·제외 대상 같은 결정적 성질과 균등 분포의 알고리즘/통계 근거를 나눕니다. 모든 순열이 유효하다고 균등한 것은 아닙니다. 입력을 두 번 정렬한 결과가 같다는 멱등 성질도 원소를 모두 버리는 잘못된 구현이 통과할 수 있어 여러 성질을 조합해야 합니다.

## 변이를 죽이지 못했다고 모두 제품 결함은 아닙니다

`>=50000`을 `>50000`으로 바꾸면 경계 test가 실패해야 합니다. 이런 작은 조건·연산 변화를 여러 곳에 자동 적용하는 것이 mutation testing입니다. 살아남은 변이는 assertion 누락일 수 있지만 의미가 같은 동등 변이일 수도 있습니다. 컴파일 불가·timeout·환경 실패도 실제 assertion 검출과 구분합니다.

격리한 변이별 실행·시간 한도로 무한 loop를 제어하고 점수만 높이려고 구현 세부에 과결합하지 않습니다. 중요한 불변식의 생존 변이를 조사해 유효한 반례를 회귀로 추가합니다. 이 노트는 검출력 설계이며 실제 mutation 도구를 전 저장소에 실행한 결과는 아닙니다.
