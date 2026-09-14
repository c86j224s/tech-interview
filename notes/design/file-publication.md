---
id: atomic-file-publication
title: 파일의 원자 공개·내구화·무결성 검증
topic: 설계
summary: 임시 파일·검증·rename·파일/디렉터리 flush를 나누고 동시 writer·열린 핸들·다중 파일 manifest·checksum과 신뢰 출처를 설명합니다.
questionIds: [file-atomic-replace, file-checksum-integrity]
---

# 파일의 원자 공개·내구화·무결성 검증

## 기존 파일에 직접 쓰면 독자가 반쪽을 볼 수 있습니다

설정 파일을 truncate한 뒤 새 JSON을 쓰는 중 process가 죽으면 빈 파일이나 잘린 내용이 남을 수 있습니다. 같은 filesystem의 적절한 임시 파일에 완성본을 쓰고 형식·길이·의미·권한을 검증한 뒤 이름을 교체합니다. 실패한 값은 공개하지 않고 마지막 정상 설정과 오류를 구분합니다.

임시 이름은 충돌·symlink 경계를 피하도록 안전하게 생성하고 필요한 권한을 적용합니다. rename의 원자 교체 조건은 OS·filesystem에 따라 확인합니다. 다른 filesystem으로의 이동을 같은 원자 rename으로 가정하지 않습니다.

## 독자의 원자 관찰과 전원 장애 후 내구성은 다릅니다

POSIX 계열의 전형적 설계는 임시 파일 write→파일 fsync→rename→부모 directory fsync입니다. 파일 내용과 이름 변경의 내구화는 다른 경계이고 storage·OS가 약속하는 flush 범위를 확인해야 합니다. process kill 시험이 실제 전원 손실·장치 cache의 모든 동작을 재현하는 것도 아닙니다.

```diagram
{"title":"검증한 새 파일을 공개하고 이름 변경도 내구화합니다","caption":"화살표는 대표적인 POSIX 계열 절차입니다. OS·filesystem의 실제 계약을 확인해야 하며 rename 한 번이 전원 장애 내구성 전체를 보장하지 않습니다.","rows":[[{"id":"temp","label":"같은 filesystem의 안전한 임시 파일"}],[{"id":"validate","label":"완전 write·형식/내용/권한 검사"}],[{"id":"sync","label":"파일 flush·fsync"}],[{"id":"rename","label":"대상 이름으로 원자 교체"}],[{"id":"directory","label":"부모 directory 내구화"}]],"edges":[{"from":"temp","to":"validate","label":"새 값 준비"},{"from":"validate","to":"sync","label":"유효한 값만"},{"from":"sync","to":"rename","label":"공개"},{"from":"rename","to":"directory","label":"이름 변경 보존"}]}
```

열린 이전 file handle은 교체 뒤에도 옛 inode를 읽을 수 있습니다. loader의 재열기·version 적용·error 정책을 별도로 정합니다. writer A와 B가 같은 옛 파일을 기반으로 저장하면 각 rename은 원자적이어도 마지막 쓰기가 앞선 변경을 잃습니다. 버전 확인과 교체 사이까지 보호하는 lock·조건부 저장 계약이 필요합니다. 단순 hash 읽기 후 무보호 rename은 경쟁을 없애지 않습니다.

## 여러 파일은 하나의 Manifest로 버전을 가리킬 수 있습니다

A.json·B.json을 각각 rename하면 구A+신B의 중간 조합이 보일 수 있습니다. immutable version directory에 전체를 준비·검증한 뒤 작은 manifest/current pointer를 원자 게시하고 reader는 그 version을 한 번 읽어 사용합니다. 이전 version 정리는 살아 있는 reader·rollback 보관 정책과 함께 합니다. directory 전체의 내구화·게시 실패도 따로 검증합니다.

## Checksum 일치는 누가 만들었는지 말해 주지 않습니다

공격자가 파일과 digest를 함께 바꾸면 둘은 맞을 수 있습니다. 신뢰된 manifest·서명·안전한 배포 경로로 기대 digest를 얻고 실제 받은 bytes를 계산합니다. CRC는 우발 손상 탐지에, 충돌 저항이 필요한 경우에는 적합한 cryptographic hash를 사용합니다. 디지털 서명도 신뢰 key·용도·version·회전·철회 정책을 확인해야 합니다.

| 확인 | 의미 | 별도 확인 |
| --- | --- | --- |
| digest 일치 | 기대 bytes와 일치 | 기대 digest의 신뢰 출처 |
| 유효한 서명 | 신뢰 key가 해당 내용을 서명 | 내용 안전성·적용 version |
| chunk hash | 해당 조각의 bytes | 전체 순서·누락·길이 |
| atomic rename | 허용된 원자 공개 | 내구·동시 writer·여러 파일 |

큰 파일은 streaming hash로 메모리 부담을 줄이고 전체 길이·완료 상태를 확인합니다. 압축 전/후 어느 표현인지 명시하며 multipart ETag를 무조건 파일 MD5로 추측하지 않습니다. hash가 맞는 악성 파일도 있으므로 자동 실행·압축 해제 경로·sandbox 검사는 남습니다.

## 중단 위치와 신뢰 경로를 함께 시험합니다

write 중·검증 후·rename 전후·동시 writer·옛 reader·한 byte 변경·잘린 파일·잘못된 digest 출처를 시험합니다. 임시 파일 삭제는 owner·현재 사용 여부를 확인합니다. 이 노트는 공개/내구 설계이며 실제 전원 장애 시험을 수행한 결과는 아닙니다.
