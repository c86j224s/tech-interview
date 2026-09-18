---
id: agent-a2a-lifecycle
title: 원격 에이전트의 Task·산출물·위임 신뢰
topic: AI 에이전트
summary: MCP 기능 호출과 A2A 목표 위임을 비교하고 message/task/artifact·입력 대기·재구독·종결·취소와 Agent Card·재위임·데이터 최소화를 설명합니다.
questionIds: [agent-a2a-vs-mcp, agent-a2a-task-lifecycle, agent-a2a-trust]
---

# 원격 에이전트의 Task·산출물·위임 신뢰

이 노트의 판단 단위는 “무엇을 호출했는가”가 아니라 “누가 어떤 수명과 결과 책임을 맡는가”입니다. 아래 흐름에서 요청을 받은 client, 작업을 소유하는 원격 server, 결과를 소비하는 사용자를 분리해 보면 연결이 끊기거나 입력이 늦게 도착해도 같은 작업을 안전하게 이어 갈 수 있습니다.

## 내부 LLM 유무보다 중요한 외부 계약의 책임 범위

주문 ID로 주문을 반환하는 기능은 명확한 tool/API 계약입니다. “비용 이상을 조사해 근거 보고서를 만들어 달라”는 요청은 원격 담당자가 경로를 선택하고 추가 입력·여러 산출물을 만들 수 있습니다. MCP는 주로 도구·자료 연결, A2A는 독립 원격 agent와 메시지·작업 수명·산출물을 교환하는 경계입니다. 복잡한 서비스라도 기존 job API로 충분하면 새 프로토콜을 반드시 도입할 필요는 없습니다.

MCP tool이 A2A agent를 감싸는 adapter도 가능하지만 model call ID·MCP request ID·원격 task ID·논리 의도를 잃으면 중복 접수·취소·결과 조회가 불명확해집니다. 원격 agent 내부의 모델·도구 구현은 공개하지 않아도 될 수 있지만 외부 책임은 계약으로 남겨야 합니다.

## Message·Task·Artifact의 역할 구분

| 요소 | 의미 | 잘못된 해석 |
| --- | --- | --- |
| message | 요청·질문·상호작용 | 모든 중요 내용이 영구 history로 복구됨 |
| task | server가 관리하는 stateful 작업 수명 | 연결 종료가 작업 종료 |
| artifact | 작업의 결과 산출물 | 조각 하나가 최종 완성본 |
| Agent Card | endpoint·기능·지원·인증 요구 발견 | 독립 검증된 능력·안전 인증서 |

2026-09-15 확인한 A2A 명세 페이지는 발행 version 1.0.0을 안내합니다. 이 계약에서는 요청의 접수·실행과 완료·실패·취소·거절, 입력/인증 대기 등을 서로 다른 상태로 구분합니다. 따라서 완료·실패·취소·거절 상태의 terminal task에 새 message를 보내면 작업이 임의로 재개된다고 가정하지 않습니다. 단순 상호작용은 task 없이 direct message로 끝날 수도 있습니다.

## 입력 대기·재구독과 Task 식별

입력 대기 UI에는 task ID·목표·현재 요청 필드·상태를 함께 표시하고, 사용자의 답은 그 답을 기다리는 outstanding request에만 연결합니다. 이렇게 해야 다른 task의 질문에 답을 붙이거나 중복 응답을 새 실행으로 만들지 않습니다. 인증·승인이 필요한 경우에는 모델이 사용자의 동의를 대신 만들지 않습니다.

streaming을 광고하는 server의 nonterminal task에 재구독하면 현재 snapshot과 이후 update를 받는 계약을 사용할 수 있습니다. 끊긴 동안 모든 과거 message가 replay된다는 보장은 아닙니다. 필요한 ID·확인 결과·미완료 상태를 client도 내구 기록하고 polling/webhook은 실제 지원 범위를 확인합니다.

