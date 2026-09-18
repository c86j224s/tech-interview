---
id: log-audit-budget
title: 진단 로그의 예산과 Transactional Audit
topic: 설계
summary: 최소 구조화 필드·외부 상관 ID·비활성 로그 비용·상세 sampling과 전체 빈도·bounded queue·감사 원자 기록·전송 dedup을 설명합니다.
questionIds: [logging-performance-safety, error-log-rate-sampling, external-correlation-id-validation, transactional-audit-record]
---

# 진단 로그의 예산과 Transactional Audit

로그와 감사 기록은 모두 사건을 남기지만 잃어도 되는 진단 신호와 업무 상태를 증명해야 하는 내구 기록은 다른 경로와 실패 정책이 필요합니다. 요청에서 최소 상관 ID를 만든 뒤 상세 진단은 bounded queue로 제한하고, 필수 감사는 업무 변경과 같은 원자 경계에 두는 순서로 설계합니다.

## 질문 중심의 최소 로그 필드

결제 retry에는 논리 요청 ID·결제 ID·물리 시도·상태·오류 분류·지연·service version이 필요합니다. token·비밀번호·결제 수단·전체 개인정보를 그대로 기록할 필요는 없습니다. 로그 저장소도 데이터 전송 목적지이므로 접근·암호화·보관·삭제·검색 시 재노출을 관리합니다.

외부 correlation ID는 내부 발급 ID와 구분하고 길이·문자 집합·개행·중복 정책을 검증합니다. attacker가 보낸 newline이 가짜 사건 줄을 만들지 않도록 structured logging과 적절한 encoding을 사용합니다. 이 ID는 인가·사용자 신원 증거가 아닙니다.

## 비활성 Log의 사전 문자열 생성 비용

`debug(serializeHugeObject(x))`처럼 호출하면 debug level이 꺼져 있어도 `serializeHugeObject(x)`가 먼저 평가되어 CPU와 allocation 비용을 냅니다. 그래서 level guard나 lazy evaluation으로 상세 문자열·stack 수집을 실제 기록이 허용될 때만 수행하고, 직렬화와 전송 비용도 따로 봅니다.

모든 계층이 같은 exception stack을 다시 출력하면 비용과 잡음이 함께 커지므로, 원인 계층은 stack을 남기고 상위 계층은 요약만 남기는 식으로 책임을 나눕니다.

| 신호 | 보존 방법 |
| --- | --- |
| 전체 발생 빈도 | bounded 오류 class counter·기간·최초/최근 |
| 상세 stack | 제한된 대표 표본·trace 연결 |
| 정상 debug | level·sampling·drop 가능 정책 |
| 필수 감사 | 업무 변경과 내구 기록의 원자 경계 |
| 로그 유실 | 별도 drop/queue 지표 |

## 상세 Sampling과 전체 오류 수의 분리

같은 오류가 100만 건 발생해 stack 10개만 샘플링하더라도, 전체 발생 수 100만은 별도 counter로 세고 관측 기간과 최초·최근 시각도 별도 집계합니다. stack 표본 수를 줄인 것은 발생 빈도를 줄인 것이 아니기 때문입니다.

원문 사용자 ID나 자유 오류 문자열을 집계 key로 무제한 만들면 key 종류가 계속 늘어 sampler 자체가 포화될 수 있으므로, bounded error code와 대표 sample, 시간별 상한을 사용합니다. 첫 표본이 근본 원인이라는 보장은 없으므로 하위 원인과 상위 파생 오류를 연결해 읽습니다.

```diagram
{"title":"진단 표본과 필수 감사의 저장 경로를 나눕니다","caption":"화살표는 기록 경로입니다. drop 가능한 비동기 debug queue에 필수 감사의 원자성을 맡기지 않습니다.","rows":[[{"id":"operation","label":"업무 변경·관측 사건"}],[{"id":"diagnostic","label":"bounded 진단 queue·상세 sampling"},{"id":"audit","label":"같은 transaction의 audit/outbox"}],[{"id":"sink","label":"진단 sink·drop 관측"},{"id":"durable","label":"재시도 전송·안정 ID dedup"}]],"edges":[{"from":"operation","to":"diagnostic","label":"최소 메타데이터"},{"from":"operation","to":"audit","label":"필수 기록 함께 commit"},{"from":"diagnostic","to":"sink","label":"명시적 포화 정책"},{"from":"audit","to":"durable","label":"내구 전달"}]}
```

## 비동기 Queue의 포화 정책

동기 log는 sink 지연을 요청에 전파하고 async log는 queue memory·유실·종료 flush 문제가 남습니다. queue 수/bytes·batch·전송 deadline·drop 우선순위를 정하고 sink 장애가 원본 업무를 무제한 막지 않게 합니다. “비동기니까 무료”는 아닙니다. 종료 flush에도 상한과 미전송 기록 정책이 필요합니다.

## 업무 변경과 감사 기록의 동일 Commit

권한 변경과 감사 행을 같은 DB transaction에 기록하거나 outbox에 내구 기록한 뒤 비동기 전송합니다. 감사 기록 실패 시 업무도 rollback할지 명확히 하며 요구가 “반드시 함께”라면 임의로 debug queue에 fallback하지 않습니다. 최종 감사 저장소 전송은 반복될 수 있어 안정 ID·중복 처리가 필요합니다.

감사에는 주체·대상·행동·근거·전후 version·논리 ID를 필요한 범위로 남기고 secret 원문을 포함하지 않습니다. 원격 외부 효과와 로컬 audit는 단일 DB transaction으로 자동 묶이지 않으므로 실행 의도·결과 대사 계약을 추가합니다. 예를 들어 권한 변경 transaction과 audit row가 함께 commit되면 “기록이 존재한다”는 내구성은 얻지만, 주체·대상·전후 version을 잘못 기록하면 내용은 거짓일 수 있습니다. 반대로 audit 전송 응답이 유실돼 재전송하더라도 안정 ID로 dedup하면 저장소에는 한 사건만 남아야 합니다. 이 두 질문을 서로 다른 검증 항목으로 둡니다.

## 로그 장애 경로 시험

긴/개행 ID·오류 폭주·sink 지연·queue 포화·commit 전후 중단·전송 응답 유실을 검사합니다. 재현 연습에서는 debug level을 끈 상태에서 큰 객체 직렬화 호출 횟수가 0인지 먼저 보고, 오류 100건을 발생시켜 counter는 100에 가깝고 상세 stack 표본은 상한 이하인지 확인합니다. audit transaction 직전 중단이면 업무와 audit이 함께 없고, commit 뒤 sink 응답 유실이면 재시도 후 안정 ID가 하나만 남는 것이 예상 결과입니다.

이 노트는 기록 설계이며 운영 로그 저장소에 부하를 가한 결과는 아닙니다.
