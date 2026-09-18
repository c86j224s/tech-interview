---
id: migration-state
title: 온디맨드 데이터 이전의 세대·검증·공개 권한
topic: 분산 시스템
summary: 첫 접속 경합·내구 작업·조건부 대상 쓰기·checkpoint·현재 계정 권한·쓰기 전환·미접속 사용자 종료 계획을 설명합니다.
questionIds: [on-demand-data-migration, migration-authorization-change]
---

# 온디맨드 데이터 이전의 세대·검증·공개 권한

데이터 이전은 복사 코드보다 권위가 언제 바뀌는지와 오래된 작업이 새 데이터를 덮지 못하는지가 핵심입니다. 상태, generation, cursor, 권한 버전을 내구 기록으로 두고 “복사 완료”와 “사용자에게 새 저장소를 공개해도 됨”을 별도의 판단으로 다룹니다.

## 동시 첫 접속과 migration 작업 단일 소유권

휴대전화와 웹 요청이 같은 migration row를 읽어 둘 다 `not_started`와 같은 generation을 보더라도, 두 요청이 모두 복사를 시작하게 두면 작업이 겹칩니다. 먼저 상태·generation이 아직 그 값인지 조건부로 바꾼 요청만 job ID와 owner를 얻고, 나머지는 저장된 작업의 진행 상태를 읽거나 정한 시간만 기다립니다.

구체적으로 두 요청이 generation 8의 `not_started`를 읽었을 때 한 요청만 조건부 갱신으로 generation 9·job `m1`을 얻어야 합니다. lease가 만료된 뒤 새 worker가 generation 10을 얻으면, 살아 있던 옛 worker의 source version 8 쓰기는 대상에서 거부되어야 합니다. 이 trace를 로그에서 `account → generation → owner → batch cursor` 순서로 확인하면 중복 복사와 stale overwrite를 구분할 수 있습니다.

선택 기준은 작은 데이터의 짧은 복사는 요청 내 동기 처리도 가능하지만, 재시작·입력 대기·권한 변경·여러 batch가 있으면 독립 내구 job이 필요하다는 것입니다. 장애 진단에서는 먼저 대상 행의 version과 cursor가 함께 전진했는지, 그 다음 권위 라우팅과 현재 인가 버전이 일치하는지 확인하고, 어느 한쪽의 성공 boolean만으로 완료를 선언하지 않습니다.

따라서 완료 boolean 하나가 아니라 작업 상태와 job ID·owner·generation을 별도 내구 필드로 둬야 복사 중·검증 중·실패와 현재 소유자를 구분할 수 있습니다.

긴 이전을 첫 HTTP 연결 수명에만 묶으면 사용자가 떠났을 때 복구 근거를 잃습니다. 내구 작업을 독립 소유하고 사용자 요청은 진행·재시도·완료 결과를 조회하게 할 수 있습니다. 첫 접속 지연·대기 상한·레거시 읽기 허용 범위를 명시합니다.

## Migration 상태별 공개 가능 결과

| 상태 | 필요한 기록 | 사용자 경로 |
| --- | --- | --- |
| not_started | 원본 계정·이전 정책 | 시작 조건 검사 |
| copying | job ID·owner·generation·snapshot·cursor | 부분 대상 공개 금지 |
| verifying | 대상 version·참조·차이 | 검증 대기 |
| complete | 권위 전환 세대·검증 결과 | 새 저장소 경로 |
| needs_repair | 실패 범위·원인·재개 위치 | 명시적 보류·수동/자동 복구 |

원본 ID를 대상 unique key로 쓰면 같은 행을 찾을 수는 있지만, upsert 자체가 늦은 복사본을 막아 주지는 않습니다. 예를 들어 migration worker가 읽은 source version과 migration generation이 바뀐 뒤 쓰기를 시도하면, 대상은 source version·migration generation·현재 owner가 아직 일치할 때만 갱신하고 하나라도 다르면 쓰기를 거부하거나 보류합니다.

완료 표시에만 fencing을 걸고 데이터 쓰기는 무조건 통과시키면, 이전 worker의 값이 새 정상 write를 덮어 대상 내용이 오염될 수 있습니다.

