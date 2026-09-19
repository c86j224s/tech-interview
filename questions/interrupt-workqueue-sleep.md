---
id: interrupt-workqueue-sleep
title: >-
  deferred callback에서 메모리 할당과 블로킹 I/O가 필요합니다. softirq callback 대신 어떤 실행 문맥을 선택해야
  하나요?
difficulty: 하
category: 운영체제
tags:
  - workqueue
  - sleep
  - softirq
  - blocking
related:
  - async-api-and-blocking
---
# deferred callback에서 메모리 할당과 블로킹 I/O가 필요합니다. softirq callback 대신 어떤 실행 문맥을 선택해야 하나요?

## 구두 답변

메모리 할당이 잠들 수 있거나 블로킹 I/O가 필요하면 `WQ_BH`나 임의의 softirq callback이 아니라 threaded workqueue 같은 worker 문맥을 선택합니다. `WQ_BH`는 softirq에서 실행되므로 sleep할 수 없고, 지금까지 우연히 빨리 반환됐다는 실험은 API 계약을 바꾸지 않습니다. softirq에는 acknowledgement, descriptor 확인, 짧은 non-blocking 상태 이동만 남기고, 블로킹 작업을 수행할 객체의 소유권과 수명을 worker에 넘깁니다.

예를 들어 NIC descriptor를 파일에 저장해야 한다면 softirq는 descriptor를 pending queue에 넣고 worker를 예약합니다. worker는 필요한 잠금을 짧게 잡아 buffer를 떼어낸 뒤 잠금 밖에서 파일 I/O를 수행하고, 완료 후 refcount 또는 sequence 규칙에 따라 descriptor를 반납합니다. 장치 제거가 시작되면 새 IRQ와 예약을 막고, 이미 큐에 들어간 work를 cancel/flush한 다음에야 buffer와 callback이 참조하는 객체를 해제합니다. IRQ disable이나 wake 한 번은 callback 완료 barrier가 아닙니다.

worker 문맥도 무제한 안전 지대는 아닙니다. 일반 workqueue는 `max_active`와 queue 속성에 따라 callback이 병렬 실행될 수 있고, 같은 연결의 packet 순서가 필요하면 ordered 정책이나 명시적 sequence를 둬야 합니다. reclaim 중 sleepable allocation이 필요하면 `WQ_MEM_RECLAIM` 계약을 검토하지만 이것이 모든 자원 부족을 해결하지는 않습니다. 선택 기준은 sleep 여부, 허용 지연, 동시성, 순서, shutdown lifetime이며, softirq에서 malloc이 한 번 성공했다는 사실보다 문맥이 sleep을 허용하는지의 readable kernel contract를 우선합니다.

## 득점 포인트

- sleepable allocation과 blocking I/O는 WQ_BH가 아닌 worker 문맥으로 보내는 판단을 직접 답합니다.
- softirq pending queue→worker I/O→descriptor 반납의 소유권과 shutdown flush 순서를 trace합니다.
- worker도 `max_active`, ordered 여부, reclaim capacity에 따라 병렬성과 진행 조건이 달라짐을 설명합니다.

## 감점 포인트

- softirq에서 malloc이 우연히 성공한 실행을 sleep 허용 계약으로 일반화하면 안 됩니다.
- workqueue가 모든 callback을 전역 순서로 실행한다고 하면 병렬 callback 경쟁을 놓칩니다.
- flush 전에 descriptor나 callback 객체를 해제하면 use-after-free 경계가 생깁니다.

## 더 파고들 거리

- 장치 제거 중 IRQ 차단·work 취소/flush·buffer 해제의 happens-before를 순서도로 적습니다.
- 순서가 필요한 packet과 병렬 처리 가능한 변환 작업을 queue 정책으로 나눕니다.
