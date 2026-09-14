---
id: write-skew
title: 다른 행의 갱신이 만드는 쓰기 편향
topic: 데이터베이스
summary: 당직자 두 명이 서로의 존재를 보고 퇴근하는 예에서 스냅샷 읽기·공통 갱신 지점·직렬화 재시도의 차이를 추적합니다.
questionIds: [db-isolation-write-skew, db-serializable-retry]
---

# 다른 행의 갱신이 만드는 쓰기 편향

## 각각의 변경은 맞는데 전체 규칙이 깨집니다

당직자 A와 B가 모두 근무 중입니다. 규칙은 “최소 한 명은 남아야 한다”입니다. A는 B가 근무 중임을 확인하고 퇴근하고, B도 A가 근무 중임을 확인하고 퇴근합니다. 같은 시점의 스냅샷을 본 두 거래가 서로 다른 자기 행만 수정하면, 같은 행 충돌이 없어도 둘 다 퇴근할 수 있습니다.

이 현상을 **쓰기 편향**(write skew)이라고 합니다. 같은 재고 값을 덮어쓰는 갱신 유실과 다릅니다. 각 행은 정상적인 값이고 두 변경도 모두 남았지만, 여러 행을 함께 보아야 하는 규칙이 깨진 것입니다.

## 읽은 집합과 쓴 행을 나누어 봅니다

| 단계 | 거래 A | 거래 B | 커밋된 당직 수 |
| --- | --- | --- | ---: |
| 시작 | | | 2 |
| 읽기 | A·B 모두 근무 중 | A·B 모두 근무 중 | 2 |
| 판단 | B가 있으니 A 퇴근 가능 | A가 있으니 B 퇴근 가능 | 2 |
| 쓰기 | A 행만 false | B 행만 false | 아직 2 |
| 둘 다 커밋 | A 퇴근 | B 퇴근 | 0 |

```diagram
{"title":"서로 다른 쓰기 뒤의 교차 의존","caption":"화살표는 상대가 근무 중이라는 읽기 결과에 의존하는 관계입니다. 쓰는 행이 달라도 서로의 판단 근거를 바꾸므로 충돌이 있습니다.","rows":[[{"id":"a","label":"거래 A","detail":["B=true를 읽음","A=false를 씀"]}],[{"id":"b","label":"거래 B","detail":["A=true를 읽음","B=false를 씀"]}]],"edges":[{"from":"a","to":"b","label":"B의 상태에 의존"},{"from":"b","to":"a","label":"A의 상태에 의존"}]}
```

A만 먼저 완전히 실행한 뒤 B를 실행했다면 B는 A가 퇴근한 것을 보고 남아야 합니다. 반대 순서도 같습니다. 최종 당직 수 0은 어느 직렬 순서로도 만들 수 없는 결과입니다. 스냅샷이 읽기 중 바뀌지 않는다는 사실은 이 교차 의존을 자동으로 거절한다는 뜻이 아닙니다.

## 자기 행의 버전만 검사하면 부족합니다

각 행에 `version`을 두어 A는 A의 버전, B는 B의 버전을 검사해도 서로 다른 행을 바꾸므로 둘 다 성공할 수 있습니다. `SELECT FOR UPDATE`도 각자 자기 행만 잠그면 같은 문제가 남습니다.

보호해야 할 단위는 “A 행”이 아니라 “그룹 안에 최소 한 명이 남는다”는 조건입니다. 이 조건을 표현하는 공통 행을 만들거나, 관련 집합을 정확히 잠그거나, 직렬화 격리로 읽기·쓰기 의존 충돌을 검출하는 방식이 필요합니다.

## 공통 행에 조건부 감소를 모읍니다

한 대안은 당직 그룹 행에 `active_count`를 두고, 퇴근하려는 거래가 그 값을 조건부로 감소시키는 것입니다. 다음은 인가된 사용자의 유효한 요청이며, 모든 당직 변경 경로가 같은 규칙을 사용한다는 전제의 슈도코드입니다.

