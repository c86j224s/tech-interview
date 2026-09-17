---
id: memory-headroom
title: 컨테이너 OOM·GC 여유·객체 풀의 실제 수명
topic: 성능
summary: CPU throttling·cgroup OOM·node eviction을 구분하고 Go soft limit·native 여유·pool 보유·reset·취소 후 조기 반환을 설명합니다.
questionIds: [k8s-oom-throttling, gomemlimit-container-headroom, performance-memory-pool-retention]
---

# 컨테이너 OOM·GC 여유·객체 풀의 실제 수명

## 프로세스 생존·지연과 종료·eviction의 구분

컨테이너에 배정된 CPU quota가 소진되면 실행이 throttling(실행할 CPU 시간이 제한되어 기다리는 상태)되어 프로세스가 살아 있어도 요청·GC·heartbeat가 늦어질 수 있습니다. 메모리 cgroup 한도(컨테이너 메모리를 집계·제한하는 경계)나 노드 OOM이면 프로세스가 죽을 수 있고, kubelet의 node pressure eviction은 노드 여유를 보고 Pod를 내보내는 별도 정책 경로입니다.

container 종료 사유·event·node condition·cgroup 지표를 같은 시각에 대조해야 quota 지연, cgroup 초과, 노드 eviction을 구분할 수 있습니다.

평균 메모리가 limit보다 낮아도 순간 큰 요청·동시 buffer·native allocation이 한도를 넘을 수 있습니다. 사후 한 번의 working set만 보지 말고 peak와 종료 직전의 상태를 수집합니다.

| 증상 | 관측 | 먼저 구분할 것 |
| --- | --- | --- |
| OOMKilled | memory event·limit·peak | cgroup 한도·node OOM·앱 메모리 |
| Evicted | node pressure·Pod event | kubelet 정책·ephemeral storage 등 |
| 살아 있지만 p99 증가 | throttled time·run queue·GC | quota·실제 CPU 경쟁·하위 대기 |
| heap 줄고 RSS 유지 | allocator·mapped·native·pool | 회수와 OS 반환의 차이 |

request·limit을 따로 조정하고 명시된 request가 limit 변경으로 자동 같은 값이 된다고 가정하지 않습니다. 이미 실행 중 Pod가 limit 수정만으로 다른 노드로 즉시 재배치되는 것도 아닙니다.

## GOMEMLIMIT와 컨테이너 상한 사이의 메모리 여유

GOMEMLIMIT는 Go 런타임이 관리하는 메모리의 소프트 한도입니다. heap만이 아니라 런타임의 stack·metadata 등도 관리 범위에 포함되므로 모든 stack을 무조건 바깥 메모리로 다시 더하지 않습니다. 반면 cgo/native·직접 mmap·다른 프로세스·cgroup에 charge되는 파일 cache 등은 측정 기준이 다를 수 있습니다.

container 한도와 같은 값으로 두면 관리 밖 메모리와 순간 peak를 위한 여유가 없을 수 있습니다. runtime memory classes·heap live·cgroup current/peak·RSS를 실제 정의에 맞게 대조합니다. 예를 들어 한도 1GiB에서 관측된 비Go·기타 부담과 peak 여유가 250MiB라면 그만큼을 고려한 더 낮은 runtime 목표를 시험할 수 있지만 고정 권장 비율은 아닙니다.

한도를 너무 낮춰 필수 live data에 붙이면 GC가 반복해도 줄일 수 없어 CPU·p99가 나빠질 수 있습니다. cache·동시 요청·buffer·할당률을 먼저 줄이고 실제 오류·GC CPU·성공 처리율을 비교합니다.

```diagram
{"title":"프로세스 예산과 런타임 목표는 같은 숫자가 아닙니다","caption":"화살표는 예산 분해입니다. 실제 중복 계수 없이 메트릭 정의를 확인하고 런타임 밖 메모리와 순간 변동을 위한 여유를 둡니다.","rows":[[{"id":"limit","label":"컨테이너 전체 메모리 예산"}],[{"id":"runtime","label":"Go runtime 관리 메모리"},{"id":"other","label":"native·매핑·기타·피크 여유"}]],"edges":[{"from":"limit","to":"runtime","label":"soft 목표 설정"},{"from":"limit","to":"other","label":"별도 관측·여유"}]}
```

## 객체 풀의 할당 감소와 메모리 보유 증가

큰 요청 한 번이 32MiB buffer를 풀에 남기면 이후 작은 요청만 와도 그 큰 메모리가 유지될 수 있으므로, 풀을 쓴다는 이유만으로 RSS가 줄어든다고 보지 않습니다. 크기 구간(size class)별로 보관할 최대 bytes를 정하고, 큰 항목은 풀에 넣지 않거나 유휴 시간 뒤 회수하는 정책을 실제 peak와 함께 비교합니다. 할당 횟수 감소뿐 아니라 pool lock·cross-thread 반환·reset CPU·GC scan 비용이 추가되는지도 측정해야 보유 메모리와 처리 비용의 교환을 판단할 수 있습니다.

반환 시 논리 길이·상태·참조·사용자 데이터·보안 필드를 초기화합니다. 바이트 전체를 지워야 하는지, 다음 write와 정확한 출력 길이만으로 노출을 막을 수 있는지는 비밀 처리와 API 계약에 따라 결정합니다. 이전 사용자의 미사용 buffer 영역을 응답에 노출하지 않습니다. 참조를 남기면 다른 큰 객체도 함께 보유될 수 있습니다.

## Timeout 응답과 Buffer 반환 허가의 분리

I/O callback이 아직 buffer를 읽는데 사용자 timeout으로 풀에 반환하면 새 요청이 같은 메모리를 덮을 수 있습니다. pool 내부 mutex가 안전해도 대여 수명이 틀린 문제입니다. 실제 I/O 종결·모든 참조 종료 뒤 한 번만 반환하고 double return·use-after-return·취소와 완료의 단일 소유를 관리합니다.

큰 buffer를 제거해도 allocator가 메모리를 보유하면 RSS가 즉시 떨어지지 않을 수 있습니다. 이를 pool 오류로 단정하거나 RSS가 낮다는 이유로 메모리 오염이 없다고 판단하지 않습니다.

## CPU throttling과 메모리 압박의 분리 실험

CPU throttling이 GC·요청 처리를 늦춰 살아 있는 buffer 수를 늘리면 메모리 peak가 2차로 증가할 수 있습니다. OOM 재시작은 cache cold·retry·readiness 변화를 만듭니다. 먼저 메모리 peak와 CPU 부하를 분리한 뒤 조합 상황을 시험합니다.

pool 없음/있음, 작은/큰 객체, burst 후 회복, 취소·중복 반환·동시 대여를 비교합니다. 현재 작업에서는 container OOM·throttling·pool 부하 실험을 실행하지 않았습니다. 본문은 예산과 수명 진단 설계입니다.
