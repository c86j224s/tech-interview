---
id: "observability-trace-sampling"
title: "트레이스 저장 비용을 줄이려 합니다. head sampling과 tail sampling은 어떤 오류를 놓칠 수 있나요?"
answerMinutes: 5
followups: [{"id": "distributed-tracing-boundaries", "prompt": "서비스·DB·큐의 실행과 대기를 어떤 span 경계로 연결하나요?"}, {"id": "logging-performance-safety", "prompt": "진단에 필요한 원인과 빈도를 보존하면서 로그 포화·민감값 노출을 어떻게 줄이나요?"}, {"id": "agent-observability", "prompt": "모델·도구·승인·실제 결과를 어떤 최소 trace로 연결하나요?"}]
difficulty: "중하"
category: "성능"
tags: ["관측성", "성능"]
related: ["distributed-tracing-boundaries", "logging-performance-safety", "agent-observability"]
---

# 트레이스 저장 비용을 줄이려 합니다. head sampling과 tail sampling은 어떤 오류를 놓칠 수 있나요?

## 구두 답변

head sampling은 요청 시작 시 보존 여부를 결정하고 tail sampling은 결과를 본 뒤 선택할 수 있습니다. 전자는 단순·저비용이고 후자는 느린·실패 요청을 골라 남기기 좋지만 버퍼·집계·지연 비용이 필요합니다.

### 동작 원리와 전제

head sampling은 드문 오류를 우연히 놓칠 수 있고 tail sampling은 늦게 도착한 span이나 큰 trace를 불완전하게 모을 수 있습니다. 서비스 간 sampling 결정 전파와 부모·자식 연결을 유지해야 합니다.

### 선택과 실패 처리

전체 성공률·오류율은 샘플링된 trace만으로 추정하지 않고 별도 메트릭을 사용합니다. 민감 데이터는 보존 여부 결정 전에 이미 수집될 수 있으므로 수집 단계에서 최소화합니다. 중요한 감사 이벤트는 trace 샘플링과 다른 내구 경로가 필요할 수 있습니다.

### 구체적인 사례와 검증

trace의 마지막 오류 span이 늦게 도착하면 tail sampler가 이미 정상으로 판단해 버렸을 수 있습니다. 대기 창을 늘리면 진단 가능성은 좋아질 수 있지만 collector 메모리·저장 지연이 늘어납니다. 대형 trace와 장기 작업은 별도 정책이 필요할 수 있습니다. 샘플링된 trace만으로 에러율을 계산하면 오류 우선 보존 정책 때문에 실제 비율과 다릅니다. 집계 메트릭은 전체 대상 이벤트를 세고 trace는 원인 진단에 사용합니다. span payload의 개인정보는 샘플링되기 전에 이미 수집될 수 있으므로 agent·서비스의 instrumentation 단계에서 필요한 필드만 기록하겠습니다.

분산 지연·late span·collector 장애·버퍼 포화를 시험합니다. 보존율·진단 가능성·유실·비용을 비교합니다. 더 많은 trace가 항상 좋은 것이 아니라 필요한 실패를 설명할 수 있는 범위와 개인정보 정책을 함께 맞춥니다.

## 득점 포인트

- 핵심 구분: head sampling은 요청 시작 시 보존 여부를 결정하고 tail sampling은 결과를 본 뒤 선택할 수 있습니다.
- 선택 조건: 전체 성공률·오류율은 샘플링된 trace만으로 추정하지 않고 별도 메트릭을 사용합니다.
- 검증 기준: 분산 지연·late span·collector 장애·버퍼 포화를 시험합니다.

## 감점 포인트

- 오류 우선 샘플링한 trace 비율을 전체 요청 오류율로 그대로 사용한다.

## 더 파고들 거리

- 서비스·DB·큐의 실행과 대기를 어떤 span 경계로 연결하나요?
- 진단에 필요한 원인과 빈도를 보존하면서 로그 포화·민감값 노출을 어떻게 줄이나요?
- 모델·도구·승인·실제 결과를 어떤 최소 trace로 연결하나요?
