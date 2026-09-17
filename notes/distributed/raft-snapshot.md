---
id: raft-snapshot
title: Raft Snapshot의 적용 위치와 내구 게시
topic: 분산 시스템
summary: applied·commit·lastIncludedTerm의 차이와 일관 view·dedup·구성 보존, manifest 전환 뒤 로그 정리·follower 설치·전송 예산을 설명합니다.
questionIds: [raft-snapshot-compaction, raft-snapshot-applied-log-boundary]
---

# Raft Snapshot의 적용 위치와 내구 게시

## Commit index·applied index와 Snapshot 포함 위치

commit index=120, applied index=115이면 현재 상태 머신은 115까지만 반영했습니다. 이 상태를 저장하면서 lastIncludedIndex=120이라고 기록하면 복구는 116~120을 이미 적용했다고 보고 건너뛸 수 있습니다. snapshot의 내용과 포함 위치가 같은 논리 시점이어야 합니다.

snapshot은 키·값만 있는 파일이 아니라 어떤 로그 접두부를 상태로 대체했는지 나타내는 복구 기준입니다. lastIncludedIndex·그 index의 term·멤버 구성·필요한 client dedup 결과·outbox 상태 등 재생 의미에 필요한 데이터를 포함합니다.

| 상태 | 예 | snapshot 처리 |
| --- | --- | --- |
| commit | 120 | 확정된 최대 위치, 아직 일부 미적용 |
| apply | 115 | 현재 상태가 대표하는 위치 |
| lastIncludedIndex | 115 | 이 view와 일치해야 함 |
| 남길 log | 116 이후 | 후속 재생·복제에 필요 |

## Snapshot 생성 중 쓰기와 일관 View

예를 들어 복사 중 한 키가 로그 115, 다른 키가 118을 반영하면 그 snapshot은 어느 로그 위치의 상태인지 설명할 수 없습니다. 따라서 apply를 잠깐 멈추거나, copy-on-write·불변 view로 `state`와 dedup을 같은 경계에서 고정한 뒤 그 view만 복사합니다. 데이터는 115에서 읽고 dedup은 118에서 읽는 식으로 서로 다른 시점을 섞으면 복구 때 요청 재생 결과가 달라질 수 있습니다.

snapshot 복사에 걸리는 시간이 `T`이고 로그 추가율을 `r`(로그 항목/초)로 두면, 생성 중 약 `r×T`개의 새 로그 항목이 쌓이므로 이를 보관할 suffix 공간과 임시 snapshot 공간을 함께 계산합니다. 필요한 메모리·디스크·복사 CPU·디스크 I/O를 foreground 예산과 비교하고, 초과하면 동시 복사 수나 주기를 낮춥니다. 주기를 짧게 하면 복구 때 재생할 로그는 줄 수 있지만 정상 I/O·복사·메모리 비용은 늘어납니다.

```diagram
{"title":"유효한 복구 기준이 게시된 뒤에만 접두 로그를 지웁니다","caption":"화살표는 저장 순서입니다. rename의 원자적 가시성과 전원 장애 내구성을 구분해 데이터·메타데이터·디렉터리의 필요한 저장 계약을 확인합니다.","rows":[[{"id":"view","label":"apply 115의 일관 view"}],[{"id":"temp","label":"임시 snapshot·metadata·checksum"}],[{"id":"durable","label":"필요 데이터 내구화"}],[{"id":"manifest","label":"완성 manifest 원자 게시"}],[{"id":"delete","label":"안전한 접두 로그 정리"}]],"edges":[{"from":"view","to":"temp","label":"같은 기준 복사"},{"from":"temp","to":"durable","label":"검증·flush"},{"from":"durable","to":"manifest","label":"복구 가능한 입력"},{"from":"manifest","to":"delete","label":"대체 기준 확보"}]}
```

## 중단 이후 선택 가능한 완성 Snapshot 세대

임시 파일·metadata·checksum을 완성하고 필요한 내구화를 거친 뒤 manifest를 게시합니다. 새 snapshot이 재시작에서 유효하게 선택되기 전에 옛 log를 지우면 둘 다 사용할 수 없는 틈이 생깁니다. 반대로 게시 후 cleanup이 중단되면 옛 파일이 남을 수 있지만 다음 재시작에서 완성 세대를 선택하고 안전하게 정리할 수 있어야 합니다.

파일 하나의 rename만으로 모든 저장 장치의 전원 손실 내구성이 증명되지는 않습니다. 파일시스템·OS·스토리지의 flush·directory persistence 계약을 따릅니다. checksum은 바이트 손상을 찾는 수단이지 내용이 올바른 applied 상태라는 증명은 아닙니다.

## Follower Snapshot의 임시 수신과 원자 설치

필요한 접두 로그가 leader에서 정리된 follower는 InstallSnapshot 경로로 따라잡을 수 있습니다. 수신 청크의 snapshot ID·offset·무결성·총 크기를 검사하고 임시 상태에 모은 뒤 완성된 snapshot을 원자적으로 설치합니다. 중간 파일을 곧바로 state machine 읽기 대상으로 쓰지 않습니다.

먼저 follower log에 `lastIncludedIndex`와 같은 index의 entry가 있고 term도 snapshot의 `lastIncludedTerm`과 같은지 비교합니다. 일치하면 그 entry 뒤의 suffix를 유지합니다.

일치하는 경계가 없으면 snapshot과 충돌할 수 있는 기존 log를 버린 뒤 snapshot 이후부터 다시 받습니다. 따라서 로컬 log 전부를 무조건 지우거나 모든 suffix를 무조건 유지하면 안 되며, 설치 뒤 `applied` 위치가 실제 상태가 대표하는 위치와 같고 필요한 read index 조건을 만족할 때만 해당 읽기를 허용합니다.

## Snapshot 전송·재시도와 복제 제어 예산

느린 follower로 거대한 snapshot을 반복 전송하면 leader의 디스크·네트워크·메모리와 정상 heartbeat·AppendEntries가 경쟁합니다. 동시 전송 수·청크 buffer·재시도·전체 기한을 제한하고 취소된 전송의 자원을 실제 종결 때 해제합니다.

snapshot에 dedup 기록을 빼거나 너무 빨리 만료하면 복구 뒤 같은 client 요청을 다시 적용할 수 있습니다. 보관·client 세션·최대 재시도·외부 효과 원장을 함께 설계합니다. 단순 state dump 크기 절감을 위해 의미 있는 상태를 임의로 생략하지 않습니다.

## Snapshot 생성·게시·삭제·설치 중단 시험

applied=115, commit=120 상태를 고정해 snapshot 복원 후 116부터 적용되는지 확인합니다. 임시 쓰기 중단·내구화 뒤 중단·manifest 뒤 중단·log cleanup·follower 부분 수신을 각각 시험하고 값·구성·요청 결과가 같은 기준으로 돌아오는지 봅니다. 현재 작업에서는 실제 Raft snapshot 구현을 실행하지 않았습니다. 본문은 복구 불변식과 저장 순서 설명입니다.
