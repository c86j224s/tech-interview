---
id: branch-mispredict-architectural-state
title: >-
  분기 예측이 틀려 speculative 경로가 예외를 일으킬 것처럼 보입니다. 왜 잘못된 경로의 결과가 architectural state에
  남지 않도록 retirement를 제한하나요?
difficulty: 중하
category: 운영체제
tags:
  - 분기 예측
  - 추측 실행
  - retirement
  - 예외
related:
  - atomics-memory-order
---
# 분기 예측이 틀려 speculative 경로가 예외를 일으킬 것처럼 보입니다. 왜 잘못된 경로의 결과가 architectural state에 남지 않도록 retirement를 제한하나요?

## 구두 답변

precise exceptions와 in-order retirement를 보장하는 out-of-order 설계에서는 실행이 끝난 것과 architectural state에 반영된 것을 분리합니다. 예측 경로의 명령어는 결과와 fault 후보를 내부 대기열에 둘 수 있지만, 분기 결과와 앞선 명령어가 정리되기 전에는 순서대로 retirement하지 않습니다. 그래야 실제로 선택되지 않은 경로의 레지스터 쓰기나 예외가 프로그램 결과가 되지 않습니다.

`if (p != null) load [p]`에서 p가 null인데 true를 예측했다고 하겠습니다. 잘못된 load는 주소 계산이나 권한 확인을 시작할 수 있지만 branch가 false로 resolve되면 그 명령어의 ROB 항목과 fault 후보를 squash합니다. 반대로 실제 경로의 load가 유효하지만 페이지 fault를 내면, 그 fault 명령어가 프로그램 순서상 retire 대상이 될 때 예외를 보고합니다. 뒤 명령어가 먼저 계산을 끝냈다는 이유로 앞선 fault보다 먼저 외부 상태를 바꾸면 precise exception을 지킬 수 없습니다.

store도 같은 경계를 봅니다. 추측 경로의 store가 store buffer에 잠시 들어가는 것과 architectural memory에 공개되는 것은 다릅니다. branch가 틀리면 해당 buffer entry를 폐기해야 하며, retirement 뒤에야 올바른 경로의 store가 coherence 관찰면에 전달될 수 있습니다. 다만 cache, predictor, TLB가 바뀌었다는 내부 흔적까지 모두 되돌린다는 의미는 아닙니다. 이 설명은 특정 Intel ROB 이름·크기나 모든 ISA 예외 분류를 확정하는 문장이 아니라 해당 precise-retirement 계약을 가진 교육용 모델입니다. 실제 CPU는 ISA 문서와 대상 구현 자료로 확인합니다.

## 득점 포인트

- 실제 경로와 잘못된 경로의 ROB·store buffer·fault 후보를 retirement 순서로 구분합니다.
- speculative store가 buffer에 들어간 순간 이미 architectural memory가 바뀌었다고 합니다.

## 감점 포인트

- 질문에 없는 일반론으로 결론을 흐리거나 모든 CPU·workload에 같은 규칙을 적용합니다.
- 중간 상태, 실패 조건, 성능·보안 비용을 생략해 결과만 단정합니다.

## 더 파고들 거리

- precise exception 계약이 없는 단순 in-order 모델과 비교해 보세요.
- 입력 순서와 자원 조건을 바꿨을 때 어느 결론이 유지되고 어느 비용이 달라지는지 검증해 보세요.
