---
id: lsm-memtable-flush-boundary
title: 메모리 테이블이 가득 찬 LSM 저장소에서 WAL·immutable memtable·SSTable flush의 순서를 어떻게 설명하겠습니까?
difficulty: 중하
category: 데이터베이스
tags:
  - LSM
  - memtable
  - SSTable
  - WAL
related:
  - db-wal-durability
---
# 메모리 테이블이 가득 찬 LSM 저장소에서 WAL·immutable memtable·SSTable flush의 순서를 어떻게 설명하겠습니까?

## 구두 답변

먼저 WAL의 기록·내구 응답과 memtable의 메모리 가시성을 같은 사건으로 단정하지 않겠습니다. 엔진에 따라 log append와 active memtable insert의 내부 순서가 다를 수 있으므로, 질문의 핵심은 `기록됨`, `durable 응답`, `active에서 조회됨`, `SSTable로 게시됨`을 분리하는 데 있습니다. LevelDB 구현 notes에서 확인되는 공통 경로는 현재 log가 update를 받고 그 내용이 memtable에 반영되며, 한계에 도달하면 새 memtable과 log를 만들고 이전 memtable을 background에서 sorted table로 변환하는 구조입니다.

설명용으로 다음 batch를 받기 전에 예상 크기를 검사하는 엔진을 가정하겠습니다. 64MiB 한도에서 active가 63.5MiB이고 2MiB batch가 오면 기존 active를 freeze하고 새 active를 사용하는 정책을 둘 수 있습니다. 실제 LevelDB의 검사 시점·batch 초과 허용은 구현 계약이며 이 숫자 정책과 동일하다고 가정하지 않습니다. 새 active는 이후 write를 받고, immutable은 변경되지 않는 flush 입력입니다. flush worker는 immutable을 key 순서로 읽어 data block과 index를 가진 SSTable output을 만들고, 파일이 완성된 뒤에야 MANIFEST/version의 serving file set에 추가합니다. output 파일이 생겼다는 사실만으로 reader가 보게 하면 안 됩니다.

중단 지점도 따로 봅니다. log는 남았지만 SSTable publish 전이면 recovery가 log를 replay할 수 있고, output은 완성됐지만 MANIFEST가 가리키지 않으면 그 파일을 serving state의 근거로 삼지 않습니다. MANIFEST가 새 파일 집합을 기록한 뒤 죽으면 recovery가 CURRENT가 가리키는 MANIFEST를 읽습니다. WAL을 너무 일찍 삭제하면 replay할 기록이 사라지고, 반대로 파일을 게시하지 않고 참조하면 유령 파일이 됩니다. 정확한 fsync와 응답 의미는 선택한 엔진·설정 문서를 추가로 고정하겠습니다.

## 득점 포인트

- WAL append, durable response, active visibility, immutable freeze, SSTable publish를 별도 사건으로 구분합니다.
- 63.5MiB에서 2MiB가 들어올 때 active와 immutable 두 세대의 메모리 peak를 추적합니다.
- MANIFEST/CURRENT가 serving file set을 결정한다는 복구 경계를 설명합니다.

## 감점 포인트

- 모든 LSM에서 WAL 내구화가 memtable insert보다 반드시 먼저라고 단정합니다.
- SSTable 파일이 생성되자마자 reader에게 공개된다고 설명합니다.
- WAL 삭제, output 생성, MANIFEST publish를 하나의 flush 완료 사건으로 합칩니다.

## 더 파고들 거리

- durable 응답을 받은 요청이 flush 전 프로세스 종료 후 어떻게 재구성되는지 sequence로 설명해 보세요.
- immutable memtable이 여러 개 쌓일 때 메모리 상한과 foreground backpressure를 어떤 time series로 판단할까요?
