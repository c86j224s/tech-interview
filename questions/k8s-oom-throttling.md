---
id: k8s-oom-throttling
title: "Kubernetes의 일부 컨테이너는 OOMKilled로 재시작하고 다른 컨테이너는 살아 있지만 느립니다. 메모리 종료와 CPU 제한을 어떻게 구분하나요?"
answerMinutes: 5
followups: [{"id":"k8s-requests-limits","prompt":"requests·limits를 조정할 때 스케줄링 가능성과 실행 중 자원 상한을 어떤 순서로 검토할까요?"},{"id":"go-gc-latency-tradeoff","prompt":"Go heap과 cgroup memory limit 사이 여유가 부족할 때 GC와 OOM을 어떤 지표로 구분할까요?"},{"id":"k8s-probe-contract","prompt":"CPU throttling이나 GC pause로 probe가 실패할 때 liveness와 readiness를 어떻게 잘못 설계하지 않을까요?"}]
difficulty: 중하
category: 성능
tags: ["Kubernetes","OOM","CPU throttling"]
related: ["k8s-requests-limits","go-gc-latency-tradeoff"]
---

# Kubernetes의 일부 컨테이너는 OOMKilled로 재시작하고 다른 컨테이너는 살아 있지만 느립니다. 메모리 종료와 CPU 제한을 어떻게 구분하나요?

## 구두 답변

OOMKilled와 CPU throttling은 모두 요청 지연을 만들 수 있지만 실패 방식과 대응이 다릅니다. OOMKilled는 컨테이너 cgroup 메모리 한도나 노드 메모리 압력 상황에서 프로세스가 종료된 사건이고, CPU throttling은 CPU quota 때문에 실행 시간이 제한되어 프로세스는 살아 있지만 느려지는 현상입니다. 먼저 container status·종료 사유·이벤트와 메모리 peak, CPU throttled time·quota 지표를 확인한 뒤 메모리와 CPU를 분리해 대응하겠습니다. 이 구분이 자원 압박 원인 진단의 출발점입니다.

### 메모리 종료를 추적합니다
평균 메모리가 limit보다 낮아도 큰 요청, 동시 요청 증가, GC, native buffer, 파일 캐시와 순간 peak가 한도를 넘을 수 있습니다. OOMKilled 뒤 재시작이 반복되면 마지막 종료 시각의 cgroup 사용량, 컨테이너 limit, 노드 압력과 애플리케이션 heap·native·stack을 같은 시간축으로 봅니다. 노드 eviction은 kubelet이 노드 전체 압력을 해소하려고 Pod를 퇴거시키는 경로이고, cgroup OOM은 해당 그룹의 한도·압력으로 프로세스가 죽는 경로라 이벤트와 종료 사유가 다를 수 있습니다.

CPU limit 근처에서 throttled 시간이 늘면 프로세스는 종료되지 않은 채 요청 처리·GC·heartbeat가 늦어질 수 있습니다. request는 스케줄링과 상대적 CPU 가중치에, limit은 상한과 quota에 영향을 주므로 실제 사용량만 보지 않고 노드 경쟁과 limit 설정을 함께 확인합니다. CPU를 더 주면 애플리케이션 계산이 빨라질 수 있지만 하위 DB·외부 API가 병목이면 효과가 없고, 메모리 limit를 무작정 없애면 노드 전체 장애 범위가 커질 수 있습니다.

### 개선은 피크와 꼬리 지연으로 검증합니다
메모리 문제는 생존 객체·동시 요청·응답 버퍼·native allocation을 줄이고, CPU 문제는 hot path·작업자 수·limit·요청 분배를 조정합니다. 메모리 피크만 있는 실험과 지속 CPU 부하 실험을 분리하고, 변경 뒤 재시작·OOM·throttled time뿐 아니라 p95/p99, GC, 노드 여유, 다른 Pod의 안정성을 확인합니다. CPU throttling으로 timeout이 늘면 재시도가 부하를 증폭할 수 있으므로 retry 정책과 deadline도 함께 점검하겠습니다.

requests와 limits의 변경 효과를 섞어 말하지 않겠습니다. 명시된 request가 있다면 limit만 수정했다고 request가 자동으로 같은 값으로 바뀌는 것은 아니며, 노드 배치와 bin packing은 주로 request를 기준으로 결정됩니다. limit을 높여도 기존 Pod가 즉시 다른 노드로 재배치되는 것은 아니고, 여러 Pod가 동시에 peak를 내면 노드 압력과 eviction 여유가 줄 수 있습니다. CPU도 request와 limit을 따로 확인하겠습니다.

메모리 peak 실험과 지속 CPU 부하 실험을 분리하고, container status·OOMKilled·노드 eviction 이벤트·cgroup memory peak·CPU throttled time을 기록합니다. throttling으로 GC와 요청 처리가 늦어져 동시에 살아 있는 버퍼가 늘면 메모리 peak가 2차로 커질 수 있고, OOM 재시작은 readiness 실패와 재시도를 만들 수 있습니다. 변경 뒤 단일 컨테이너뿐 아니라 sibling Pod, 노드 여유, p95·p99와 재시도량까지 검증하겠습니다.

limit을 바꿔도 request가 자동으로 같은 값으로 바뀌지 않으며, bin packing은 request를 기준으로 판단합니다. 이미 실행 중인 Pod의 배치가 즉시 바뀌는 것도 아닙니다. 새 값을 적용할 때 rollout 여부, 노드 여유, 실제 peak와 throttling을 따로 확인해 자원 설정 효과를 과장하지 않겠습니다.

## 득점 포인트

- OOM 종료와 CPU throttling의 상태·원인·지표를 분리한다.
- 평균이 아닌 메모리 peak와 throttled time을 본다.
- 컨테이너 조정의 노드 전체·재시도·꼬리 지연 영향을 검증한다.

## 감점 포인트

- 모든 재시작을 애플리케이션 코드 크래시로 해석한다.
- CPU limit 초과가 프로세스를 항상 죽인다고 말한다.
- limit 제거를 모든 환경의 해결책으로 제시한다.

## 더 파고들 거리

- 노드 eviction과 cgroup OOM의 이벤트·복구 경로는 어떻게 다른가요?
- GOMEMLIMIT와 컨테이너 limit 사이의 여유를 어떤 부하로 정할까요?
- CPU throttling으로 deadline 초과가 생길 때 재시도 폭주를 어떻게 막을까요?
