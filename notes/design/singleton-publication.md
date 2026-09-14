---
id: singleton-publication
title: Singleton의 생성·공개·변경·종료는 다른 문제입니다
topic: 설계
summary: 유일한 인스턴스와 전역 가변 상태를 구분하고 언어별 lazy 실패·재진입·안전 공개·이후 동기화·조립 수명·프로세스 범위를 설명합니다.
questionIds: [singleton-global-state, lazy-initialization-publication-failure]
---

# Singleton의 생성·공개·변경·종료는 다른 문제입니다

## 객체 하나의 Counter도 증가를 잃을 수 있습니다

thread A와 B가 singleton.counter=10을 읽고 각각 11을 저장하면 두 증가 후에도 11입니다. 인스턴스가 하나라는 사실은 read-modify-write 원자성과 다릅니다. 반대로 불변 설정의 여러 복사본은 공유 변경이 없어서 안전할 수 있습니다. 유일성·전역 접근·가변 상태는 서로 다른 축입니다.

프로세스 안에서 한 객체를 만들고 필요한 곳에 전달하면 전역 locator 없이 공유할 수 있습니다. 다른 process·class loader 등은 또 다른 범위이므로 process singleton이 분산 시스템의 유일한 소유권을 만들지 않습니다.

## 초기화한 뒤 공개해야 합니다

첫 접근이 겹쳐 중복 생성하거나 반쯤 초기화된 객체가 보이지 않도록 언어의 검증된 static/lazy 초기화 기능을 우선합니다. 직접 double-checked locking을 구현하면 atomic/volatile·메모리 순서·객체 수명이라는 언어별 전제가 필요합니다. 생성 중 this를 callback·전역에 넘겨 불완전 객체를 노출하지 않습니다.

```diagram
{"title":"한 번의 생성 뒤에도 수명과 변경 검사가 남습니다","caption":"화살표는 객체 수명입니다. 안전한 초기화가 이후 가변 필드의 동기화나 종료 순서를 자동 보장하지 않습니다.","rows":[[{"id":"create","label":"동시 첫 접근·초기화"}],[{"id":"publish","label":"완성 후 안전한 공개"}],[{"id":"use","label":"내부 변경 동기화·snapshot"}],[{"id":"stop","label":"사용 작업 종료·자원 close"}]],"edges":[{"from":"create","to":"publish","label":"실패 정책 확인"},{"from":"publish","to":"use","label":"읽기·쓰기 계약"},{"from":"use","to":"stop","label":"명시적 owner"}]}
```

## 생성 예외의 재시도는 언어·기능마다 다릅니다

C++ 함수 local static은 초기화가 예외로 끝나면 완료된 것으로 간주하지 않아 이후 접근에서 재시도할 수 있습니다. Java class initialization 실패는 해당 class를 erroneous 상태로 만들며 같은 class loader에서 단순 접근마다 초기화가 다시 성공할 때까지 반복되는 모델이 아닙니다. 별도 lazy wrapper도 실패 캐시·재시도 정책이 다를 수 있습니다.

재시도되는 초기화가 외부 파일·network 효과를 이미 수행했다면 중복 효과를 처리해야 합니다. 초기화 함수의 자기 재진입·서로 의존하는 singleton cycle은 deadlock·잘못된 재귀 등 문제를 만들 수 있어 의존을 끊고 실패 상태를 명시합니다. 느린 I/O를 숨겨 첫 사용자 요청의 지연을 갑자기 키우지 않습니다.

| 단계 | 별도 설계 |
| --- | --- |
| 생성 | 한 번 또는 명시적 재시도·부분 자원 정리 |
| 공개 | 완전 초기화와 memory visibility |
| 변경 | lock·atomic·불변 snapshot 교체 |
| 종료 | 사용자가 먼저 종료·자원 나중 close |
| 테스트 | 새 객체 그래프·전역 상태 누수 차단 |

## 공유 객체의 Owner를 조립 지점에 둡니다

`GlobalConfig.instance()`를 모든 정책이 직접 찾으면 테스트 설정·초기화 순서·종료 의존이 숨습니다. 시작점에서 만들어 주입하고 요청별 주체·취소 상태는 요청 수명으로 둡니다. 테스트마다 전역을 reset하면 병렬 test와 충돌할 수 있어 새 객체 그래프가 더 명확합니다.

종료 중 다른 객체가 이미 닫힌 logger를 호출하지 않도록 작업 정리·pool close·log flush 순서를 정합니다. 정상 초기화·동시 접근·생성 실패·cycle·설정 교체·shutdown을 각각 검증합니다. 이 노트는 언어와 수명 계약 설명이며 해당 lazy 실패 예제를 이 작업에서 별도로 실행한 결과는 아닙니다.
