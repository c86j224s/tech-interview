---
id: timing-wheel
title: 타이밍 휠의 슬롯·회전 수·실행 예산
topic: 자료구조
summary: 만료 시각을 슬롯에 배치하고 절대 기한을 다시 확인하는 과정을 추적하며 계층형 cascade·취소·만료 집중의 비용을 설명합니다.
questionIds: [timing-wheel-vs-heap, hierarchical-timing-wheel-cascade]
---

# 타이밍 휠의 슬롯·회전 수·실행 예산

타이밍 휠은 시간을 정밀하게 정렬된 목록으로 유지하는 대신, 미래 시각을 시간 구간과 슬롯으로 나누어 만료 후보를 모으는 자료구조입니다. 따라서 슬롯 위치는 “확정된 실행 시각”이 아니라 후보 위치이고, 절대 기한과 현재 시각의 재검사가 정확성을 완성합니다. 이 차이를 놓치면 빠른 삽입은 얻어도 일찍 실행하거나 한 바퀴 뒤 항목을 잃는 오류가 생깁니다.

## 타이머 수와 최솟값 조회 비용

최소 힙은 가장 이른 만료 시각을 루트에 두므로 다음 타이머 조회가 쉽고 삽입·삭제가 O(log n)입니다. 수십만 개 타이머가 있고 수 ms 정도의 시간 해상도를 허용한다면 시간을 슬롯으로 나눈 **타이밍 휠**을 고려할 수 있습니다.

휠은 일정 간격으로 현재 슬롯을 전진시키고 그 슬롯의 항목을 검사합니다. 단순 삽입은 빠를 수 있지만 같은 슬롯에 몰린 타이머 수와 실행 비용이 남으므로 모든 동작이 항상 O(1)이라고 말하면 안 됩니다.

## 만료 시각의 tick 올림과 슬롯 매핑

슬롯 8개, 틱 간격 10ms, 기준 시각 0이라고 합시다. 기한 25ms는 tick 3, 슬롯 3에 둡니다. floor로 tick 2에 두고 20ms에 실행하면 5ms 일찍 실행합니다. **기한보다 이르게 실행하지 않는 계약**이라면 올림 또는 실행 전 절대 기한 검사가 필요합니다.

| 기한 | 목표 tick=ceil(deadline/10) | 슬롯=tick mod 8 | 주의할 것 |
| --- | ---: | ---: | --- |
| 25ms | 3 | 3 | 30ms에 후보 |
| 75ms | 8 | 0 | 첫 바퀴 끝 |
| 105ms | 11 | 3 | 슬롯 3이지만 한 바퀴 뒤 |

25ms와 105ms가 같은 슬롯에 들어갑니다. 슬롯 번호만 저장하면 105ms 타이머가 30ms에 실행될 수 있습니다. 목표 절대 tick이나 남은 회전 수를 함께 저장해야 합니다.

```diagram
{"title":"슬롯이 같아도 목표 회전은 다릅니다","caption":"화살표는 시각을 슬롯으로 매핑하는 관계입니다. 슬롯 3에서 tick 3 타이머만 실행하고 tick 11 타이머는 아직 보관합니다.","rows":[[{"id":"early","label":"기한 25ms","detail":["목표 tick 3"]},{"id":"late","label":"기한 105ms","detail":["목표 tick 11"]}],[{"id":"slot","label":"휠 슬롯 3","detail":["목표 tick과 기한을 다시 검사"]}]],"edges":[{"from":"early","to":"slot","label":"3 mod 8"},{"from":"late","to":"slot","label":"11 mod 8"}]}
```

## 기준 상태를 명시한 처리 모형

상태를 숫자로 추적하면 경계가 보입니다. `processedTick=2`에서 deadline 25ms를 등록하면 `targetTick=3`이고 슬롯 3에 들어갑니다. `advance(25ms)`는 `floorTick=2`만 처리하므로 아직 ready가 되지 않으며, `advance(30ms)`에서 tick 3을 처리할 때 기한 검사를 통과해 ready 큐로 이동합니다. 반대로 tick 11의 105ms 항목이 같은 슬롯에 있어도 `targetTick > processedTick` 검사에서 남습니다.

아래에서 processedTick은 이미 처리한 마지막 tick이고, 단일 소유 실행기가 등록·틱 전진·취소를 직렬화한다고 가정합니다. 시간은 단조 시계입니다.

```text
register(deadline, callback):
    target = max(processedTick+1, ceilTick(deadline))
    timer = Timer(uniqueGeneration(), target, deadline, callback, pending)
    slots[target mod slotCount].append(timer)
    return timer.handle

advance(now):
    lastDueTick = floorTick(now)
    while processedTick < lastDueTick:
        processedTick += 1
        bucket = slots[processedTick mod slotCount]
        for timer in snapshot_of_existing_entries(bucket):
            if timer.targetTick > processedTick: continue
            if timer.deadline > now: continue
            if transition(timer, pending, ready):
                remove_from_bucket(timer)
                readyQueue.push(timer)
```

