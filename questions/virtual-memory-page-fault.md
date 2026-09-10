---
id: virtual-memory-page-fault
title: "호스트에 여유 메모리가 있는데도 프로세스의 페이지 폴트가 늘고 지연이 생깁니다. 어떤 종류의 폴트인지와 실제 디스크 접근이 있는지를 어떻게 확인하나요?"
answerMinutes: 5
followups: [{"id":"tlb-page-table","prompt":"TLB miss와 page fault가 한 요청의 지연에 각각 얼마나 기여하는지 어떤 하드웨어·OS 지표로 나눌까요?"},{"id":"page-replacement-thrashing","prompt":"major fault와 작업 집합 부족으로 인한 스래싱을 어떤 회복 실험으로 구분할까요?"},{"id":"memory-rss-vs-heap","prompt":"객체 해제 뒤 RSS가 유지되는 상황에서 페이지가 재사용 중인지 누수인지 어떻게 추적할까요?"}]
difficulty: 하
category: 운영체제
tags:
  - "가상 메모리"
  - "페이지 폴트"
  - "메모리"
related: ["process-vs-thread"]
---

# 호스트에 여유 메모리가 있는데도 프로세스의 페이지 폴트가 늘고 지연이 생깁니다. 어떤 종류의 폴트인지와 실제 디스크 접근이 있는지를 어떻게 확인하나요?

## 구두 답변

페이지 폴트는 접근한 가상 주소를 현재 페이지 테이블 상태로 즉시 처리할 수 없어 운영체제가 개입한 사건입니다. 따라서 페이지 폴트가 늘었다고 곧바로 RAM 부족이나 swap을 뜻하지는 않습니다. 익명 메모리를 예약한 뒤 처음 쓸 때 물리 페이지를 연결하는 경우, 파일 매핑 페이지를 처음 읽는 경우, copy-on-write로 쓰기 시 복사하는 경우는 정상적인 준비 경로일 수 있습니다. 반대로 존재하지 않는 주소나 쓰기 금지 페이지에 접근하면 프로그램 오류가 될 수 있습니다. 이 분류가 **페이지 폴트 분석**(page-fault analysis)의 출발점입니다.

### minor와 major의 비용을 나눕니다
minor fault는 디스크 읽기 없이 페이지 테이블 갱신, 공유 zero page 연결, 이미 메모리에 있는 파일 페이지 연결 등으로 끝날 수 있습니다. major fault는 저장 장치에서 페이지를 읽어야 하므로 fault 처리 시간이 길고 I/O 대기가 동반될 수 있습니다. 큰 버퍼를 미리 예약한 서버에서 첫 요청 때 minor fault가 튀는 것은 예열 전형일 수 있습니다. 예열하면 첫 요청 지연은 줄지만 사용하지 않는 페이지까지 채워 시작 시간·RSS·메모리 압력을 늘릴 수 있으므로 무조건 최선은 아닙니다.

호스트에 여유 메모리가 보여도 컨테이너 한도, 프로세스의 작업 집합, 파일 매핑, NUMA 배치 때문에 fault와 지연이 늘 수 있습니다. RSS 감소·reclaim·swap·major fault·저장 장치 지연이 함께 늘면 페이지가 메모리에 남지 못하고 다시 읽히는지 봅니다. 반대로 fault는 늘었지만 저장 장치 대기가 없고 시작 구간에만 집중되면 lazy allocation이나 매핑 초기화 가능성이 큽니다. 권한 오류는 메모리를 늘려 해결할 대상이 아니라 코드와 보호 계약을 고칠 대상입니다.

### 원인과 대응을 같은 시간축에 놓습니다
프로세스별 virtual size와 RSS, minor/major fault, page-in·reclaim·swap, 저장 장치 latency, 요청 p99를 기록합니다. 첫 접근 예열 전후, memory pressure, file mapping, copy-on-write와 잘못된 접근을 별도 실험으로 나눕니다. 대응은 무조건 메모리를 늘리는 대신 캐시·동시성·접근 지역성·페이지 크기를 조정하고, trim이나 예열이 만든 후속 fault 비용까지 확인하는 순서로 진행하겠습니다.

프로세스가 보고한 fault 수와 저장 장치가 처리한 읽기를 분리해야 합니다. 파일 페이지가 이미 page cache에 있으면 fault handler가 매핑만 만들고 끝날 수 있고, 익명 페이지의 첫 쓰기는 zero page에서 private page로 바뀌는 경로일 수 있습니다. copy-on-write는 읽을 때가 아니라 쓰는 순간 fault와 RSS 증가를 만들 수 있습니다. 반대로 major fault가 한 번뿐이어도 그 요청의 p99를 크게 늘릴 수 있습니다.

예열 전후, memory pressure, file mapping, copy-on-write, 잘못된 권한 접근을 별도 실험으로 나누겠습니다. minor·major fault, page-in·reclaim·swap, RSS·virtual size, 저장 장치 latency와 요청 trace를 연결하고, fault 수가 줄어도 저장 장치 대기나 메모리 압력이 악화됐는지 확인합니다. 권한 fault는 메모리 증설이 아니라 코드와 보호 계약을 수정할 대상입니다.

페이지 폴트의 평균 횟수보다 fault가 발생한 요청의 tail이 중요할 수 있습니다. major fault가 한 번뿐이어도 저장 장치 지연이 그 요청을 p99 밖으로 밀어낼 수 있고, minor fault가 대량이면 CPU를 잠식할 수 있습니다. fault 종류와 duration을 trace의 요청 경계에 연결해 대응 우선순위를 정하겠습니다.

## 득점 포인트

- 페이지 준비·파일 매핑·copy-on-write·접근 오류를 하나의 fault로 뭉개지 않는다.
- minor·major fault와 저장 장치 접근을 구분한다.
- 예열·메모리 압력·접근 지역성을 같은 시간축으로 검증한다.

## 감점 포인트

- 모든 페이지 폴트가 swap을 의미한다고 말한다.
- 가상 주소 예약량을 실제 상주 메모리로 해석한다.
- 메모리를 늘리면 권한 오류와 fault 원인이 항상 해결된다고 말한다.

## 더 파고들 거리

- memory-mapped 파일의 첫 접근과 일반 read의 fault·복사 비용은 어떻게 다른가요?
- copy-on-write가 page fault와 RSS 증가를 어떤 순서로 만들까요?
- 대형 페이지를 적용할 때 fault 단위와 TLB 비용을 어떻게 비교할까요?
