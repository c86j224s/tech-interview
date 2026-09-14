---
id: log-audit-budget
title: 진단 로그의 예산과 Transactional Audit
topic: 설계
summary: 최소 구조화 필드·외부 상관 ID·비활성 로그 비용·상세 sampling과 전체 빈도·bounded queue·감사 원자 기록·전송 dedup을 설명합니다.
questionIds: [logging-performance-safety, error-log-rate-sampling, external-correlation-id-validation, transactional-audit-record]
---

# 진단 로그의 예산과 Transactional Audit

## 전체 본문보다 답해야 할 질문에 맞는 필드를 남깁니다

결제 retry에는 논리 요청 ID·결제 ID·물리 시도·상태·오류 분류·지연·service version이 필요합니다. token·비밀번호·결제 수단·전체 개인정보를 그대로 기록할 필요는 없습니다. 로그 저장소도 데이터 전송 목적지이므로 접근·암호화·보관·삭제·검색 시 재노출을 관리합니다.

외부 correlation ID는 내부 발급 ID와 구분하고 길이·문자 집합·개행·중복 정책을 검증합니다. attacker가 보낸 newline이 가짜 사건 줄을 만들지 않도록 structured logging과 적절한 encoding을 사용합니다. 이 ID는 인가·사용자 신원 증거가 아닙니다.

## 비활성 Log도 미리 만든 문자열의 비용은 남습니다

`debug(serializeHugeObject(x))`에서 debug가 꺼져 있어도 인자 평가가 먼저라면 CPU·allocation 비용은 이미 냅니다. level guard·lazy evaluation을 사용하고 stack 수집·직렬화·전송을 구분합니다. 모든 계층이 같은 exception stack을 출력하면 비용과 잡음이 커지므로 원인 계층과 상위 요약의 책임을 나눕니다.

| 신호 | 보존 방법 |
| --- | --- |
| 전체 발생 빈도 | bounded 오류 class counter·기간·최초/최근 |
| 상세 stack | 제한된 대표 표본·trace 연결 |
| 정상 debug | level·sampling·drop 가능 정책 |
| 필수 감사 | 업무 변경과 내구 기록의 원자 경계 |
| 로그 유실 | 별도 drop/queue 지표 |

## 상세 Sampling과 전체 오류 수를 섞지 않습니다

같은 오류 100만 건 중 stack 10개를 남겨도 총 100만·관측 기간·최초/최근를 별도 집계합니다. 원문 사용자 ID·자유 오류 문자열을 집계 key로 무제한 쓰면 sampler 자체가 포화될 수 있습니다. bounded error code·대표 sample·시간별 상한을 사용합니다. 첫 표본이 꼭 근본 원인이라는 보장은 없어 하위 원인·상위 파생 오류를 연결합니다.

```diagram
{"title":"진단 표본과 필수 감사의 저장 경로를 나눕니다","caption":"화살표는 기록 경로입니다. drop 가능한 비동기 debug queue에 필수 감사의 원자성을 맡기지 않습니다.","rows":[[{"id":"operation","label":"업무 변경·관측 사건"}],[{"id":"diagnostic","label":"bounded 진단 queue·상세 sampling"},{"id":"audit","label":"같은 transaction의 audit/outbox"}],[{"id":"sink","label":"진단 sink·drop 관측"},{"id":"durable","label":"재시도 전송·안정 ID dedup"}]],"edges":[{"from":"operation","to":"diagnostic","label":"최소 메타데이터"},{"from":"operation","to":"audit","label":"필수 기록 함께 commit"},{"from":"diagnostic","to":"sink","label":"명시적 포화 정책"},{"from":"audit","to":"durable","label":"내구 전달"}]}
```

## 비동기 Queue도 포화 정책이 필요합니다

동기 log는 sink 지연을 요청에 전파하고 async log는 queue memory·유실·종료 flush 문제가 남습니다. queue 수/bytes·batch·전송 deadline·drop 우선순위를 정하고 sink 장애가 원본 업무를 무제한 막지 않게 합니다. “비동기니까 무료”는 아닙니다. 종료 flush에도 상한과 미전송 기록 정책이 필요합니다.

## 감사가 반드시 함께 있어야 하면 같은 Commit에 넣습니다

권한 변경과 감사 행을 같은 DB transaction에 기록하거나 outbox에 내구 기록한 뒤 비동기 전송합니다. 감사 기록 실패 시 업무도 rollback할지 명확히 하며 요구가 “반드시 함께”라면 임의로 debug queue에 fallback하지 않습니다. 최종 감사 저장소 전송은 반복될 수 있어 안정 ID·중복 처리가 필요합니다.

감사에는 주체·대상·행동·근거·전후 version·논리 ID를 필요한 범위로 남기고 secret 원문을 포함하지 않습니다. 원격 외부 효과와 로컬 audit는 단일 DB transaction으로 자동 묶이지 않으므로 실행 의도·결과 대사 계약을 추가합니다. 감사 내구성과 감사 내용의 참됨도 별도입니다.

## 로그 장애 자체를 시험합니다

긴/개행 ID·오류 폭주·sink 지연·queue 포화·commit 전후 중단·전송 응답 유실을 검사합니다. 사용자 p99·queue bytes·drop·비용·민감 정보 노출·감사/업무 행 일치를 확인합니다. 이 노트는 기록 설계이며 운영 로그 저장소에 부하를 가한 결과는 아닙니다.
