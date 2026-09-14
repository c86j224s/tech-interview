---
id: dependency-lock
title: Lockfile과 재현 가능한 설치의 경계
topic: 설계
summary: 버전 범위와 직접/전이 해결 그래프를 구분하고 잠금 설치·manager version·native/optional/postinstall·clean cache·업데이트 검증을 설명합니다.
questionIds: [build-dependency-lockfiles]
---

# Lockfile과 재현 가능한 설치의 경계

## 같은 Manifest 범위도 다른 날에는 다른 그래프가 될 수 있습니다

manifest의 `^1.2.0`은 하나의 파일이 아니라 허용되는 version 범위를 뜻합니다. 직접 dependency가 고정돼도 그 dependency의 전이 의존이 달라질 수 있습니다. lockfile은 선택된 직접·전이 version과 source·integrity 등 manager가 사용하는 해결 정보를 기록해 같은 그래프를 다시 설치하도록 돕습니다.

패키지 매니저별 lock 의미와 형식은 다릅니다. manager version·설정·registry·platform을 맞추고 npm의 npm ci 같은 잠금 기반 설치 경로로 manifest 불일치를 오류로 드러냅니다. CI 실패를 없애려고 lockfile을 삭제해 다시 해결하면 검토한 입력 자체가 바뀝니다.

## 그래프 고정과 Binary 재현은 같은 보장이 아닙니다

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

## 업데이트는 Diff와 행동을 같이 검토합니다

직접 package 변경이 전이 package·install script·권한·license·취약점·API 의미를 바꿀 수 있습니다. manifest와 lock diff를 함께 읽고 의도한 갱신인지 확인합니다. 영원히 고정하면 보안 수정도 놓치므로 정기 갱신·격리 시험·점진 적용·rollback 정책이 필요합니다.

## Clean과 지원 Platform을 실제로 확인합니다

warm cache 설치만 통과하면 registry 가용성·integrity 문제를 놓칠 수 있습니다. 격리된 clean install·지원 OS/architecture·native build·런타임 test를 확인하고 검증한 범위를 적습니다. package rollback도 이미 발생한 DB migration이나 외부 효과를 되돌리지 않습니다.

이 노트는 설치 계약 설명이며 현재 작업에서 모든 지원 platform의 무캐시 설치를 새로 실행한 결과는 아닙니다.