```text
begin transaction
    person = lock_person(person_id)
    if person is absent: rollback; return not_found
    if not person.on_call: rollback; return already_off

    changed = UPDATE duty_group
              SET active_count = active_count - 1
              WHERE id = person.group_id AND active_count > 1
    if changed != 1:
        rollback
        return must_stay
    UPDATE people SET on_call = false WHERE id = person_id
commit
```

초기 count=2에서 A가 감소시키면 1이 됩니다. B의 조건 `active_count > 1`은 실패하거나 엔진의 충돌 경로를 거치므로 둘 다 퇴근하지 못합니다. 사람 행과 count 변경은 같은 거래로 커밋해야 합니다. 중간 오류로 하나만 남으면 새로 만든 count 자체가 잘못됩니다.

이 설계는 중복 상태를 유지하는 비용을 받아들입니다. 출근·그룹 이동·관리자 수정도 count와 사람 상태를 함께 바꾸어야 하고, 초기 데이터 및 주기적인 불일치 대사가 필요합니다. 잠금 순서도 모든 경로에서 통일해야 합니다. 단순 공통 락을 얻는 방법이라면 특히 오래된 스냅샷의 COUNT를 그대로 다시 사용하지 않도록 엔진의 읽기 시점까지 확인해야 합니다.

## 직렬화 실패는 새 판단을 요구합니다

직렬화 격리는 결과가 어떤 직렬 실행과 동등하도록 보장하는 계약입니다. DB에 따라 잠금으로 대기시키거나 충돌을 감지해 일부 거래를 중단할 수 있습니다. 실패는 “같은 UPDATE를 다시 보내라”가 아니라 **이번 읽기와 판단 전체를 그대로 확정할 수 없다**는 뜻일 수 있습니다.

```text
for attempt in bounded_attempts:
    try:
        begin new serializable transaction
        current = read_current_duty_state()
        decide_whether_person_can_leave(current)
        write_if_allowed()
        commit
        return result
    catch confirmed_serialization_abort:
        rollback_if_active()
        wait_with_jitter_within_original_deadline()
return retry_limit
```

새 거래에서 B가 다시 읽으면 A는 이미 퇴근했으므로 B의 요청을 거절하는 것이 정상입니다. 처음 계산한 “가능”을 시도 밖에 저장해 재사용하면 안 됩니다. 반대로 논리 요청 ID는 매 시도마다 새로 만들지 않습니다.

커밋 응답 유실은 직렬화 중단이 확인된 경우와 다릅니다. 실제로 커밋됐을 수 있으므로 같은 요청 ID의 결과 조회가 필요합니다. 메일·결제를 재시도 함수 안에서 바로 실행해 놓으면 DB 롤백으로 취소되지 않아 중복될 수 있습니다.

## 대안은 같은 실패 사례로 비교합니다

| 방법 | 보호하는 경계 | 남는 비용 또는 전제 |
| --- | --- | --- |
| 자기 행 버전만 검사 | 같은 행 덮어쓰기 | 집합 규칙은 보호 못 함 |
| 공통 count 조건 갱신 | 그룹의 공통 변경 지점 | 중복 count·모든 경로의 일관성 |
| 관련 집합 잠금 | 판단에 쓰는 집합 | 빈 범위·새 행·엔진별 잠금 범위 |
| 직렬화 격리 | 직렬 실행과 동등한 결과 | 충돌·거래 전체 재시도 |

두 연결을 첫 읽기 직후 멈춰 같은 상태를 보게 만든 뒤 각각 수정하도록 합니다. 스냅샷 격리의 반례에서는 최종 0을, 수정된 구조에서는 최종 1 이상과 한 요청의 거절 또는 재시도를 확인합니다. 단순 성공 건수보다 최종 불변식·거래 오류·재시도 중복을 함께 검사해야 합니다. 실제 DB 버전과 격리 설정별 실험은 별도로 수행해야 합니다.
