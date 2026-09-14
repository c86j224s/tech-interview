---
id: calendar-time
title: 달력의 다음 날과 24시간 뒤의 차이
topic: 설계
summary: 현지 달력·UTC instant·단조 경과를 구분하고 DST의 존재하지 않는/중복 시각·timezone ID·반복 규칙·tzdata·월말 정책을 설명합니다.
questionIds: [time-zone-calendar-arithmetic]
---

# 달력의 다음 날과 24시간 뒤의 차이

## 매일 오전 9시는 24시간 간격 Timer와 다릅니다

미국 New York의 2024-03-09 09:00은 UTC 14:00이고 DST 전환 뒤 2024-03-10 09:00은 UTC 13:00입니다. 현지 다음 날 같은 시각까지 경과 시간은 23시간입니다. 원래 instant에 24시간을 더하면 현지 10시가 됩니다. 반대로 가을 전환 구간의 하루는 25시간일 수 있습니다.

사용자가 원한 것이 매일 현지 9시인지 정확히 24시간 뒤인지 먼저 정합니다. 화면 표시·달력 반복·경과 timeout을 한 timestamp 필드와 연산으로 처리하지 않습니다.

## 세 종류의 시간을 나눕니다

| 의미 | 표현 | 예 |
| --- | --- | --- |
| 절대 순간 | UTC instant·명시 offset | 실제 결제 발생 시점 |
| 사용자 달력 의도 | local date/time·timezone ID·반복 규칙 | 매일 America/New_York 09:00 |
| 로컬 경과 | monotonic clock·duration | 요청 deadline·실행 timeout |

UTC timestamp는 분산 사건의 정확한 전역 순서를 자동 보장하지 않습니다. clock skew가 있으면 ID·version·인과를 함께 사용합니다. monotonic 값은 다른 host나 재시작 뒤의 보편 절대시각이 아니며 장기 내구 예약은 적절한 절대/달력 기록이 필요합니다.

```diagram
{"title":"사용자 달력 의도를 Timezone 규칙으로 Instant에 연결합니다","caption":"화살표는 변환입니다. 반복 예약은 매 회차 지역 규칙을 적용하며 이전 instant에 무조건 24시간을 더하지 않습니다.","rows":[[{"id":"intent","label":"현지 매일 09:00 · timezone ID"}],[{"id":"rules","label":"날짜·tzdata·gap/fold 정책"}],[{"id":"instant","label":"해당 회차의 UTC instant"}],[{"id":"execute","label":"내구 회차 ID·실행·중복 억제"}]],"edges":[{"from":"intent","to":"rules","label":"달력 연산"},{"from":"rules","to":"instant","label":"모호성 해소"},{"from":"instant","to":"execute","label":"회차 예약"}]}
```

## 존재하지 않거나 두 번 있는 시각을 처리합니다

봄 전환의 02:30이 존재하지 않을 수 있고 가을의 01:30은 서로 다른 offset으로 두 번 나타날 수 있습니다. gap에서는 건너뛸지 다음 유효 시각으로 이동할지, fold에서는 이른/늦은 offset 또는 두 회차 중 무엇을 실행할지 명시합니다. 라이브러리의 기본 보정이 사용자 계약과 맞는지 확인합니다.

고정 offset `-05:00`만 저장하면 미래 지역 법규·DST를 표현하지 못합니다. 반복 예약은 원래 현지 시각·지역 ID·반복 규칙·모호성 정책과 필요하면 계산된 다음 instant를 보관합니다. tzdata 갱신으로 미래 instant가 바뀔 수 있어 재계산·사용자 안내·이미 실행한 회차의 중복 방지를 정합니다.

## 월말·윤년·정지 중 누락도 계약입니다

1월 31일의 다음 달을 2월 말로 조정할지 오류로 할지, 2월 29일 매년 반복을 어떻게 할지 정합니다. 정지 중 놓친 회차는 전부 보충·최신 한 번·skip 중 업무 의미에 맞춰 선택하고 회차 ID로 중복 실행을 막습니다. 서버 local timezone을 암묵적으로 문자열에 적용하지 않습니다.

## 변환 결과와 경과 시간을 둘 다 시험합니다

전환 전후·gap/fold·월말·윤년·다른 지역·tzdata 변경·재시작을 검사합니다. 이 노트는 시간 의미 설명이며 모든 라이브러리와 timezone 구현을 시험한 결과는 아닙니다. 특정 지역 예시는 그 날짜의 timezone 규칙에 대한 예입니다.
