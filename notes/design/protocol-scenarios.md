---
id: protocol-scenarios
title: 상태 기반 더미 Client·패킷 Replay·부분 순서
topic: 설계
summary: 실제 연결/인증/직렬화로 업무 원장을 검증하고 golden packet·현재 응답 기반 시나리오·인과 DAG·다중집합·결정적 CI와 부하 시험을 나눕니다.
questionIds: [ci-dummy-client-integration, packet-replay-versus-state-scenario, protocol-test-partial-order]
---

# 상태 기반 더미 Client·패킷 Replay·부분 순서

## 로그인 이후 상태 전이와 업무 원장

더미 client는 server 내부 함수를 직접 호출하는 대신 실제 연결·직렬화·인증을 거쳐 로그인 token으로 후속 요청을 만듭니다. 로그인→행동→보상→재접속 시나리오에서 응답 필드·세션 version·보상 event ID·원장을 검사합니다. 최종 잔액 하나만 보면 중복 효과 후 덮어쓰기를 놓칠 수 있습니다.

보상 commit 뒤 응답만 버리고 같은 논리 요청 ID로 재접속해 재요청합니다. 두 응답이 있는지보다 원장이 한 건이고 실제 증분이 한 번인지 확인합니다. 각 CI에는 고유 계정·room·event namespace를 주어 병렬 실행이 충돌하지 않게 합니다.

## 과거 Bytes 재생과 현재 상태 기반 실행의 검증 범위

| 방법 | 잘 찾는 것 | 놓칠 수 있는 것 |
| --- | --- | --- |
| golden packet·wire replay | 직렬화·경계 byte·과거 순서 회귀 | 만료 token·새 ID·현재 시간 의존 |
| 상태 기반 client | 현재 응답에서 다음 요청·재접속 | server와 같은 client 구현 오류 |
| 부하 test | 처리율·p99·포화·회복 | 낮은 확률의 업무 의미 오류 |

실제 client와 server가 공통 serializer를 쓰면 테스트 작성은 편해도, 두 쪽이 같은 endian 오류를 함께 내면 잘못된 packet이 통과할 수 있습니다. 그래서 중요한 wire 경계에서는 한쪽과 독립된 구현·schema·명시적 golden bytes를 비교해 직렬화와 경계 byte를 따로 확인합니다. replay 데이터에서 원문 token·개인정보·결제 목적지를 제거하고, 격리된 test 자격과 외부 효과 차단을 적용합니다.

## 이벤트 인과 관계와 허용 가능한 부분 순서

로그인 성공 L이 먼저 있어야 행동 승인 A와 환영 알림 W를 처리할 수 있지만, A와 W 서로의 순서는 중요하지 않다면 `L<A`, `L<W` 두 선행 조건만 검사합니다. 그래서 `[L,A,W]`와 `[L,W,A]`는 모두 통과시키고, `[A,L,W]`는 거절합니다.

각 key의 sequence와 event ID를 저장해 어떤 사건이 있었는지 확인하고, 기대 다중집합과 실제 사건을 비교해 누락뿐 아니라 `[L,A,A,W]` 같은 중복 횟수도 셉니다. 전체 로그 순서를 하나로 고정하지 않는 이유는 독립 사건의 합법적인 도착 순서를 실패로 처리하지 않기 위해서입니다.

```diagram
{"title":"독립 알림의 순서는 허용하고 인과는 유지합니다","caption":"화살표는 반드시 앞서야 하는 관계입니다. A와 W 사이에는 선후 제약이 없지만 L 이전에 오면 실패입니다.","rows":[[{"id":"login","label":"L · 로그인 성공"}],[{"id":"action","label":"A · 행동 승인"},{"id":"welcome","label":"W · 환영 알림"}]],"edges":[{"from":"login","to":"action","label":"필수 선행"},{"from":"login","to":"welcome","label":"필수 선행"}]}
```

모든 사건을 집합으로 만들면 `[L,A,A,W]`의 중복이 사라집니다. 모든 순서를 느슨하게 허용하면 인증 전 행동을 놓칩니다. 실제 금지 순서·누락·중복을 주입해 test가 의도한 assertion에서 실패하는지 확인합니다.

## 상태 조건과 Deadline 기반 대기

고정 sleep 뒤 성공을 가정하지 않고 필요한 state/event가 충족될 때까지 제한된 기한으로 기다립니다. 완료 기한·조회 주기·최초 계약 위반을 기록하고 test가 hang하지 않게 합니다. seed·초기 world·server/client version·packet 종류·sequence를 보존하되 비밀 token은 제외합니다.

실패를 줄일 때 이벤트 ID·필수 선후·초기 상태를 유지하며 불필요한 행동을 제거합니다. 타이밍 숫자만 줄였다가 원래 경쟁을 잃지 않도록 합니다.

## 결정적 회귀와 운영형 부하 시험

매 commit에는 작은 결정적 핵심 흐름을, 별도 단계에는 실제 payload·key 편중·cache·세션 길이·오류를 닮은 장기 부하를 둡니다. flaky test를 재시도 통과로 숨기지 않습니다. 이 노트는 통합 검증 설계이며 실제 게임 server 더미 client를 실행한 결과는 아닙니다.
