---
id: agent-routing-cost
title: 모델 라우팅·캐시·성공당 전체 비용
topic: AI 에이전트
summary: 과제별 모델 기능·검증 신호·fallback 권한을 정하고 prompt/response cache·critical path·모든 실패와 하위 사용량·관측 정보 최소화를 설명합니다.
questionIds: [agent-model-routing, agent-cost-latency, agent-prompt-caching, agent-observability]
---

# 모델 라우팅·캐시·성공당 전체 비용

## 호출 단가와 성공당 전체 비용의 역전

작은 모델이 같은 `schema` 오류를 열 번 보정하면 강한 모델이 한 번 생성한 경우보다 비싸질 수 있습니다. 한 논리 작업의 비용을 계산할 때는 입력·출력·추론 사용량, `cache write/read`, 검색, `sandbox`, 하위 에이전트, 실패 재시도, 사람 검토 비용을 모두 더한 뒤 검증된 성공 건수로 나눕니다. 안전 위반을 성공 건수에 넣지 않고, 아직 해결되지 않은 과제에 쓴 비용도 성공 비용에서 빼지 않습니다.

지연은 첫 토큰과 최종 사용 가능한 결과, 승인 대기, 검증·배포 완료를 나눕니다. 독립 조회 3개를 병렬화하면 wall time은 줄 수 있지만 총 호출 요금은 그대로입니다. 순차 의존이 있으면 병렬화할 수 없고 가장 느린 branch와 통합이 critical path가 됩니다.

## 작업 기능·오류 비용별 경로 선택

형식 변환+결정적 검증과 복잡한 설계 판단은 다른 경로가 적합할 수 있습니다. 입력 길이·도구·이미지·언어·오류 영향·데이터 정책으로 초기 모델을 정하고 실제 과제 평가로 보정합니다. router 자체도 모델이면 분류 비용·오분류를 포함합니다. 공개 순위나 자기 confidence만으로 자동 상향·하향하지 않습니다.

| 관측 | 다음 판단 |
| --- | --- |
| schema·도구 인자 반복 실패 | 제한된 보정 또는 적합한 모델 |
| 최신 근거 부족 | 강한 추론보다 원문 조회 가능성 |
| provider rate limit | 허용된 다른 경로·남은 예산 |
| 정책 거절 | 다른 모델로 우회하지 않음 |
| 외부 효과 불확정 | 새 모델 호출 전 작업 원장 조회 |

fallback에는 실패한 관찰·미완료 조건을 넘기되 잠정 결론을 사실로 고정하지 않습니다. 사용자 승인·논리 키·이미 사용한 budget을 유지합니다. 제공자가 달라지면 데이터 전송 목적지가 달라지므로 별도 정책을 통과해야 합니다. 실제 활성화된 도구·schema·image·context 기능과 정확한 모델 식별자를 기록합니다.

## Prompt Cache와 Response Cache의 역할 구분

`prompt cache`는 안정적인 지침·도구 정의·공통 자료가 들어간 입력 처리를 재사용하는 것이고, `response cache`는 최종 답 자체를 재사용하는 것이므로 두 경로를 분리합니다. 고정된 `prefix` 앞에 매번 달라지는 시간이나 ID를 넣거나 도구 순서를 무작위로 바꾸면 적중이 떨어질 수 있습니다. 적중률을 높이려고 지시 우선순위, 외부 자료의 신뢰 표시, 사용자 예외를 바꾸면 안 됩니다.

최소 길이·TTL·작성 요금·hit 요금·격리·보존은 provider API 계약을 확인합니다. cache가 모델의 출력 결정성·정확성을 보장하지 않습니다. 낡은 정책을 계속 보내는 앱 문제도 자동 고치지 않습니다. 정의가 오래됐어도 실행기는 현재 인가와 지원 도구를 검사합니다.

같은 질문 문자열이라도 사용자·ACL·문서 version·업무 상태가 다르면 응답 cache를 공유할 수 없습니다. 옛 “예약 완료” 답을 현재 실행의 결과처럼 반환하지 않습니다. cold/warm·write/miss·p99·실제 청구를 나눠 측정합니다.

```diagram
{"title":"작업 전체 비용과 실제 완료를 연결합니다","caption":"화살표는 관측 연결입니다. 모델 응답 완료와 최종 업무 성공을 구분하고 fallback도 같은 논리 작업의 누적 비용으로 합칩니다.","rows":[[{"id":"task","label":"논리 작업·요구·budget"}],[{"id":"model","label":"모델·cache·fallback"},{"id":"tools","label":"도구·sandbox·자식 작업"}],[{"id":"verify","label":"승인·실행·결과 검증"}],[{"id":"cost","label":"성공·안전·총비용·최종 지연"}]],"edges":[{"from":"task","to":"model","label":"판단 경로"},{"from":"task","to":"tools","label":"실행 경로"},{"from":"model","to":"verify","label":"구조적 제안"},{"from":"tools","to":"verify","label":"관측 결과"},{"from":"verify","to":"cost","label":"실제 outcome"}]}
```

## 실행 사실 중심의 Trace 연결

task·physical attempt·tool call·원격 task·승인·결과 ID를 연결하고 model/prompt/schema/harness version을 남깁니다. 도구 discovery·모델 대기·sandbox start·승인 대기·실행·검증을 나누면 10분의 사용자 승인 대기를 모델 병목으로 오해하지 않습니다. 시각뿐 아니라 parent ID·단계 순서로 인과를 보존합니다.

토큰·전체 prompt·사내 문서를 무기한 로그로 복제하지 않습니다. 필드별 마스킹·보관·접근권한·최소 결정 요약을 사용하고 숨겨진 내부 추론 전문을 수집할 필요는 없습니다. metric label에는 bounded 과제/도구/오류 유형을 두고 task ID는 trace로 연결합니다. 중요한 감사와 일반 sampled 진단은 내구 정책이 다릅니다. trace 누락을 미실행으로 단정하지 않습니다.

## 동일 조건의 전체 경로 비교

모델 교체·cache 만료·provider 장애·도구 timeout·정책 거절·부분 trace·로그 sink 실패를 시험합니다. 과제별 오분류·불필요한 fallback·누적 비용·잘못된 완료를 확인합니다. 이 노트는 비용·관측 설계이며 실제 모델 라우팅의 경제성을 측정한 결과는 아닙니다.
