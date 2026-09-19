---
id: indexeddb-upgrade-rollback
title: onupgradeneeded의 두 번째 변경이 실패하면 첫 번째 변경은 어떤 상태로 남으며 재시도는 무엇을 기준으로 하나요?
difficulty: 중하
category: 웹
tags:
  - IndexedDB
  - transaction
  - versionchange
  - schema upgrade
related:
  - transaction-and-lost-update
---
# onupgradeneeded의 두 번째 변경이 실패하면 첫 번째 변경은 어떤 상태로 남으며 재시도는 무엇을 기준으로 하나요?

## 구두 답변

두 번째 스키마 변경이 versionchange 트랜잭션을 abort시키면 첫 번째 변경도 최종 DB에 남지 않습니다. 예를 들어 `createObjectStore("users")`가 성공한 직후 이미 존재하는 index를 만들려다 오류가 나면, 개별 요청 success는 중간 과정일 뿐이고 전체 업그레이드는 마지막으로 커밋된 버전으로 되돌아갑니다. 목표 버전이 확정되는 시점도 `upgradeneeded` 진입이 아니라 업그레이드가 끝나 open success와 transaction complete가 성립한 뒤입니다.

따라서 재시도는 “users store가 이미 있다”는 가정을 하지 않고 이전 버전의 oldVersion에서 목표 버전까지 다시 수행합니다. 마이그레이션 단계는 실제 적용 여부를 추측하기보다 version 분기로 작성하고, 실패 시 기본 abort를 유지할지 오류를 잡아 계속할지를 명시합니다. 대용량 데이터 변환을 같은 upgrade에 넣으면 모든 탭이 오래 막힐 수 있으므로, 먼저 구버전도 읽을 수 있는 필드를 추가하고 나중에 일반 readwrite 백필로 분리하는 선택도 가능합니다. 아래의 상태 기록은 설명용이며 특정 브라우저의 오류 문자열을 보장하지 않습니다.

예를 들어 구버전 1에서 3으로 올라가는 경로가 `1→2: users store 생성`, `2→3: email index 생성`이라면, 2→3에서 실패한 재시도는 1→2가 이미 커밋됐는지에 따라 oldVersion이 달라지는 것이 아니라 마지막으로 실제 커밋된 버전에서 시작합니다. 1에서 실패했다면 두 단계를 모두 다시 실행하고, 2에서 실패했다면 index 단계부터 다시 실행합니다. 이 기준을 코드의 `event.oldVersion`과 최종 open success로 검증하면 부분 성공을 추측하는 플래그를 줄일 수 있습니다.

## 득점 포인트

- 개별 DDL 요청 성공과 versionchange 전체 commit을 분리합니다.
- 실패 후 마지막 커밋 버전을 기준으로 oldVersion 분기를 재수행한다고 답합니다.
- 큰 백필을 schema cutover와 분리할 비용 판단을 포함합니다.

## 감점 포인트

- 첫 번째 object store가 이미 영속화됐으니 두 번째 변경만 재실행하면 된다고 합니다.
- onupgradeneeded 호출 자체를 새 버전 확정으로 봅니다.
- 오류를 숨긴 채 부분 스키마를 정상으로 표시합니다.

## 더 파고들 거리

- 마이그레이션을 반복 실행해도 안전하게 만드는 불변식은 무엇인가요?
- 구버전 코드가 남아 있는 동안 새 필드를 추가·백필하는 배포 순서를 어떻게 잡겠습니까?
