---
id: indexeddb-upgrade-blocked-tabs
title: 두 탭이 같은 IndexedDB를 열고 있을 때 스키마 업그레이드가 blocked가 되는 이유는 무엇인가요?
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
# 두 탭이 같은 IndexedDB를 열고 있을 때 스키마 업그레이드가 blocked가 되는 이유는 무엇인가요?

## 구두 답변

직접적인 이유는 다른 탭의 연결이 살아 있어 versionchange 업그레이드의 선행 조건인 연결 종료가 충족되지 않았기 때문입니다. IndexedDB는 여러 연결을 허용하지만 object store와 index를 바꾸는 스키마 전환은 기존 연결이 새 구조를 보지 못하도록 조정됩니다. A 탭이 버전 3을 열고 있고 B 탭이 버전 4를 요청하면, A에는 versionchange가 전달되고 A가 닫히면 B가 upgradeneeded로 진입합니다. A가 계속 연결을 보유하면 B는 blocked를 관찰합니다.

예를 들어 A가 편집 중이라면 onblocked에서 무한 재시도하지 않습니다. A는 versionchange 수신 후 새 DB 요청을 막고, 미저장 입력을 저장·취소할 기회를 준 뒤 `db.close()`를 호출합니다. B는 blocked 시작 시각, 각 탭의 versionchange 수신과 close, upgradeneeded 진입을 기록합니다. close 뒤 기존 db 객체를 계속 쓰면 새 스키마 전환과 애플리케이션 상태가 다시 엇갈리므로 DAO도 연결 세대를 바꿔야 합니다. blocked는 영구 실패가 아니라 대기 신호이며, 마지막 연결이 응답하지 않는 경우에만 사용자에게 탭 종료를 요청하는 정책을 둡니다.

실제 상태를 더 구체화하면 A가 `versionchange`를 받은 시점과 B의 `blocked` 시점이 같지 않을 수 있습니다. A가 이벤트에서 저장을 끝내고 close하면 B는 그 뒤에야 upgrade transaction을 얻습니다. 따라서 UI에는 “업그레이드 실패”보다 “다른 탭이 닫히기를 기다림”을 표시하고, close가 호출됐는데도 blocked가 유지되면 별도의 연결이나 백그라운드 문서가 남았는지 찾습니다. 데이터베이스 이름과 요청 버전만 로그에 두면 어느 탭이 소유자인지 알 수 없으므로 문서 식별자와 연결 세대를 함께 기록합니다.

## 득점 포인트

- IndexedDB 파일 경합이 아니라 versionchange와 연결 종료의 순서를 설명합니다.
- blocked를 대기 관찰값으로 해석하고 versionchange·close·upgradeneeded를 구분합니다.
- 미저장 입력을 보호하는 협력적 종료 절차를 제시합니다.

## 감점 포인트

- 두 탭이 동시에 레코드를 쓴다는 이유만으로 스키마 업그레이드가 blocked라고 단정합니다.
- onblocked에서 원인을 해결하지 않고 재시도만 반복합니다.
- 브라우저가 다른 탭을 강제 종료하거나 close 후 낡은 연결이 자동 교체된다고 말합니다.

## 더 파고들 거리

- versionchange에 응답하지 않는 탭이 있을 때 timeout 뒤 데이터 손실 없이 선택할 수 있는 화면 전환은 무엇인가요?
- 업그레이드 중 새 요청을 거절하는 저장소 접근 계층을 어떻게 설계하겠습니까?
