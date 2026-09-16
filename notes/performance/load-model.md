---
id: load-model
title: 운영을 닮은 부하·Coordinated Omission·Soak
topic: 성능
summary: open/closed 도착·예정 시각·생성기 포화·데이터 편중·cache·안전 replay·장기 보유와 누수의 실제 근거를 설명합니다.
questionIds: [load-test-realism, observability-coordinated-omission, production-replay-data-redaction, soak-leak-versus-warmup]
---

# 운영을 닮은 부하·Coordinated Omission·Soak

## 같은 인기 Key만 반복하면 원본 DB 비용이 사라질 수 있습니다

테스트가 한 상품만 조회하면 cache hit가 높아 좋은 TPS가 나올 수 있습니다. 운영은 긴 꼬리 key·큰 payload·쓰기·다양한 tenant·만료·재시작이 섞입니다. 요청 수만 맞추면 CPU·memory·DB·network 비용은 다를 수 있습니다.

예를 들어 읽기/쓰기 비율과 키 인기만 운영과 다르면 cache hit와 DB 작업량이 달라지므로, 데이터 크기·인덱스/통계·payload 분포·연결 수까지 같은 부하 모델에 넣습니다. TLS·keep-alive·압축·think time(사용자 행동 사이의 대기)도 요청이 실제로 기다리는 시간을 바꾸므로 값과 적용 위치를 기록합니다. CPU 세대·disk·네트워크·관측 agent·외부 stub이 운영과 어떻게 다른지, 실험에서 제외한 범위도 함께 남겨야 결과를 어디까지 옮겨 쓸 수 있는지 판단할 수 있습니다.

## Open과 Closed 모델은 다른 사용자를 표현합니다

| 모델 | 다음 요청 시작 | 적합한 질문 | 함정 |
| --- | --- | --- | --- |
| closed-loop | 앞 응답 뒤·think time 뒤 | 고정 사용자 반복 행동 | 서버 지연 때 발송률도 줄어듦 |
| open-loop | 정한 도착 스케줄 | 외부 수요가 유지되는 용량 | 생성기가 목표율을 못 낼 수 있음 |

서버가 10초 멈췄을 때 한 closed 사용자도 10초 기다리면 새 요청을 만들지 않습니다. 실제 도착률 100/s가 계속되는 상황을 평가하려 했다면 그동안 도착할 1000개 요청의 대기를 측정하지 못합니다. 이런 도착·측정 누락이 coordinated omission입니다. closed 모델이 항상 틀린 것이 아니라 평가할 수요 모델과 맞아야 합니다.

```diagram
{"title":"예정 도착과 실제 발송과 완료를 구분합니다","caption":"화살표는 한 요청의 시간 경계입니다. 생성기 지연을 서버 처리 시간에 숨기지 않고, 목표에 따라 예정 도착부터의 전체 지연도 기록합니다.","rows":[[{"id":"scheduled","label":"예정 도착 시각"}],[{"id":"sent","label":"실제 발송 시각"}],[{"id":"received","label":"서버 수신·대기·실행"}],[{"id":"completed","label":"응답 또는 timeout"}]],"edges":[{"from":"scheduled","to":"sent","label":"생성기 발송 지연"},{"from":"sent","to":"received","label":"전송"},{"from":"received","to":"completed","label":"관측한 응답 지연"}]}
```

open-loop에서도 generator CPU·network·connection이 포화되면 실제 발송이 밀립니다. 예정·실제 발송·server 수신률을 함께 기록하고 달성 못 한 목표율을 대상 서비스 용량으로 보고하지 않습니다. histogram 보정은 특정 도착 가정의 추정일 뿐 운영 트래픽을 실제로 재현한 것과 같지 않습니다.

## 정상·Cold·Burst·회복을 별도 시나리오로 둡니다

정상 부하가 유지되는 steady state, 단계적으로 올리는 부하, 짧은 burst, 배포 직후의 비어 있는 cold cache, cache outage, 느린 dependency, 부하를 끈 뒤 회복하는 구간을 별도 시나리오로 나눕니다. 외부 API를 즉시 성공하는 stub으로 바꾸면 timeout·retry·pool 대기처럼 운영에서 요청을 붙잡는 시간이 사라지므로, 성공 여부만 맞춘 stub으로는 같은 부하가 되지 않습니다.

안전한 stub에도 필요한 지연 tail·응답 크기·오류·rate limit을 넣어 실제 대기와 실패 경로를 남깁니다.

실험 seed·버전·데이터 생성·cache warmup·generator 수·서버 자원·한도를 저장해 같은 대조를 반복합니다. 한 개선에서 cache 비율이나 요청 혼합도 바뀌면 원인이 코드 최적화인지 분리하기 어렵습니다. 유형별 단독 시험과 운영 혼합 시험을 함께 둡니다.

## 운영 Replay는 개인정보와 외부 효과를 제거해야 합니다

원문 token·사용자 정보·결제·메일 목적지·삭제 명령을 그대로 재생하지 않습니다. 합성 ID와 test endpoint·격리 계정으로 치환하고 egress·자격·권한을 제한해 실서비스에 도달할 수 없게 합니다. 원본 로그 접근·보관·가공 provenance도 관리합니다.

치환이 데이터 관계·key 편중·payload 길이·cache 적중·문자 분포를 지나치게 바꾸면 성능 모형이 왜곡될 수 있습니다. 필요한 통계적 특성은 보존하되 재식별 가능한 원문을 남기지 않는 방법을 선택합니다. 마스킹만 했다고 모든 외부 쓰기가 안전해지는 것은 아니므로 실행 권한도 별도로 차단합니다.

## Soak의 메모리 증가를 모양만 보고 누수라고 하지 않습니다

예열이 끝나 cache가 정한 한도에 수렴하거나 큰 buffer가 pool에 남으면 RSS(프로세스가 실제로 점유한 resident memory)가 유지될 수 있습니다. 반대로 callback·FD·thread·goroutine·미완료 요청이 계속 쌓여 실제 누수가 생길 수도 있으므로, 같은 부하를 오래 유지한 뒤 자원별 증가를 따로 봅니다. 큰 요청 한 번 이후 작은 요청만 보내는 구간, 부하 종료 뒤의 회수, 재시작 뒤의 초기 상태를 나눠 보면 pool 보유와 계속 살아 있는 참조를 구분하기 쉽습니다.

GC 뒤에도 살아 있는 heap live와 그 객체를 계속 도달 가능하게 만드는 retained 참조, pool 보유량·FD·queue·thread·RSS를 시간축으로 함께 기록합니다. GC 후 RSS가 줄지 않았다는 사실만으로 누수라고 하지 않고, 반대로 RSS가 안정됐다는 이유만으로 모든 자원 누수가 없다고 확정하지 않습니다. 증가한 객체나 핸들을 어떤 owner가 계속 참조하는지 자원별 변화에서 실제 경로를 찾아야 합니다.

## 최대 순간 TPS 대신 지속 가능한 성공을 보고합니다

수락률·실제 성공 완료율·거절·timeout·p95/p99·가장 오래된 요청·queue bytes·회복 시간을 같은 창으로 보고합니다. 실패 표본을 지연에서 뺐는지·생성기가 밀렸는지·외부 부하를 제외했는지 명시합니다. 이 노트는 부하 설계이며 현재 작업에서 운영 트래픽 replay나 대규모 부하 시험을 실행한 것은 아닙니다.
