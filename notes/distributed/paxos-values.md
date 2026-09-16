---
id: paxos-values
title: Paxos Prepare·Accept와 Multi-Paxos 로그 계승
topic: 분산 시스템
summary: 내구 promise·최고 accepted ballot의 값 계승을 추적하고 competing proposer·stable leader·빈 슬롯 no-op·chosen·learned·apply를 설명합니다.
questionIds: [paxos-prepare-accept, paxos-competing-proposers-liveness, multi-paxos-leader, multi-paxos-noop-gap, paxos-chosen-apply-prefix]
---

# Paxos Prepare·Accept와 Multi-Paxos 로그 계승

## 새 Proposer가 언제나 자기 값을 선택하면 이전 결정을 잃습니다

acceptor A·B·C에서 ballot 7의 X를 A와 B가 수락했다면 X는 과반에 선택된 chosen 값입니다. proposer가 응답을 받기 전에 죽어도 그 사실은 생겼습니다. 새 proposer가 ballot 8로 B·C에 prepare하면 B의 accepted X를 보고 X를 이어받아야 합니다. C가 비어 있다는 이유로 Y를 새로 고르면 안 됩니다.

prepare는 새 proposer가 높은 ballot을 제시해 acceptor에게 그보다 낮은 ballot의 제안을 더는 수락하지 않겠다는 promise와 과거 accepted ballot·value를 함께 요청하는 단계입니다. proposer는 prepare quorum 응답에서 가장 높은 accepted ballot의 value를 골라 accept(n,v)로 다시 제안하고, 과거 수락이 없을 때만 새 값을 넣습니다.

따라서 이 절차는 데이터를 복사하는 일이 아니라, 이미 chosen됐을 수 있는 값과 이후 quorum 결정이 충돌하지 않도록 가장 높은 이전 수락을 다음 제안에 이어가는 안전 규칙입니다.

## Promise와 Accepted 기록은 응답 전에 보존합니다

acceptor는 더 낮은 ballot을 받지 않겠다는 promised ballot과 accepted ballot·value를 안정 저장소에 기록해야 합니다. 응답 뒤 저장 전에 중단되면 재시작 후 옛 제안을 다시 받아들일 수 있습니다. ballot은 고유하고 전체 비교 가능해야 하며 같은 슬롯·ballot에 다른 값을 제안하지 않는 규칙이 필요합니다.

| 단계 | proposer가 얻는 것 | 지켜야 할 규칙 |
| --- | --- | --- |
| prepare(n) | quorum의 promise와 accepted 기록 | 높은 수락 ballot의 value 선택 |
| accept(n,v) | 필요한 acceptor의 수락 | promised ballot보다 낮은 제안 거절 |
| chosen | 한 슬롯의 값이 quorum 수락됨 | 다른 값으로 바꾸지 않음 |
| learned | 관찰자가 chosen 사실을 앎 | 모든 관찰자가 동시에 알 필요 없음 |
| applied | 상태 머신에 반영 | log의 연속 순서·dedup 필요 |

기존 accepted 값 중 가장 많은 표를 받은 값이나 값 자체가 가장 큰 것을 고르는 것이 아닙니다. prepare 응답 quorum에서 **가장 높은 accepted ballot의 값**을 선택합니다. 한 acceptor만 수락했던 값이라도 그 응답에서 최고라면 이어받을 수 있습니다. 이것은 그 값이 이미 chosen이라는 판정이 아니라 안전한 다음 제안을 만드는 규칙입니다.