`advance(25ms)`에서는 `floorTick(now)=2`이므로 표의 25ms 타이머는 target tick 3에 남아 있고, 기한보다 일찍 실행되지 않습니다. 다음 `advance(30ms)`에서 tick 3을 처리할 때 `deadline <= now`인지 다시 확인한 뒤 ready 큐로 옮깁니다. 같은 버킷을 순회하는 동안 콜백이 새 타이머를 끼워 넣지 않도록 콜백 실행은 이 큐에서 별도로 진행합니다. 지나간 기한을 등록하면 다음 처리 기회로 보낸다는 정책이며 즉시 실행 계약은 아니므로, 반올림·정수 범위·기준 시각 재설정도 함께 검사해야 합니다.

## 계층형 휠의 원거리 타이머 보관과 cascade

하위 8슬롯이 각각 10ms이면 한 바퀴는 80ms입니다. 상위 휠의 슬롯 하나가 80ms를 대표하도록 만들면 먼 타이머를 매 하위 회전마다 검사하지 않을 수 있습니다. 목표 105ms는 상위의 80~160ms 범위에 두었다가 하위 시간이 80ms 경계로 전진할 때 절대 기한으로 다시 계산해 하위 슬롯에 옮깁니다. 이를 **cascade**라고 합니다.

상위 슬롯에 들어 있다는 이유로 그 경계에서 콜백을 실행하는 것이 아닙니다. 더 세밀한 하위 구조로 내려보낼 뿐입니다. 이동할 때 원본 deadline을 보존하고, 이미 지난 타이머는 ready 경로로 보내며, 이동과 취소가 같은 소유 상태를 보도록 해야 합니다. 여러 계층이 같은 경계에서 cascade되면 이동량이 집중될 수 있습니다.

## 취소의 자료구조 제거와 실행 중단 경계

pending 타이머를 취소하면 목록에서 지우거나 취소 표식을 둘 수 있습니다. 핸들→노드 참조가 있으면 빠른 제거가 가능하지만 노드 수명·세대 검사가 필요합니다. 주소 재사용만으로 옛 취소가 새 타이머를 지우지 않게 합니다.

ready 큐로 옮겨진 뒤 취소하는 경우 실행기가 콜백 시작 전 상태를 다시 확인해야 합니다. 이미 실행 중인 콜백은 타이머 목록에서 지운다고 중단되지 않습니다. 취소 성공의 의미를 “콜백 미시작 보장”인지 “중단 요청 접수”인지 정의합니다.

## 만료 집중과 휠의 실행 비용 한계

운영 장애를 볼 때는 “슬롯 조회가 빠른가”보다 `등록 수 → 같은 tick 후보 수 → ready 이동 수 → 콜백 실행 시간 → 다음 tick 지연`을 순서대로 관찰합니다. 정지 후 재개에서 마지막 슬롯만 확인해 누락된다면 처리되지 않은 절대 기한 목록과 회전 수를 대조해야 합니다. 실행 예산을 두는 선택은 지연을 분산시키는 대신 만료 지연을 허용하는 계약이므로, 핵심 기한 작업에는 별도 경로가 필요한지 먼저 결정합니다.

타이머 백만 개가 같은 틱에 만료되면 그 항목을 찾아 실행하는 데 최소 그 개수만큼 일이 듭니다. 콜백을 오래 실행하면 다음 tick까지 밀립니다. 지연 상한과 공정성을 위해 ready 실행 개수·시간 예산을 두되, 지연을 허용하지 못하는 핵심 타이머와 느슨한 주기 작업을 구분합니다.

| 구조 | 장점 | 비용 |
| --- | --- | --- |
| 최소 힙 | 정밀한 다음 만료 조회 | O(log n) 갱신·지연 삭제 |
| 단일 휠 | 단순 버킷 삽입 | 해상도·회전 검사·버킷 집중 |
| 계층형 휠 | 긴 기간 타이머 효율 | cascade·경계·취소 복잡성 |

프로세스가 한동안 멈춘 뒤 모든 지나간 tick을 하나씩 처리하면 회복이 오래 걸릴 수 있습니다. 절대 목표 시각을 이용해 만료 항목을 모으거나 계층을 건너뛰는 최적화는 가능하지만, 단순히 마지막 슬롯만 확인하면 중간 타이머를 잃습니다. 경계 직전·직후, 여러 바퀴, 정지 후 재개, 취소와 cascade 경쟁을 실제 실행 결과·지연 분포와 대조해야 합니다.
