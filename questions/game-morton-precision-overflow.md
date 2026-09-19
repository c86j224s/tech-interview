---
id: game-morton-precision-overflow
title: Morton code의 좌표 비트 수를 늘리면 어떤 비용과 overflow 경계를 확인해야 하나요?
difficulty: 중하
category: 게임 서버
tags:
  - Morton code
  - precision
  - overflow
related:
  - voxel-chunk-boundaries
---
# Morton code의 좌표 비트 수를 늘리면 어떤 비용과 overflow 경계를 확인해야 하나요?

## 구두 답변

축당 bit 수 `b`를 늘리면 표현 가능한 셀 수가 `2^b`로 늘지만, world 범위와 cell size 중 무엇을 고정하는지에 따라 효과가 달라집니다. 2D에서 16비트씩 쓰면 code 폭은 32비트이고, 21비트씩 쓰면 42비트입니다. 42비트가 필요하다고 해서 key가 반드시 64비트로 커지는 것은 아닙니다. 보통 64비트 unsigned 컨테이너에 pack할 수 있지만, 실제 저장·정렬·전송 폭은 schema 계약으로 정합니다.

경계 trace를 예로 들면 `b=16`에서 `qx=65535`는 허용 마지막 값이고 `qx=65536`은 overflow로 거절해야 합니다. `world x=-1`, origin `-1024`, cell `1`이면 `qx=1023`처럼 offset 후 범위 안으로 매핑하고, offset 계산 자체의 signed overflow도 검사합니다. `0x80000000`을 signed 32비트로 비교하면 음수로 해석되므로 `0x7fffffff`보다 앞에 정렬될 수 있습니다. 따라서 unsigned 비교나 order-preserving comparator를 사용하며, 단순 cast에 의존하지 않습니다.

정밀도를 높이면 후보 cell이 작아져 false positive가 줄 수 있지만 index key memory, radix/sort 작업량, interval 수, dynamic object의 경계 통과 횟수가 늘 수 있습니다. origin·cell size·axis order·bit width를 `encoding_version`에 기록하고, query가 다른 version의 key를 만나면 섞어서 비교하지 않고 migration/rebuild를 선택합니다. 테스트는 `0`, `2^b-1`, 음수 origin, 경계 밖, signed 최고 bit, schema mismatch를 포함해야 합니다. 큰 정수 타입이 범위·정렬·호환성 문제를 자동 해결하지는 않습니다.

## 득점 포인트

- bit 증가가 해상도·표현 범위와 code 폭·메모리 비용을 함께 바꾼다고 설명한다.
- signed overflow와 negative coordinate mapping을 경계 테스트로 연결한다.
- origin·cell size·axis order·bit width를 versioned encoding 계약으로 둔다.

## 감점 포인트

- bit를 늘리면 정확도만 좋아지고 비용은 변하지 않는다고 말한다.
- signed code를 그대로 정렬해도 최고 bit에서 문제가 없다고 주장한다.
- 큰 정수 타입을 쓰면 좌표 범위·schema 호환 문제가 자동 해결된다고 설명한다.

## 더 파고들 거리

- 월드 범위와 셀 크기 중 무엇을 고정할지 제품 질의와 연결해 보세요.
- negative coordinate의 order-preserving mapping을 어떤 테스트 벡터로 검증할까요?
- 정밀도를 높인 뒤 interval·candidate p99가 악화되는지 어떻게 측정할까요?