```diagram
{"title":"복사와 검증과 접근 공개를 별도 전이로 둡니다","caption":"화살표는 정상 전환입니다. 각 단계는 내구 상태·세대 조건을 가지며 완료 공개 직전에 현재 계정·권한을 다시 확인합니다.","rows":[[{"id":"start","label":"원자 시작·작업 세대 확보"}],[{"id":"copy","label":"snapshot·증분 복사"}],[{"id":"verify","label":"값·삭제·참조·권리 검증"}],[{"id":"auth","label":"현재 대표 계정·인가 재확인"}],[{"id":"publish","label":"쓰기 권위·라우팅 전환"}]],"edges":[{"from":"start","to":"copy","label":"단일 작업 소유"},{"from":"copy","to":"verify","label":"실제 반영 위치"},{"from":"verify","to":"auth","label":"데이터 준비"},{"from":"auth","to":"publish","label":"게시 권한 충족"}]}
```

## Cursor 전진과 대상 반영의 원자성

안정적인 원본 키 순서로 bounded batch를 읽은 뒤 대상 행을 먼저 반영하고, 그 반영과 checkpoint 저장을 같은 transaction에 묶을 수 있으면 함께 commit합니다. process가 그 전에 죽으면 같은 batch를 다시 읽을 수 있으므로, transaction으로 묶지 못하는 구현은 재실행 때 이미 반영된 batch를 판별할 수 있는 명시 기록을 남깁니다. 반영에 실패한 batch의 cursor는 전진시키지 않고, 충돌 행·지원하지 않는 데이터는 보류 집합에 남겨 complete 판정에서 제외합니다.

원본을 잠깐 멈출 수 있으면 snapshot 뒤 최종 장벽을 단순화할 수 있습니다. 계속 쓰게 하려면 snapshot 이후 log·delete·재삽입을 추적하고 대상이 barrier까지 따라왔는지 확인합니다. 단순 dual-write는 한쪽 실패를 복구할 내구 기록이 필요합니다.

## 복사 시작·결과 공개 시점의 권한 재검증

이전 중 대표 계정이 병합되거나 접근 권한이 철회되고 계정이 정지될 수 있습니다. 시작 시점에 A가 허용됐더라도, 최종 공개 직전에 현재 account mapping·security version·tenant·인가를 다시 읽어 같은 대상에 계속 공개해도 되는지 판단해야 합니다. 값이 달라졌으면 공개를 멈추고 새 권위에 맞춰 재조정하며, 시작 당시 A의 권한만으로 새 대상 접근을 승인하지 않습니다.

데이터 값을 옮기는 일과 외부 로그인 자격을 연결하는 일은 다른 증명과 승인입니다. 복사 성공이 새 인증 수단 소유권 증명이 되지 않습니다. 원본에 있던 제재·제한·구매 권리도 함께 대조해 긍정 자산만 옮기고 제한을 빠뜨리지 않습니다.

## Lease 재획득·Rollback과 generation fencing

lease가 만료돼 새 worker가 시작해도 옛 worker가 살아 있을 수 있습니다. 모든 대상 쓰기·진행·완료 전이에 generation을 강제하고 stale 결과는 적용하지 않습니다. 새 owner를 얻었다는 사실이 이전 외부 효과 미실행을 증명하지는 않습니다.

새 저장소에서 정상 write를 받은 뒤 old로 되돌리면 새 변경을 잃을 수 있어 역동기화·barrier·forward repair를 정합니다. 원본·대상·라우터를 제각각 성공 boolean으로 바꾸지 말고 현재 쓰기 권위가 어디인지 조회 가능하게 합니다.

## 미접속 사용자와 migration 종료 계획

온디맨드만으로는 영원히 접속하지 않는 계정이 남습니다. 최종 batch 이전·보관 정책·레거시 종료 기한과 실행 책임을 정합니다. 남은 계정·repair·원본 호출률·첫 접속 p99·중복 작업·권한 충돌을 관찰하고 전체 종료를 판정합니다.

테스트는 동시 접속·batch 중단·lease 만료·옛 write·계정 병합·철회·부분 데이터·rollback을 포함합니다. 현재 작업에서는 사용자 데이터 migration을 실행하지 않았습니다. 본문은 이전과 공개의 상태 설계입니다.
