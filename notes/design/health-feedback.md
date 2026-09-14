---
id: health-feedback
title: Readiness와 적응형 동시성의 피드백 안정성
topic: 설계
summary: probe 성공과 실제 용량을 구분하고 공통 의존성·flapping·hysteresis·점진 복귀·관측 지연·한도 변경률·고정 fallback을 설명합니다.
questionIds: [load-balancer-health-draining, readiness-flapping-hysteresis, adaptive-concurrency-stability]
---

# Readiness와 적응형 동시성의 피드백 안정성

## Health 경로 하나가 성공해도 주문 경로는 실패할 수 있습니다

별도 연결로 응답하는 probe는 200인데 실제 주문 DB pool이 고갈됐을 수 있습니다. liveness는 재시작으로 회복할 생존 문제, readiness는 새 일을 수용할 준비의 신호로 구분합니다. 특정 시점의 제한된 검사가 다음 모든 요청 성공을 보장하지 않습니다.

모든 외부 dependency를 readiness에 묶으면 공통 DB 장애에서 모든 instance가 동시에 제외될 수 있습니다. 너무 얕으면 실제 기능 장애를 놓칩니다. 기능별 필수/선택 의존·검사 비용·pool·queue·실제 사용자 성공을 함께 보고 범위를 정합니다.

## Instance 제외가 남은 Instance를 더 아프게 할 수 있습니다

10개 중 3개를 제외하면 같은 유입이 7개에 몰립니다. 부하 때문에 그 7개도 readiness를 잃으면 악순환입니다. 실패 연속 횟수·성공 연속 횟수·복귀 지연·서로 다른 임계값의 hysteresis로 짧은 잡음을 완화할 수 있지만 실제 용량 부족을 긴 임계로 숨기면 사용자 오류만 늦게 보입니다.

cold cache인 새 instance는 가중치를 점진적으로 올릴 수 있습니다. 복귀 때 유입량·오류·queue가 안정되는지 확인하고 이미 열린 연결은 별도 drain해야 합니다. readiness 변경만으로 TCP·HTTP/2·WebSocket이 다른 server로 이동하지 않습니다.

```diagram
{"title":"측정 지연이 있는 피드백은 작은 변화로 검증합니다","caption":"화살표는 제어 루프입니다. 한도 변화의 효과가 늦게 관측되므로 같은 옛 측정에 반복 과반응하지 않게 합니다.","rows":[[{"id":"observe","label":"latency·in-flight·queue·오류"}],[{"id":"filter","label":"관측 창·신선도·hysteresis"}],[{"id":"adjust","label":"변경률 제한·최소/최대 한도"}],[{"id":"traffic","label":"실제 유입·작업 완료·회복"}]],"edges":[{"from":"observe","to":"filter","label":"노이즈·지연 확인"},{"from":"filter","to":"adjust","label":"제한된 조정"},{"from":"adjust","to":"traffic","label":"용량 변화"}]}
```

## 적응형 한도는 자동으로 안정해지지 않습니다

한도를 100→200으로 늘린 효과가 10초 뒤에 보이는데 매초 같은 낮은 지연을 보고 계속 늘리면 피드백이 오기 전 과부하에 도달할 수 있습니다. 관측 창·smoothing·최소 표본·변경률 상한·cooldown·min/max·안전한 고정 fallback을 둡니다. 지표 누락을 지연 0으로 해석하지 않습니다.

지연 상승이 원본 포화인지 외부 API 장애·network·GC인지 구분합니다. 한도를 내릴 때 현재 in-flight 100이 새 limit 50보다 크다고 50개가 즉시 종료된 것으로 세지 않습니다. 새 수락을 줄이고 실제 완료까지 물리 점유를 유지합니다. 제어 target과 실제 남은 실행은 다른 상태입니다.

| 상황 | 확인할 판단 |
| --- | --- |
| 지연만 상승 | 실제 병목·오류·queue와 대조 |
| 지표 오래됨 | 안전한 fallback·조정 중지 |
| limit 감소 | 새 수락 차단·기존 실제 완료 대기 |
| readiness 복귀 | cold capacity·점진 유입 |
| 공통 dependency 실패 | 전체 제외의 영향·기능 저하 정책 |

## 전파와 연결 종료를 측정합니다

endpoint 제외 시각·마지막 신규 요청·활성 연결·종료 기한을 기록합니다. 고정 sleep 하나로 LB 전파가 끝났다고 증명하지 않습니다. GOAWAY·재연결·cursor·멱등 key 계약으로 진행 중 요청을 보호하고 내부 정리 기한을 외부 유예보다 짧게 둡니다.

계단 부하·burst·지표 누락·공통 장애·cold start·회복을 분리해 수렴·진동·성공 처리율·p99·재시도·제외 비율을 봅니다. 이 노트는 제어 설계이며 실제 적응형 controller의 안정성을 실험한 결과는 아닙니다.
