---
id: dependency-lock
title: Lockfile과 재현 가능한 설치의 경계
topic: 설계
summary: 버전 범위와 직접/전이 해결 그래프를 구분하고 잠금 설치·manager version·native/optional/postinstall·clean cache·업데이트 검증을 설명합니다.
questionIds: [build-dependency-lockfiles]
---

# Lockfile과 재현 가능한 설치의 경계

## Manifest 범위와 날짜별 의존성 그래프 변화

manifest의 `^1.2.0`은 특정 파일 하나가 아니라 설치에 허용하는 version 범위입니다. 직접 dependency의 version을 고정해도 그 package가 다시 요구하는 전이 의존의 선택은 달라질 수 있습니다. lockfile은 직접·전이 dependency에 실제로 선택한 version, source, integrity(받은 내용의 일치 여부를 확인하는 정보) 같은 해결 정보를 기록해 같은 dependency graph를 다시 설치하도록 돕습니다.

패키지 매니저마다 lockfile의 형식과 ‘잠금 설치’가 확인하는 범위가 다르므로 manager version·설정·registry·platform을 먼저 맞춥니다. 예를 들어 npm에서는 `npm ci`처럼 lockfile을 기준으로 설치하고 manifest와 lockfile이 맞지 않으면 오류로 드러내는 경로를 사용합니다. CI 실패를 없애려고 lockfile을 지우고 다시 해결하면, 검토했던 dependency 입력이 바뀌고 version graph도 달라질 수 있습니다.

## 고정된 의존성 그래프와 Binary 재현성의 차이

| 입력 | lockfile만으로 충분하지 않은 이유 |
| --- | --- |
| OS·architecture | optional dependency 선택 차이 |
| compiler·native library | addon binary·ABI 변화 |
| postinstall | 실행 코드가 외부 자료를 가져올 수 있음 |
| 환경 변수·시간·경로 | build 결과에 포함될 수 있음 |
| registry·외부 URL | 가용성·source·별도 다운로드 |
| cache | 오래된 자료가 clean 실패를 가릴 수 있음 |

고정된 package도 악성 동작을 할 수 있어 integrity가 안전성 검토를 대체하지 않습니다. 필요한 registry·자격·egress를 제한하고 install script 실행 권한을 관리합니다. source 이름과 조직 package 이름의 혼동도 검토합니다.

```diagram
{"title":"잠금 그래프와 실행 환경을 함께 기록합니다","caption":"화살표는 설치 입력입니다. 같은 dependency version만으로 native 산출물과 외부 다운로드까지 동일해지는 것은 아닙니다.","rows":[[{"id":"manifest","label":"manifest · 허용 범위"}],[{"id":"lock","label":"lockfile · 해결 graph·integrity"},{"id":"environment","label":"manager·OS·compiler·registry"}],[{"id":"install","label":"잠금 기반 clean install"}],[{"id":"verify","label":"build·test·실제 산출물 비교"}]],"edges":[{"from":"manifest","to":"lock","label":"명시적 해결"},{"from":"lock","to":"install","label":"검토된 graph"},{"from":"environment","to":"install","label":"실행 조건"},{"from":"install","to":"verify","label":"같은 동작 확인"}]}
```

## 업데이트 Diff와 실행 행동 검토

직접 package 변경이 전이 package·install script·권한·license·취약점·API 의미를 바꿀 수 있습니다. manifest와 lock diff를 함께 읽고 의도한 갱신인지 확인합니다. 영원히 고정하면 보안 수정도 놓치므로 정기 갱신·격리 시험·점진 적용·rollback 정책이 필요합니다.

## Clean 설치와 지원 Platform 확인

warm cache에서만 설치가 통과하면 이미 저장된 package를 다시 써서 registry 가용성이나 integrity 문제를 보지 못할 수 있습니다. 따라서 cache가 비어 있는 격리된 환경에서 지원 OS/architecture별 clean install을 하고, native build와 런타임 test까지 실행한 범위를 기록합니다. package를 이전 version으로 rollback해도 이미 발생한 DB migration이나 외부 효과는 되돌아가지 않으므로, 설치 복구와 데이터·외부 상태 복구를 별도 계획으로 둡니다.

이 노트는 설치 계약 설명이며 현재 작업에서 모든 지원 platform의 무캐시 설치를 새로 실행한 결과는 아닙니다.