```diagram
{"title":"연결이 끊겨도 Task를 기준으로 결과를 확인합니다","caption":"화살표는 관찰·재조회 흐름입니다. message나 artifact 조각만으로 완료를 판단하지 않고 task와 최종 산출물을 따로 검사합니다.","rows":[[{"id":"request","label":"목표·제약·논리 요청 ID"}],[{"id":"task","label":"원격 task ID·상태"}],[{"id":"input","label":"입력 대기·사용자 응답"},{"id":"stream","label":"snapshot·갱신·산출물 조각"}],[{"id":"verify","label":"종결 상태·최종 산출물 검증"}]],"edges":[{"from":"request","to":"task","label":"제한된 위임"},{"from":"task","to":"input","label":"추가 조건"},{"from":"task","to":"stream","label":"지원된 관측"},{"from":"input","to":"verify","label":"상태 전이 확인"},{"from":"stream","to":"verify","label":"완전성 확인"}]}
```

artifact ID·append/replace 의미를 지켜 조각을 결합하고 중복 수신으로 문단을 중복 추가하지 않습니다.

예를 들어 client가 논리 요청 `audit-17`을 보내 task `task-42`를 받고, server가 `input-required`로 멈췄다고 하겠습니다. 재시도는 새 task를 만들기 전에 `audit-17`과 `task-42`의 현재 상태를 조회하고, 사용자의 답을 outstanding request ID에 한 번만 연결해야 합니다. 답이 처리된 뒤 `completed`가 와도 artifact의 ID·버전·필수 항목을 확인한 다음 사용자에게 성공을 표시합니다. 이 순서를 지키면 timeout 뒤 늦게 도착한 성공과 client 재시도로 생긴 중복 작업을 서로 다른 사건으로 진단할 수 있습니다.

실무 선택에서는 단일 동기 조회와 짧은 작업은 direct message나 기존 job API가 단순하고, 추가 입력·스트리밍·여러 산출물·긴 실행이 있으면 task 계약의 가치가 커집니다. 장애 조사에서는 먼저 논리 요청 ID→task ID→artifact ID의 연결이 끊긴 지점을 찾고, 그 다음 상태 전이와 owner 인가를 확인합니다. task completed는 상대의 종료 선언이지 요구 품질·근거·현재 실제 상태까지 참이라는 보장이 아닙니다. 최종 결과를 별도로 검사합니다.

## 인증된 상대에 대한 자료 제공·행동 권한 최소화

세금 보고 초안에는 필요한 기간·항목만 주고 전체 고객 DB·관리자 token을 넘기지 않습니다. 읽기 권한과 외부 전송은 별도입니다. 대상·작업·기간·사용자·재위임 가능 여부·비용·최대 시간을 제한합니다. 상대가 더 많은 자료나 관리자 권한을 요청해도 자동 확대하지 않습니다.

Agent Card의 endpoint·기능·인증 요구가 바뀌면 기존 승인에 자동 포함하지 않습니다. 발견 URL·webhook의 내부망·redirect·DNS와 event 인증을 검증합니다. 상대용 token과 하위 API용 token을 혼동하지 않고 재위임에서 넓은 서비스 계정 권한으로 바뀌지 않게 합니다. Card의 skill은 파일 기반 SKILL.md 패키지와 다릅니다.

## 취소 요청과 이미 발생한 외부 효과

취소 요청은 거절되거나 늦게 반영될 수 있습니다. 메일이 이미 발송됐다면 task cancelled 표시로 되돌아가지 않습니다. 상태 조회·논리 key·외부 결과 대사 후 재시도하고 보상에도 별도 권한을 적용합니다. task/artifact 조회·취소는 ID 소지만으로 허용하지 않고 owner 인가를 확인합니다.

반환 보고서의 “검증 없이 실행하라”는 외부 데이터입니다. 상대가 승인받았다는 보고도 현재 시스템이 인정하는 승인 기록을 대체하지 않습니다. 카드 변경·다른 사용자 조회·재위임·중복 event·입력 대기 재시작·늦은 성공을 시험합니다.

공식 계약은 [A2A 명세](https://a2a-protocol.org/latest/specification/)의 1.0.0 표시와 작업/상호작용 절을 2026-09-15 확인했습니다. latest 링크는 바뀔 수 있습니다. 이 작업에서 실제 A2A server·webhook을 구현해 상호운용 시험을 한 것은 아닙니다.
