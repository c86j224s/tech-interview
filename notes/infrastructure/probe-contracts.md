---
id: probe-contracts
title: Kubernetes Probe의 상태와 복구 행동
topic: 인프라
summary: startup·readiness·liveness의 실패 효과와 시간 예산을 구분하고 의존 DB 검사 증폭·HTTP·gRPC 지원·종료 연결을 설명합니다.
questionIds: [k8s-probe-contract, probe-dependency-load-amplification, grpc-http-probe-auth-timeout]
---

# Kubernetes Probe의 상태와 복구 행동

## 초기화 지연과 재시작 대상 고장

앱이 모델·캐시를 준비하는 데 정상적으로 90초가 걸리는데 liveness가 30초 안에 성공을 요구하면 정상 초기화를 계속 끊을 수 있습니다. probe 실패는 관측값만이 아니라 Kubernetes의 복구 행동과 연결되므로 무엇을 검사하고 어떤 조치를 기대하는지 나눠야 합니다.

| Probe | 묻는 것 | 임계 실패의 일반적 효과 |
| --- | --- | --- |
| startup | 시작 초기화를 마쳤는가 | 컨테이너 종료·restartPolicy에 따른 재시작 |
| readiness | 지금 서비스 트래픽을 받을 준비가 됐는가 | Ready 상태 변경·endpoint 선택에 반영 |
| liveness | 재시작으로 회복할 수 있는 정지인가 | 컨테이너 종료·재시작 정책 |

startup이 설정되어 성공하기 전에는 liveness·readiness의 실행이 억제됩니다. readiness 실패 자체는 컨테이너 재시작 명령이 아닙니다. Pod Ready에는 다른 컨테이너·readiness gate도 관여할 수 있어 단일 probe 성공만으로 전체 준비를 판단하지 않습니다.

## Probe 실패와 복구 조치의 적합성

DB 장애를 liveness 실패로 연결하면 모든 Pod가 재시작해 연결 재생성·캐시 예열 부하를 더할 수 있습니다. DB가 느린 상태를 앱 재시작으로 고칠 수 있는지 먼저 봅니다. liveness는 로컬 진행 정지처럼 재시작이 합리적인 경우에 좁히고, readiness는 필수 요청을 수용할 상태를 나타내도록 합니다.

선택적 추천 서비스 장애 때문에 로그인 API 전체를 Ready=false로 만들면 정상 가능한 기능까지 내려갈 수 있습니다. 필수·선택 의존성을 나누고 기능별 degraded 응답을 설계합니다. 반대로 포트만 열렸다고 DB schema·설정·필수 연결이 준비되기 전에 Ready=true를 내면 정상 요청이 실패합니다.

```diagram
{"title":"같은 실패가 아니라 다른 상태에 다른 조치를 연결합니다","caption":"화살표는 준비 단계와 판정 관계입니다. startup 성공 뒤 readiness와 liveness는 서로 다른 질문을 계속 검사합니다.","rows":[[{"id":"start","label":"초기화 진행"}],[{"id":"startup","label":"startup 성공"}],[{"id":"ready","label":"readiness · 새 요청 수용"},{"id":"live","label":"liveness · 진행 가능"}]],"edges":[{"from":"start","to":"startup","label":"초기화 기한 안 완료"},{"from":"startup","to":"ready","label":"서비스 준비 검사"},{"from":"startup","to":"live","label":"재시작 필요 검사"}]}
```

## Probe와 하위 서비스 부하

100개 Pod가 5초마다 DB 쿼리 한 번씩 수행하면 정상 조건에서도 평균 20회/초의 검사입니다. 요청 실패와 무관하게 계속 발생하며 timeout·동시 시작이 겹치면 순간 부하는 더 클 수 있습니다. 이것은 산술 예제이지 권장 주기나 실제 측정값이 아닙니다.

가벼운 전용 endpoint·로컬 진행 상태·짧게 캐시한 의존 상태를 고려하고 검사 자체의 연결·시간·쿼리 비용을 제한합니다. 캐시 상태에는 갱신 시각·최대 stale 기간이 필요합니다. health endpoint가 일반 사용자 요청 큐에 무한히 밀리는지, 반대로 특별히 빠른 health만 성공하고 실제 처리 흐름은 막히는지도 확인합니다.

## Probe 시간 설정과 초기화·탐지 지연

periodSeconds·failureThreshold의 곱은 대략적인 허용 창을 계산하는 출발점이지만 initialDelay·timeout·첫 검사 시점·실행 지연을 포함한 정확한 종결 시각은 실제 관찰이 필요합니다. 초기화 분포의 정상 꼬리를 허용하고 진짜 멈춤의 탐지 지연과 비교합니다. readiness 회복의 successThreshold·최소 준비 시간도 rollout과 연결됩니다.

순간적인 DB 오류가 모든 Pod의 readiness를 동시에 바꿔 트래픽이 사라지는지, 새 Pod 준비가 늦어 rollout이 멈추는지 확인합니다. readiness 전파는 기존 TCP 연결을 자동 이동·종료하지 않으므로 종료 drain과 별도입니다.

## HTTP·gRPC Probe와 일반 Client 기능 범위

HTTP probe는 지정한 포트·경로·헤더·scheme과 응답 상태로 검사합니다. built-in HTTPS probe의 인증서 검증 동작은 일반 사용자 HTTPS client와 다를 수 있어 인증서 신뢰 검증의 대체로 쓰지 않습니다. 표준 kubelet HTTP probe는 HTTPS에서 인증서 검증을 건너뛰는 계약을 가지므로 보안 점검은 별도입니다.

built-in gRPC probe는 gRPC health checking protocol을 사용하고 숫자 port·선택적 service 이름 등 지원 필드를 확인합니다. 일반 gRPC client의 TLS·인증·named port 기능을 그대로 제공한다고 가정하지 않습니다. built-in probe와 외부 exec 기반 grpc-health-probe의 timeout·옵션 지원도 다를 수 있습니다. 실제 Kubernetes 버전의 문서와 endpoint를 맞춥니다.

전용 health endpoint는 민감한 진단 데이터를 내보내지 않고 필요한 네트워크 접근만 허용합니다. 인증 실패·포트 오류·앱 비정상을 모두 같은 “다운”으로만 로그에 남기지 않습니다.

## Probe 실패별 기대 행동 검증

테스트 클러스터에서 먼저 90초가 걸리는 정상 초기화를 넣고 startup 동안 불필요한 restart가 없는지와 Ready 이전에 트래픽이 들어오는지를 기록합니다. 이어서 영구 초기화 실패·필수 DB 지연·선택 의존 장애·로컬 진행 정지를 각각 재현해 readiness 변화와 restart가 실제 회복에 기여하는지를 비교합니다. 이렇게 시나리오를 나누면 어떤 실패가 트래픽만 제외하고 어떤 실패가 컨테이너를 다시 시작하는지 구분할 수 있습니다.

HTTP·gRPC의 잘못된 port·service·timeout·인증 요구도 따로 검사합니다. 현재 작업은 클러스터·probe 실행을 수행하지 않았으므로 위 내용은 계약 설명과 통합 검증 목록입니다.