```diagram
{"title":"새 Prepare는 겹치는 Acceptor의 수락값을 이어받습니다","caption":"화살표는 예시 quorum 응답입니다. A·B가 ballot 7의 X를 수락한 뒤 새 proposer가 B·C에서 promise를 얻으면 B의 X를 보존해야 합니다.","rows":[[{"id":"b","label":"B · accepted (7,X)"},{"id":"c","label":"C · accepted 없음"}],[{"id":"prepare","label":"새 proposer · ballot 8"}],[{"id":"accept","label":"accept(8,X) 제안"}]],"edges":[{"from":"b","to":"prepare","label":"promise + 이전 X"},{"from":"c","to":"prepare","label":"promise + 없음"},{"from":"prepare","to":"accept","label":"최고 수락 ballot의 값"}]}
```

## 경쟁 Proposer는 안전해도 진도를 못 낼 수 있습니다

P가 ballot 8의 promise를 얻은 뒤 Q가 9를 얻으면 P의 accept가 거절될 수 있습니다. P가 10으로 다시 prepare하는 일을 계속 반복하면 같은 값 보존은 유지하면서 chosen을 못 만들 수 있습니다. 안정 leader·선거 조정·backoff·jitter는 진행성을 돕지만 최고 accepted 값 계승 규칙을 대체하지 않습니다.

모든 노드 응답을 요구하는 것으로 해결하면 작은 장애에도 멈춥니다. 정한 quorum·동기성 가정·eventual stable leadership 아래의 진행 조건을 확인합니다. 안전성과 지연 SLO는 다른 성질입니다.

## Multi-Paxos는 준비된 Ballot을 여러 슬롯에 재사용합니다

단일 Paxos는 한 슬롯의 값을 선택하고 log는 여러 슬롯을 필요로 합니다. stable leader가 필요한 슬롯 범위에 대한 promise와 과거 accepted 정보를 확보하면 같은 ballot의 accept를 여러 슬롯에 진행해 매 슬롯 prepare 비용을 줄일 수 있습니다. prepare를 아무 근거 없이 생략하는 것은 아닙니다.

다른 proposer가 더 높은 promise를 확보하면 옛 leader의 accept는 거절됩니다. 새 leader는 슬롯별 accepted 정보를 조사하고 각 슬롯의 최고 ballot 값을 보존합니다. chosen 여부를 완전히 알지 못하는 accepted 기록도 임의로 지우지 않습니다. snapshot·log 정리와 ballot·슬롯 범위의 내구성은 구현의 정확한 규칙을 따릅니다.

## 빈 슬롯을 건너뛰지 말고 안전하게 채웁니다

슬롯 12가 chosen이어도 11이 아직 미정이면 순차 상태 머신은 10 뒤에 12를 먼저 적용하지 않습니다. 새 leader가 prepare로 이전 accepted 값을 확인하고 보존할 값이 없는 슬롯에만 새 명령 또는 no-op을 제안합니다. no-op도 accept quorum으로 chosen되어야 하며 로컬 배열의 빈 칸을 채우는 것으로 대신하지 않습니다.

chosen은 결정 사실, learned는 그 사실을 아는 상태, applied는 순차 실행입니다. 클라이언트에 단순 접수 성공을 말하는지 실제 업무 결과를 말하는지에 따라 필요한 단계가 다릅니다. 요청 ID별 결과를 state machine·snapshot에 저장해 응답 유실 뒤 다른 슬롯에 실린 재요청이 효과를 반복하지 않게 합니다.

## 외부 효과와 프로토콜 검증을 분리합니다

각 replica의 apply에서 메일·결제를 직접 호출하지 않고 결정적인 상태와 내구 실행 의도를 기록합니다. 외부 worker의 소유·멱등 키·결과 조회는 별도입니다. prepare 저장 전후 중단, accept 저장 후 응답 유실, 늦은 낮은 ballot, 경쟁 proposer, 11의 gap을 재현해 슬롯별 단일 chosen과 연속 apply를 검사합니다.

현재 작업에서는 Paxos 구현·모델 checker를 실행하지 않았습니다. 본문은 고정 quorum crash 모델의 교육용 원리이며 Byzantine 합의나 모든 Multi-Paxos 구현의 완전한 명세가 아닙니다.
