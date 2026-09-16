---
id: behavior-lifetime
title: Behavior Tree Running·Abort·경로 서비스 예산
topic: 게임 서버
summary: reactive/memory 재평가와 행동 세대·blackboard owner·취소 완료·hysteresis·위험 우선·최신 요청 병합·공정한 탐색을 설명합니다.
questionIds: [behavior-tree-running, behavior-tree-action-oscillation, npc-path-service-fairness]
---

# Behavior Tree Running·Abort·경로 서비스 예산

## Running은 다음 틱까지 이어지는 자원의 Owner입니다

Behavior Tree node는 Success·Failure 외에 Running을 반환할 수 있습니다. 이동 node가 Running일 때 경로 요청·timer·animation·예약·callback이 살아 있습니다. 상위 위험 조건이 도주를 선택했다고 이전 이동이 자동 종료되지 않습니다.

reactive sequence는 앞 조건을 다시 보며 높은 반응성을 얻지만 반복 abort가 늘 수 있습니다. memory sequence는 진행 위치를 기억해 재실행을 줄이지만 조건 변화에 늦을 수 있습니다. 사용하는 실행기의 정확한 재개·abort 계약을 정하고 둘 중 무엇이든 정리 책임을 둡니다.

## 새 행동만 Blackboard를 바꿀 수 있게 합니다

이동 generation 8에서 도주 9로 전환했다고 가정합니다. request 31의 경로가 뒤늦게 성공해도 generation 8이면 새 목표를 덮지 못해야 합니다. 결과에는 entity ID/generation·action generation·request ID·goal/map/profile version을 붙입니다. blackboard key별 writer와 적용 조건을 명시합니다.

```diagram
{"title":"옛 이동의 성공도 현재 행동과 다르면 적용하지 않습니다","caption":"화살표는 비동기 결과 경로입니다. generation 검사는 늦은 결과 적용을 막지만 실제 worker 종료와 참조 회수는 별도로 확인합니다.","rows":[[{"id":"move","label":"이동 action 8 · path request31"}],[{"id":"flee","label":"위험 발생 · abort · 도주 action9"}],[{"id":"late","label":"request31 늦은 성공"}],[{"id":"gate","label":"현재 action/request 대조"}],[{"id":"discard","label":"불일치 결과 폐기·자원 정리"}]],"edges":[{"from":"move","to":"flee","label":"우선 행동 전환"},{"from":"move","to":"late","label":"계산은 남을 수 있음"},{"from":"late","to":"gate","label":"세대 확인"},{"from":"gate","to":"discard","label":"8≠9"}]}
```

도주 같은 새 행동으로 abort할 때는 path 취소를 요청하고, 옛 action이 잡은 예약과 timer를 해제하며 animation을 전환합니다. 실제 이동 자원을 옛 action이 아직 사용 중이면 `Cancelling` 내부 상태로 종료를 기다리거나 소유권을 명시적으로 이전해 새 action이 같은 자원을 중복 사용하지 않게 합니다.

action generation을 올려 결과를 논리적으로 무효화하는 것과 worker·callback이 물리적으로 종료되어 참조가 회수되는 것은 별개이므로, 해제된 map pointer를 generation 검사만으로 안전하게 만들 수 없습니다.

## 추적과 도주의 흔들림에는 다른 임계값을 둡니다

위험 점수 0.5 주변에서 매 tick 추적/도주가 바뀌면 path와 timer가 계속 재시작됩니다. 예를 들어 도주 진입 0.7·복귀 0.3처럼 hysteresis, 최소 유지 시간·재진입 cooldown을 사용할 수 있습니다. 숫자는 게임 정책 예시이며 치명적인 사망·기절·즉시 위험 abort보다 우선하지 않습니다.

조건·action generation·start/abort 이유·마지막 진행을 기록해 실제 위험 변화와 늦은 callback 상태 역전을 구분합니다. blackboard 변경도 관련 조건만 깨우는 이벤트 경로를 둘 수 있으나 dependency 누락을 전수 재평가 기준과 비교해야 합니다.

## 공유 Path 서비스는 최신 의도와 총량을 관리합니다

| 경계 | 정책 |
| --- | --- |
| NPC queue | 최신 goal만 유지·옛 의도 coalesce |
| 전체 queue | 수·bytes·snapshot 보유 상한 |
| worker | 실제 실행 permit·취소 후 종료 확인 |
| 공정성 | round-robin·최소 진행·비용 budget |
| map 변화 | 지역별 병합·재계산 phase 분산 |
| 결과 | 현재 generation·profile/version 확인 |

같은 문 변경이 들어와도 요청을 한꺼번에 실행하지 않고, NPC별 최신 goal만 남겨 옛 의도를 합칩니다. low priority에도 round-robin이나 최소 진행 규칙으로 기회를 주되, 실행 시점에 만료된 goal은 건너뜁니다. 취소된 요청을 장부에서 제거했더라도 실제 계산이 끝나지 않았다면 worker permit과 취소 후 종료 확인을 유지합니다. 실패한 요청은 원인·backoff·다음 재시도 조건을 반환해 무한 재탐색을 막고, map 변화는 지역별 병합과 재계산 phase 분산으로 처리합니다.

## 반응성과 정리 비용을 같이 검증합니다

이동 중 도주·abort 직후 완료·서버 종료·목표 연속 변경·shared service 포화·진동 조건을 시험합니다. 현재 action의 위치/예약이 옛 callback으로 바뀌지 않는지, 최대 대기·폐기 결과·snapshot 수명·회피 반응·틱 비용을 확인합니다. 이 노트는 행동 수명 설계이며 실제 Behavior Tree 엔진 실험 결과는 아닙니다.
