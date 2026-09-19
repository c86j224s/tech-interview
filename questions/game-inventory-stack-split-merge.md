---
id: game-inventory-stack-split-merge
title: stackable item을 split/merge할 때 어떤 불변식을 원자적으로 지켜야 하나요?
difficulty: 중하
category: 게임 서버
tags:
  - inventory
  - stacking
  - transaction
related:
  - transaction-and-lost-update
---
# stackable item을 split/merge할 때 어떤 불변식을 원자적으로 지켜야 하나요?

## 구두 답변

split·merge의 핵심은 수량 합 보존과 호환성 검사를 하나의 원자 전이로 묶는 것입니다. 두 stack은 같은 definition이어야 하고 owner, container 권한, 귀속(bind), 만료, 거래 가능 정책이 호환되어야 합니다. source와 destination version이 예상 값일 때만 갱신하고, 각 수량은 1 이상 max stack 이하로 유지합니다. 클라이언트가 “최종 quantity=50”을 보내 덮어쓰게 하면 concurrent update가 이전 상태를 지울 수 있으므로 `split(A, amount, expectedVersion)` 명령을 받습니다.

상태를 숫자로 추적하면 오류가 드러납니다. `A=99`, max=100에서 50을 split하면 transaction 전 `A=99`, 후 `A=49`, 새 `B=50`, 총합 99입니다. 이어서 B=50을 C=60에 합치면 C=110이라 max 위반으로 전체 거절해야 합니다. C=50이면 C=100, B는 terminal/deleted가 되고 총합은 A49+C100=149로 split 전 99와 merge 전 149가 보존됩니다. source 감소만 성공하면 50개 소실이고 destination 생성만 성공하면 duplication이므로 한 DB transaction 또는 같은 권위 actor의 원자 commit이 필요합니다.

`version=7`을 읽은 요청이 다른 merge 때문에 version=8을 만나면 기존 계산을 다시 쓰지 말고 충돌을 반환하거나 최신 상태에서 명령을 재계산합니다. request/effect ID를 저장해 동일 retry는 저장된 결과를 돌려주고, 다른 payload가 같은 key를 쓰면 fingerprint mismatch로 거절합니다. 여러 row를 갱신했다면 조건부 UPDATE 영향 행 수를 검사합니다. 만료가 다른 stack을 합칠 수 있는지, partial commit을 어떻게 정정할지는 게임 경제 정책과 ledger에 기록하며, repair job도 새로운 멱등 command로 취급해야 합니다.

## 득점 포인트

- 수량 보존·max stack·definition/owner/policy 호환·version 조건을 함께 제시한다.
- split/merge의 부분 성공이 소실·duplication을 만든다는 이유를 설명한다.
- command 멱등성과 충돌 시 재계산을 lost update 방지와 구분한다.

## 감점 포인트

- 클라이언트의 최종 quantity를 그대로 저장한다.
- source와 destination을 별도 요청으로 갱신해도 transaction이 필요 없다고 말한다.
- version 충돌 때 이전 계산을 그대로 다시 쓰면 된다고 설명한다.

## 더 파고들 거리

- 서로 다른 만료 시각을 가진 stack을 merge할 수 있는지 어떤 policy로 정할까요?
- 여러 container를 한 번에 옮길 때 lock 순서와 deadlock을 어떻게 막을까요?
- 부분 완료가 남았을 때 repair job이 정상 command와 중복되지 않도록 무엇을 저장할까요?
