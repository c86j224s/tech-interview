# AI 에이전트 50문항의 범위와 자료

확인 기준일: **2026-09-11**. 기존 CS 300문항에 AI 에이전트 50문항을 추가했습니다. 각 문항은 원리·상황 예제·실패 조건·대안·점검 포인트와 꼬리 질문 3개를 갖습니다. 5분은 설명 목표이며 낭독 실측값은 아닙니다.

## 주제 범위

- 기본 구조: 고정 워크플로와 자율성, 관찰·행동 루프, 도구 계약, 구조화 출력, 계획·재계획, 종료 예산
- 문맥과 검색: 컨텍스트 엔지니어링·압축, 메모리 출처, 에이전트형 RAG, 인용 근거, 검색 인가
- 연동 규약: MCP 역할·기본 기능·인가·버전 전환·장기 작업, A2A의 목적·작업 수명·신뢰
- 실행 구성: Agent Skills와 점진적 로딩, 도구 검색, 프로그램형 도구 조합, 멀티 에이전트 분해·위임·상관 오류, 평가·수정 루프
- 장기 실행: 내구 실행·멱등성·사람 승인, 코딩·브라우저 에이전트, 동시 편집, harness, 백그라운드 취소
- 보안: 프롬프트 인젝션, 최소 권한, sandbox, 메모리 오염, 외부 전송, 도구·지침 공급망
- 평가와 운영: 실제 outcome, 코드·모델·사람 채점, pass@k와 반복 신뢰도, 평가 오염, 관측성, 비용·라우팅·프롬프트 캐시·추론 예산

기존 문항의 멱등성·취소·인가와 연결하되, 새 문항은 모델이 호출 인자를 재생성하거나 외부 자료를 지시로 오인하는 등 **에이전트 특유의 판단·실행 경계**를 다룹니다. 같은 주제의 일반 CS 질문을 단순 복제하지 않았습니다.

## 확인한 공식 자료

| 자료 | 게시일 또는 확인한 버전 | 반영한 내용 |
| --- | --- | --- |
| [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents) | 2024-12-19 | workflow와 agent 구분, 최소 구조, routing·orchestrator-workers·evaluator-optimizer |
| [Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) | 2025-09-29 | 필요한 정보의 선택, 참조 기반 조회, 압축·노트·좁은 하위 작업 |
| [Advanced tool use](https://www.anthropic.com/engineering/advanced-tool-use) | 2025-11-24 | 도구 검색·지연 로딩, 프로그램형 호출, 도구 예시와 비용 절충 |
| [Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents) | 2025-11-26 | 초기화와 후속 세션, 진행 기록, 요구 목록, 실제 앱 검증 |
| [Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) | 2026-01-09 | task·trial·trace·outcome, 채점기, pass@k·pass^k, 격리·회귀 평가 |
| [MCP specification](https://modelcontextprotocol.io/specification/2026-07-28) · [변경 이력](https://modelcontextprotocol.io/specification/2026-07-28/changelog) | 2026-07-28 리비전 | 요청별 버전·capability, stateless 구조, discover·구독·추가 입력, tasks 확장, 폐기·제거 구분 |
| [MCP authorization](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization) | 2026-07-28 리비전 | resource·audience·issuer·scope, token passthrough 금지, 추가 인가, HTTP와 STDIO 구분 |
| [A2A specification](https://a2a-protocol.org/latest/specification/) | 확인일에 최신 발행 1.0.0으로 안내 | Agent Card, message·task·artifact, 종료·입력 대기, 스트림·인가·결과 신뢰의 경계 |
| [Agent Skills specification](https://agentskills.io/specification) | 2026-09-11 확인 | SKILL.md와 선택 디렉터리, metadata→본문→자료의 점진적 로딩, 구현별 지원 차이 |
| [OWASP LLM01 Prompt Injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/) | 2026-09-11 확인 | 직접·간접 인젝션, 멀티모달 입력, 최소 권한·승인·입출력 검사와 한계 |

## 최신 동향을 해석한 기준

여기서 최신 동향은 확인한 공개 명세와 설계·평가 방법을 뜻합니다. 시장 점유율이나 모든 조직의 채택을 조사한 결과가 아니며, 특정 공급자·모델이 항상 우월하다는 주장도 아닙니다. 과거에 게시된 기본 원칙과 이후 추가된 선택 기능을 함께 다루되 날짜를 구분합니다.

MCP의 `latest` 페이지는 확인일에 2026-07-28을 가리켰습니다. 기존 2025-11-25의 초기화·세션·tasks 계약을 새 리비전에 그대로 일반화하지 않았습니다. 명세 문서의 존재와 실제 SDK·서버의 지원은 별개이며, 선택 확장과 deprecated 기능을 필수 또는 즉시 제거된 기능으로 표현하지 않습니다.

A2A 명세에는 응답 대기 동작의 설명이 문맥에 따라 다르게 읽히는 부분이 있어, 이 자료에서는 기본 blocking 여부를 보편 규칙으로 단정하지 않았습니다. 실제 구현의 호출 방식·버전·지원 capability를 확인하도록 설명합니다. Agent Card의 skill과 파일 패키지 형식인 Agent Skills도 구분합니다.

설명과 예제·점검 항목은 사이트 문체에 맞게 새로 작성했습니다. 링크는 개념과 명세 확인 근거이며 모든 외부 서비스에 연결해 실행 시험을 했다는 뜻은 아닙니다. 보안 예제는 방어 설계와 허가된 격리 시험을 위한 설명입니다. 문서가 바뀌면 고정 리비전·공식 변경 이력·실제 SDK를 대조한 뒤 관련 문항과 회귀 테스트를 함께 갱신합니다.
