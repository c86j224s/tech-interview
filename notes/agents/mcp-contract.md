---
id: agent-mcp-contract
title: MCP 역할·기본 요소·리비전별 실행 계약
topic: AI 에이전트
summary: host/client/server와 tools/resources/prompts를 구분하고 2026-07-28의 요청별 계약·discovery·MRTR·tasks 확장·연결 중단·혼합 버전 검증을 설명합니다.
questionIds: [agent-mcp-roles, agent-mcp-primitives, agent-protocol-versioning, agent-mcp-async-tasks]
---

# MCP 역할·기본 요소·리비전별 실행 계약

## 표준 연결은 모델의 판단과 인가를 대신하지 않습니다

**host**는 사용자·모델·정책·문맥을 관리하는 앱, **client**는 host 안에서 server와 프로토콜을 주고받는 역할, **server**는 도구·자료·템플릿을 제공하는 역할입니다. 이슈 조회 server를 연결하면 client는 요청과 응답을 연결하고 host는 필요한 도구를 모델에 보여 줄 수 있습니다. 호출 제안 뒤에도 host 승인·예산과 server의 대상 인가가 남습니다.

한 host의 server A에서 읽은 자료를 server B에 자동 전달할 권한은 없습니다. 연결별 자격·출처·장애·deadline을 구분합니다. server 내부에 LLM이 있다고 외부 API가 자동으로 목표 위임 프로토콜이 되는 것도 아닙니다.

## 함수·자료·템플릿의 사용 목적을 나눕니다

| 요소 | 역할·예 | 주의점 |
| --- | --- | --- |
| tools | 인자 기반 검색·작업 실행 | read-only 주석은 구현 안전성 증명 아님 |
| resources | URI로 특정 규정 원문 읽기 | 읽었다고 자동 모델 문맥에 들어가지는 않음 |
| prompts | 사용자가 선택할 리뷰 요청 템플릿 | host 정책을 덮는 권한 아님 |

검색은 자료를 반환해도 질의·실행 비용이 있는 tool이 자연스러울 수 있습니다. template에 규정 전문을 복사하면 resource와 version이 갈라질 수 있어 갱신 책임을 정합니다. 목록의 제목·설명도 비공개일 수 있고 발견·원문 조회·변경 실행은 다른 인가입니다. 큰 자료에는 범위·page·잘림·원본 ID를 제공합니다.

## 최신이라는 말 대신 실제 리비전을 고정합니다

2026-09-15에 확인한 **2026-07-28** 변경 이력은 2025-11-25와 아래처럼 다릅니다. 이 노트는 해당 명세의 계약이며 모든 배포 SDK가 지원한다는 주장이 아닙니다.

| 경계 | 2026-07-28에서 확인한 변화 |
| --- | --- |
| 초기화 | initialize/initialized와 protocol-level session 제거 |
| 요청 문맥 | `_meta`에 protocolVersion·clientCapabilities 전달 |
| 발견 | server/discover로 지원 version·capability·identity 제공 |
| 알림 | subscriptions/listen의 선택 구독과 요청별 알림 구분 |
| 결과 | complete 또는 input_required 등 resultType 구분 |
| 끊긴 HTTP response stream | SSE 재개·재전달 제거, 새 request ID로 재요청 |
| 장기 task | 코어에서 별도 공식 tasks 확장으로 이동 |

구 리비전 server가 resultType을 생략한 결과는 명세의 호환 규칙에 따라 complete로 취급합니다. 이것을 모르는 새 resultType도 무조건 성공으로 처리해도 된다는 뜻으로 확대하지 않습니다. Roots·Sampling·Logging의 deprecated는 즉시 removed와 다르며 지원 종료 정책을 구분합니다.

## 연결 중단과 업무 중복은 서로 다른 계약입니다

새 protocol request ID로 다시 보내도 같은 외부 변경의 논리 idempotency key는 유지해야 합니다. transport가 요청을 잃었다는 사실은 server의 효과가 없었다는 뜻이 아닙니다. 목록·자료의 ttlMs/cacheScope는 freshness·shared cache 힌트이지 실행권이 아니며 사용자 권한·version을 함께 검사합니다.

```diagram
{"title":"Host 정책과 프로토콜·실제 실행의 책임","caption":"화살표는 호출과 관찰입니다. 연결·접수·내구 task 완료·업무 결과 검증을 한 상태로 합치지 않습니다.","rows":[[{"id":"host","label":"host · 사용자·모델·정책"}],[{"id":"client","label":"client · revision·ID·capability"}],[{"id":"server","label":"server · 인가·기능·상태"}],[{"id":"task","label":"선택 tasks 확장·내구 작업"}]],"edges":[{"from":"host","to":"client","label":"허용된 호출"},{"from":"client","to":"server","label":"고정 프로토콜 계약"},{"from":"server","to":"task","label":"양쪽 지원 시"}]}
```

## 추가 입력과 내구 Task를 구분합니다

코어 MRTR은 `resultType:input_required`와 inputRequests를 받고 inputResponses를 포함해 원래 요청을 다시 진행합니다. 실제 사용자 승인 필드는 host UI로 받아야 하며 모델이 동의를 만들어서는 안 됩니다.

확인한 tasks 안내는 `io.modelcontextprotocol/tasks`를 양쪽이 지원·선언했을 때 server가 `resultType:task`의 내구 핸들을 반환한다고 설명합니다. 매 호출마다 별도 생성 flag가 없어도 될 수 있지만 **client 지원 없이 반환해도 된다는 뜻은 아닙니다**. 접수는 응답 전 내구화하고 taskId·ttlMs·pollIntervalMs를 저장합니다.

`tasks/get`은 working·input_required·completed·failed·cancelled 상태와 종결 결과/error를 조회합니다. 추가 입력은 outstanding 요청 key에 맞춰 `tasks/update`로 보내고 중복·이미 충족된 입력을 새 행동으로 처리하지 않습니다. `tasks/cancel`은 협력적 요청이며 실제 종결을 보장하지 않습니다. 알림을 놓쳐도 조회로 상태를 확인하고 핸들만 아는 타인이 결과를 읽거나 취소하지 못하게 인가합니다.

## 혼합 버전과 실패 경로를 실제로 시험해야 합니다

명세·SDK·확장 version을 따로 고정하고 구/신 client×server, unsupported capability, 접수 응답 유실, 입력 대기 재시작, 결과 만료, 권한 철회를 시험합니다. 지원하지 않는 기능은 명시적으로 거절하거나 별도 job API·제한된 동기 경로로 전환합니다.

공식 문서 확인은 했지만 이 작업에서 MCP 호환 server를 구현·실행한 것은 아닙니다. 근거는 [2026-07-28 변경 이력](https://modelcontextprotocol.io/specification/2026-07-28/changelog)과 [Tasks 공식 안내](https://modelcontextprotocol.io/extensions/tasks/overview)이며 확인일은 2026-09-15입니다. 상세 구현은 해당 revision과 ext-tasks의 고정 version을 다시 대조해야 합니다.
