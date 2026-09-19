---
id: swiftui-foreach-stable-identity
title: ForEach에서 index를 id로 사용한 뒤 앞에 행을 삽입하면 TextField state가 이동할 수 있는 이유는 무엇인가요?
difficulty: 중하
category: 모바일
tags:
  - SwiftUI
  - identity
  - State
  - diffing
related:
  - ios-navigation-view-retention
---
# ForEach에서 index를 id로 사용한 뒤 앞에 행을 삽입하면 TextField state가 이동할 수 있는 이유는 무엇인가요?

## 구두 답변

index는 논리 항목이 아니라 현재 위치이므로 삽입·삭제·정렬 때 같은 숫자가 다른 항목을 가리킵니다. 초기 `[A, B, C]`에서 B의 TextField state가 `b*`이고 매핑이 `id0=A, id1=B, id2=C`였다고 하겠습니다. X를 앞에 삽입하면 새 매핑은 `id0=X, id1=A, id2=B, id3=C`입니다. SwiftUI가 숫자 identity를 이어가면 이전 `id1` storage의 `b*`가 A에 연결되어 값이 이동한 것처럼 보입니다.

모델이나 서버가 제공하는 안정적 고유 ID를 `ForEach(items, id: \.id)`에 쓰면 순서가 바뀌어도 B의 ID가 유지되어 state가 B를 따라갈 수 있습니다. ID는 유일해야 하고, 삭제한 ID를 즉시 다른 항목에 재사용하지 않는 정책이 필요합니다. 편집 초안을 row `@State`에 둘지 모델 binding에 둘지도 결정해야 하며, ID를 고쳐도 영속 데이터와 임시 입력의 owner가 혼동되면 다른 종류의 손실이 남습니다.

반대로 `id: \.self`는 값 자체가 안정적이고 유일하며 hash/equality 의미가 논리 항목과 일치할 때만 적합합니다. 편집 중인 값 자체를 ID로 삼으면 TextField 입력이 바뀌는 순간 identity도 바뀌어 state가 재생성될 수 있습니다. 서버 ID와 화면 위치를 분리하고, 중복 ID 검사를 개발 빌드에서 실패시키면 삽입 trace가 우연히 정상처럼 보이는 문제를 빨리 찾을 수 있습니다.
이 반례는 배열 자체가 새로 만들어졌기 때문이 아니라 같은 숫자 identity의 의미가 바뀌었기 때문에 생깁니다. 따라서 diffing을 고치려면 복사 방식보다 모델 ID의 수명과 유일성을 먼저 테스트해야 합니다. 실제 검증에서는 삽입 전후 각 row의 모델 ID와 state 값을 함께 출력해 `B`의 draft가 `B`를 따라가는지 확인하고, duplicate ID 입력은 개발 단계에서 거부합니다.
## 득점 포인트

- `[A,B,C] → [X,A,B,C]`에서 숫자 ID와 state storage의 매핑을 추적합니다.
- 위치가 아니라 논리 항목의 stable unique ID를 사용한다고 답합니다.
- 중복·재사용 ID와 편집 초안 owner를 함께 검증합니다.

## 감점 포인트

- 객체 주소만 사용하므로 배열 위치 ID에서도 state가 이동하지 않는다고 단정합니다.
- `id: \.self`를 적용하면 모든 모델의 안정성이 자동으로 보장된다고 말합니다.
- 배열을 새로 만든 모든 경우에 각 row `@State`가 초기화된다고 오해합니다.

## 더 파고들 거리

- 삭제·정렬·동시 서버 업데이트가 겹칠 때 ID uniqueness를 어떤 테스트로 보장할지 설명해 보세요.
- row `@State`를 model binding으로 옮기면 identity 문제와 state 소유권이 각각 어떻게 달라지는지 비교해 보세요.
