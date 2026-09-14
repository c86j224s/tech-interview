---
id: agent-runtime
title: AI 에이전트의 관찰·실행·검증
topic: AI 에이전트
summary: 모델의 행동 제안과 실행기의 권한·도구·내구 상태·평가를 분리해 설계합니다.
questionIds: [agent-workflow-autonomy, agent-loop-observation, agent-tool-contracts, agent-structured-output, agent-context-engineering, agent-context-compaction, agent-human-approval, agent-prompt-injection, agent-durable-execution, agent-evaluation-outcomes, agent-mcp-roles, agent-a2a-vs-mcp]
---

# AI 에이전트의 관찰·실행·검증

## 모델과 실행기는 다른 책임입니다

고정 워크플로는 코드가 경로를 정하고, 에이전트는 모델이 관찰 결과에 따라 다음 도구·단계를 선택할 수 있습니다. 모든 일을 자율화할 필요는 없습니다. 인가·금액 한도·입력 검사처럼 반드시 지켜야 하는 조건은 실행 코드에서 강제합니다.

```text
state = load durable task state
while budget remains:
    observation = select relevant trusted/untrusted evidence
    proposal = model(goal, state, allowed_tools, observation)
    if proposal is final:
        verify actual outcome; finish or report incomplete
    else:
        validate schema, authorization, approval, budget
        execute tool with stable logical operation ID
        record result, uncertainty, and artifacts
        update task state
```

모델이 도구 호출을 생성한 것, 도구가 접수한 것, 외부 상태가 변경된 것, 결과를 검증한 것은 각각 다른 단계입니다.

## 도구 계약

좋은 도구는 목적·입력 단위·대상 ID·반환 상태가 명확합니다. `prepare_refund`와 `execute_refund`처럼 초안과 실제 실행을 나눌 수 있습니다. JSON Schema는 형식을 제한하지만 올바른 대상·금액·권한을 증명하지 않습니다.

접수·진행·부분 성공·완료·불확정 오류를 구분합니다. 큰 출력은 잘림·다음 페이지·원문 참조를 명시합니다. 도구 설명의 read-only 표시는 구현의 안전성을 독립적으로 보증하지 않습니다.

## 문맥과 장기 상태

현재 판단에 필요한 지침·작업 상태·자료·도구만 넣고 큰 원문은 참조로 관리할 수 있습니다. 요약은 손실 과정이므로 승인 범위·완료 증거·미확정 외부 작업·버전을 유지합니다.

대화 요약만으로 외부 실행을 복구하지 않습니다. 메일 발송 성공 뒤 checkpoint 전에 종료되면 중복 발송이 가능하므로 논리 키·결과 조회·내구 원장이 필요합니다. 장기 메모리에는 직접 진술·관찰·추론의 출처와 유효 범위를 구분합니다.

## 권한과 인젝션

웹페이지·도구 결과·다른 에이전트 보고는 외부 데이터입니다. 그 안의 명령이 사용자 승인이나 host 정책을 바꾸지 못하게 합니다. 입력 필터·모델 지시는 보조 방어이며 sandbox·파일 범위·네트워크 목적지·자격·실행 한도를 함께 제한합니다.

사람 승인은 실제 대상·인자·버전·기한에 묶습니다. 승인 뒤 수신자나 금액이 바뀌면 다시 확인해야 합니다. 읽을 수 있는 사내 자료가 모든 외부 모델로 전송 가능한 것은 아닙니다.

## MCP·A2A의 위치

MCP는 도구·자료 연결의 계약, A2A는 원격 에이전트의 작업·메시지·산출물 상호운용을 다루는 계약으로 구분할 수 있습니다. 어느 프로토콜도 결과의 사실성·사용자 승인·외부 exactly-once를 자동 보장하지 않습니다.

구체적인 버전 변화와 확인한 출처는 저장소의 `docs/agent-sources.md`에 기록되어 있습니다. 최신 명세와 실제 SDK·서버 지원, 코어와 선택 확장은 별도로 확인해야 합니다.

## 실제 결과로 평가하기

과제(task), 실행(trial), 이력(trace), 환경 결과(outcome)를 나눕니다. 예약했다고 말한 답변이 아니라 실제 예약과 중복·권한 준수를 검사합니다. 코드 채점·모델 평가·사람 보정을 대상에 맞게 조합합니다.

여러 번 중 하나 성공하는 pass@k와 모든 실행이 성공하는 신뢰도는 다릅니다. 같은 모델·자료의 오류는 상관될 수 있습니다. 전체 비용에는 실패 시도·도구·하위 에이전트·검증·수동 보정이 포함됩니다.

## 연습

도구 응답만 유실, 실제 변경 뒤 재시작, 승인 뒤 인자 변경, 외부 문서의 지시, 문맥 압축, 예산 소진을 격리 환경에서 시험합니다. 성공·실패·취소·미완료·불확정 결과가 정직하게 보고되는지 확인합니다.
