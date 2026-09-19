---
id: mesi-snoop-invalidate
title: >-
  한 코어의 store가 다른 코어의 캐시 복사본을 stale하게 만듭니다. snoop과 invalidate가 load 결과를 어떻게 바꾸는지
  설명해 보세요.
difficulty: 하
category: 동시성
tags:
  - MESI
  - snoop
  - invalidate
  - coherence
related:
  - cpu-cache-false-sharing
---
# 한 코어의 store가 다른 코어의 캐시 복사본을 stale하게 만듭니다. snoop과 invalidate가 load 결과를 어떻게 바꾸는지 설명해 보세요.

## 구두 답변

snoop 기반 coherence에서는 A의 store가 같은 라인을 가진 B의 캐시 상태를 관찰하고, B의 `S` 복사본을 `I`로 바꾸는 invalidate 경로를 거칩니다. directory 기반 구현이라면 모든 캐시를 직접 snoop하지 않고 디렉터리가 공유자 목록을 사용하므로, 일반 설명에서는 “coherence 조회·invalidate 경로”라고 말하고 snoop을 특정 구현의 예로 한정해야 합니다. 상태 변화가 B의 레지스터를 수정한다는 뜻은 아닙니다.

예를 들어 처음 `x=0`, `A=S, B=S`이고 B가 `r0=load(x)`를 실행해 0을 얻었다고 하겠습니다. 그 다음 A가 `x=1`을 store하면 권한 획득과 함께 B의 line은 `I`가 됩니다. B가 이미 계산한 `r0`은 여전히 0이지만, 이후 `r1=load(x)`는 유효한 캐시 복사본이 없으므로 miss가 됩니다. A가 가진 Modified 데이터나 하위 cache 계층에서 line을 전달받아 B는 `r1=1`을 얻는 것이 전형적인 trace입니다. 이 과정은 유효한 가상 주소에 대한 cache miss이지 page fault가 아닙니다. 또한 반드시 DRAM까지 내려간다고 단정할 수 없습니다.

이 질문에서 중요한 실패 경계는 “A가 store했으니 모든 코어의 값이 즉시 바뀐다”와 “B의 다음 load가 언제나 특정 cycle에 1을 본다”를 구분하는 것입니다. coherence는 같은 주소의 유효 복사본을 조정하지만, `flag`를 본 뒤 `data`를 읽는 cross-address 순서나 C++ happens-before를 자동으로 만들지 않습니다. 그 요구에는 acquire/release, fence, mutex 같은 상위 계약이 필요합니다. 측정할 때는 B의 line 상태, miss latency, owner-to-owner 전달 여부를 분리하고, snoop·directory 메시지와 PMU event 이름은 대상 마이크로아키텍처 문서에서만 확정하겠습니다.

## 득점 포인트

- snoop은 snoop 기반 구현의 coherence 관찰 경로로 한정하고 directory 구현과 구분합니다.
- `r0=0`으로 이미 읽은 B의 레지스터와 invalidate 뒤 `r1=1`을 얻는 다음 load를 분리해 설명합니다.
- cache miss와 page fault를 나누고 데이터 공급자가 DRAM으로 고정되지 않음을 말합니다.

## 감점 포인트

- A의 store가 모든 코어의 레지스터를 즉시 갱신한다고 말하면 과거 계산 결과와 캐시 상태를 혼동한 것입니다.
- invalidate 뒤 B가 반드시 메인 메모리만 읽는다고 하면 owner forwarding과 하위 cache 경로를 누락합니다.
- coherence invalidate가 flag/data의 cross-address ordering까지 만든다고 하면 상위 동기화를 과장합니다.

## 더 파고들 거리

- A의 Modified line에서 B로 전달되는 최신 데이터와 B의 새 상태를 구현별로 비교합니다.
- 같은 주소의 coherence와 release/acquire 공개 순서를 두 개의 시간축으로 그립니다.
