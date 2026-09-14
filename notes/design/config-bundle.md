---
id: config-bundle
title: 설정 묶음의 총량 검증·게시·재시작 적용
topic: 설계
summary: 개별 타입과 전체 resource budget·조합 제약을 나누고 immutable version bundle·요청 snapshot·즉시 철회·canary·적용 version·drain을 설명합니다.
questionIds: [configuration-validation, configuration-atomic-bundle, configuration-restart-required]
---

# 설정 묶음의 총량 검증·게시·재시작 적용

## 인스턴스당 100은 전체 100이 아닙니다

10개 instance의 pool 상한을 20→100으로 바꾸면 잠재 연결은 200→1000입니다. 즉시 모두 연결된다는 뜻은 아니지만 burst·scale-out·rolling overlap 때 도달할 상한이 달라집니다. DB 최대에서 관리·migration·다른 service·여유를 뺀 예산으로 검증합니다.

pool 대기가 줄어도 DB CPU·lock·query p99가 악화되면 성공이 아닙니다. worker·retry·fan-out·memory·deadline의 조합을 함께 검토합니다. 500의 시간 단위와 0의 비활성/무제한 의미, unknown key 정책도 schema에 포함합니다.

## 개별 값과 묶음의 불변식을 검증합니다

| 검사 | 예 |
| --- | --- |
| 타입·범위 | 음수 pool·누락 secret 거절 |
| 단위·특수값 | timeout ms·0의 의미 |
| 조합 | retry 총 대기가 요청 deadline 초과 |
| 전체 총량 | instance×pool+기타 연결 ≤ DB 예산 |
| 적용 가능성 | hot reload 또는 restart 필요 |
| 보안 | 검증 로그에 secret 원문 없음 |

시작 시 필수 설정 오류는 위험한 default로 숨기지 않고 실패시킬 수 있습니다. 동적 갱신 실패는 마지막 정상값을 유지하고 실패·현재 적용 version을 명확히 노출합니다. 설정 저장소 장애와 기존 정상 동작 지속 불가는 같은 상태가 아닙니다.

## 새 Bundle을 완성한 뒤 Root를 바꿉니다

관련 timeout·retry·pool을 따로 쓰면 신timeout+구retry의 잘못된 조합이 생길 수 있습니다. 새 version의 immutable bundle을 준비·전체 검증한 뒤 root pointer를 원자 전환합니다. 저장소가 bundle 원자 갱신을 지원하지 않으면 version namespace에 완성본을 만든 뒤 작은 manifest를 바꾸는 방식이 가능합니다.

```diagram
{"title":"저장 성공과 프로세스 적용 완료를 분리합니다","caption":"화살표는 배포 단계입니다. 새 묶음이 유효해도 모든 instance가 즉시 같은 version을 쓰는 것은 아니므로 실제 적용 상태를 확인합니다.","rows":[[{"id":"prepare","label":"새 설정 bundle·version 준비"}],[{"id":"validate","label":"타입·조합·전체 예산 검증"}],[{"id":"publish","label":"root 게시·canary 적용"}],[{"id":"instances","label":"instance별 실제 적용 version"}],[{"id":"expand","label":"사용자·DB 지표 확인 후 확대"}]],"edges":[{"from":"prepare","to":"validate","label":"완성된 값"},{"from":"validate","to":"publish","label":"유효 bundle만"},{"from":"publish","to":"instances","label":"전파 지연 있음"},{"from":"instances","to":"expand","label":"효과 검증"}]}
```

요청은 root를 한 번 읽어 일관된 설정으로 실행합니다. 다만 즉시 철회해야 하는 보안 차단을 긴 request snapshot에 묶어 계속 허용하지 않도록 별도 current policy 검사를 둡니다. 준비 중 bundle의 일부를 reader가 읽지 못하게 합니다.

## Restart가 필요한 설정은 실행 수명과 연결합니다

새 process가 검증된 version으로 준비된 뒤 옛 process의 신규 수락을 막고 drain합니다. 새·옛 process가 공존하는 총 resource와 protocol/data 호환을 확인합니다. pool limit 감소로 이미 빌린 연결을 강제로 반환한 것으로 세지 않고 신규 대여를 줄여 실제 완료 뒤 회수합니다.

rollback 때 새 데이터가 옛 코드로 읽히는지도 확인해야 합니다. 단순 설정 값 원복이 포화·남은 연결·늦은 retry를 즉시 없애지는 않습니다. 작성자·version·적용 시점·실패 instance·마지막 정상값을 secret 없이 기록합니다.

## Canary는 앱과 하위 시스템을 함께 봅니다

유효하지만 위험한 조합·전파 지연·store 장애·restart overlap·limit 감소·잘못된 bundle을 시험합니다. connection wait·DB CPU/lock·사용자 오류·p99·복귀 시간을 봅니다. 이 노트는 설정 적용 설계이며 운영 DB pool 변경을 실행한 결과는 아닙니다.
