---
id: mesi-read-write-transition
title: 두 코어가 같은 cache line을 읽은 뒤 한 코어가 쓰려고 합니다. MESI에서 어떤 상태 전이와 무효화가 일어나나요?
difficulty: 하
category: 동시성
tags:
  - MESI
  - coherence
  - invalidate
  - cache line
related:
  - cache-readonly-sharing-versus-writes
---
# 두 코어가 같은 cache line을 읽은 뒤 한 코어가 쓰려고 합니다. MESI에서 어떤 상태 전이와 무효화가 일어나나요?

## 구두 답변

두 코어가 `L`을 읽은 뒤 A와 B가 각각 `S` 복사본을 갖고 있다고 하겠습니다. 초기 메모리 값이 0이면 상태는 `A=S, B=S, L=0`입니다. A가 `L=1`을 store할 때 A의 캐시 바이트만 바꾸면 B가 0을 가진 유효 복사본을 계속 보게 되므로, 먼저 쓰기 권한 획득 절차가 필요합니다. snoop을 쓰는 구현에서는 다른 캐시의 공유 상태를 관찰해 invalidate를 전달하고, directory를 쓰는 구현에서는 디렉터리가 공유자 집합을 갱신합니다. 어떤 경로든 B는 `I`가 되고 A는 단독 최신 보유자가 된 뒤 `M`으로 기록하는 것이 이 상태 모델의 핵심입니다. 실제 메시지 이름을 모든 CPU에 적용하면 안 됩니다.

중간 상태를 `t0: A=I, B=I, memory=0`, `t1: A load → A=E`, `t2: B load → A=S, B=S`, `t3: A store 요청 → 권한 획득 중`, `t4: A=M, B=I, A의 값=1`로 적으면 store 명령 발행과 권한 완료를 구분할 수 있습니다. B가 t4 뒤 다시 load하면 `I`라서 소유자 전달 또는 하위 캐시 경로에서 라인을 채우고 1을 읽습니다. 단, B가 이전 load 결과를 레지스터에 `r=0`으로 저장했다면 invalidate가 그 레지스터를 소급 수정하지는 않습니다. cache miss도 주소 매핑 실패인 page fault와 다릅니다.

마지막으로 `M`은 캐시 라인의 쓰기 권한이지 애플리케이션 객체의 논리적 잠금이 아닙니다. 여러 필드의 불변식이나 C++ data race는 mutex, atomic, release/acquire로 별도 해결해야 합니다. 같은 라인에 두 writer를 두면 권한 왕복과 false sharing이 늘어 padding이나 local aggregation을 검토하지만, padding은 메모리를 늘리고 aggregation은 최신성 지연을 만듭니다. 구현 설명에서는 상태 전이, 데이터 공급자, 언어 동기화 층을 각각 표로 확인하겠습니다.

## 득점 포인트

- 공유 상태에서 쓰기 권한을 얻는 `S→쓰기 요청→M`, 상대 복사본의 `S→I`를 t0부터 t4까지 추적합니다.
- invalidate가 캐시 복사본을 무효화할 뿐 이미 레지스터에 저장된 값을 고치지 않는다는 점을 구분합니다.
- MESI의 하드웨어 권한과 C++ 원자성·happens-before를 별도 계약으로 설명합니다.

## 감점 포인트

- A의 store 순간 B의 레지스터가 자동으로 1이 된다고 말하면 invalidate의 범위를 잘못 설명한 것입니다.
- 모든 구현이 정확히 BusUpgr만 사용한다고 단정하면 snoop과 directory의 구현 차이를 지웁니다.
- M 상태를 애플리케이션 객체의 논리적 잠금으로 해석하면 data race와 불변식 문제를 놓칩니다.

## 더 파고들 거리

- A의 M 라인을 B가 읽을 때 데이터가 소유자와 하위 계층 중 어디서 공급되는지 상태표로 확장합니다.
- 동일 cache line의 두 writer와 padding 대조군에서 line 왕복과 p99를 함께 측정합니다.
