---
id: stack-queue
title: 스택·원형 큐와 실행 순서의 경계
topic: 자료구조
summary: undo·redo의 분기와 원형 큐의 head·tail·count를 추적하고 자료구조 인출 순서가 실제 완료를 보장하지 않는 이유를 설명합니다.
questionIds: [stack-queue-traversal, undo-redo-branch-history]
---

# 스택·원형 큐와 실행 순서의 경계

## 최근 변경부터 되돌리고 먼저 온 작업부터 꺼냅니다

A·B·C 순서로 편집한 문서를 한 단계 되돌리려면 마지막 C의 변경부터 취소하는 것이 자연스럽습니다. 스택은 마지막에 넣은 것을 먼저 꺼내는 **LIFO**를 표현합니다. 반면 접수한 작업 A·B·C를 그 순서로 배정하려면 먼저 넣은 것을 먼저 꺼내는 **FIFO 큐**가 맞습니다.

이는 인출 규칙입니다. A를 워커 1에, B를 워커 2에 주면 B가 먼저 끝날 수 있습니다. FIFO 구조를 선택하는 것과 외부 상태를 순서대로 변경하는 것은 별도의 설계입니다.

## undo에는 복구할 정보가 있어야 합니다

문자열에 A, B, C를 붙여 `ABC`를 만들었다고 합시다. 단순 동작 이름만 저장하지 않고 이전 상태·삽입 위치·삭제 내용 또는 정확한 역연산을 남겨야 복구할 수 있습니다.

| 동작 | 현재 문자열 | undo 스택 | redo 스택 |
| --- | --- | --- | --- |
| A,B,C 실행 | ABC | [A,B,C] | [] |
| undo | AB | [A,B] | [C] |
| undo | A | [A] | [C,B] |
| redo | AB | [A,B] | [C] |
| 새 X 실행 | ABX | [A,B,X] | [] |

마지막에 redo의 C를 지우는 것은 새 분기로 이동했기 때문입니다. 예전 C를 무조건 재실행하면 새 편집의 위치·내용에 맞지 않을 수 있습니다. 분기 이력을 보존하는 제품은 두 스택 대신 이력 트리 등 다른 모델이 필요합니다.

```diagram
{"title":"되돌린 뒤 새 편집은 다른 분기입니다","caption":"화살표는 편집 이력의 전이입니다. 단순 두 스택 정책에서는 AB에서 X를 실행할 때 예전 C의 redo 경로를 버립니다.","rows":[[{"id":"ab","label":"AB 상태"}],[{"id":"abc","label":"예전 ABC","detail":["redo 후보 C"]},{"id":"abx","label":"새 ABX","detail":["새 편집 X"]}]],"edges":[{"from":"ab","to":"abc","label":"예전 분기"},{"from":"ab","to":"abx","label":"새 분기 선택"}]}
```

## 상태와 이력은 함께 전환합니다

```text
execute(command):
    nextState, undoData = prepareChange(currentState, command)
    atomically_publish(currentState=nextState,
                       undo=undo+[undoData], redo=[])

undoOnce():
    if undo.empty(): return no_change
    previousState, redoData = prepareUndo(currentState, undo.last)
    atomically_publish(currentState=previousState,
                       undo=undo.withoutLast, redo=redo+[redoData])
```

여기서 atomically_publish는 메모리 단일 소유자·잠금·DB 거래 등 실제 저장 경계에 맞게 구현해야 합니다. 이전 상태로 바꾸기 전에 스택에서 항목을 제거했다가 복구에 실패하면 이력과 현재 상태가 어긋납니다. 동시에 다른 편집이 들어온다면 기준 버전도 검사해야 합니다.

메일 발송이나 결제는 문자열 편집처럼 과거를 지우는 역연산이 없습니다. 환불·정정 같은 새 보정 작업을 기록해야 하며, 스택 pop만으로 외부 효과가 사라지지 않습니다. 긴 이력은 메모리를 차지하므로 snapshot·명령 병합·보관 범위도 정합니다.

## 배열 큐의 앞 삭제를 매번 당기지 않습니다

배열의 첫 칸을 지우고 나머지를 이동하면 dequeue가 O(n)입니다. 고정 크기 배열을 원처럼 쓰고 head·tail을 순환시키면 원소를 당기지 않습니다. 다음은 count를 따로 두어 빈 상태와 포화를 구분하는 단일 스레드 모형입니다.

```text
push(value):
    if count == capacity: return full
    buffer[tail] = value
    tail = (tail+1) mod capacity
    count += 1

pop():
    if count == 0: return empty
    value = buffer[head]
    clear_owned_reference(buffer[head])
    head = (head+1) mod capacity
    count -= 1
    return value
```

capacity는 양수입니다. count 방식에서는 head=tail이 빈 상태와 가득 찬 상태 모두에서 가능하므로 count를 함께 봅니다. 슬롯 하나를 비워 두는 다른 방식은 유효 용량이 배열 길이보다 하나 작아집니다. 두 규칙을 섞지 않습니다.

용량 3에서 A,B,C를 넣으면 head=0,tail=0,count=3입니다. A를 꺼내면 head=1,count=2이고 D를 넣으면 buffer[0]=D,tail=1,count=3입니다. 논리 인출 순서는 여전히 B,C,D입니다. 물리 배열 순서 D,B,C와 다릅니다.

## 포화·취소·병렬 실행은 추가 계약입니다

큐가 가득 찼다면 즉시 거절·생산자 대기·오래된 항목 폐기 중 무엇을 할지 정합니다. 서로 다른 의미의 작업을 몰래 버리면 안 됩니다. 대기 중 취소는 항목 제거·무효 표식으로 다룰 수 있지만 이미 실행 중인 작업을 멈추지는 못합니다.

여러 스레드가 접근하면 값 저장과 인덱스 공개의 순서도 보호해야 합니다. 단순 모듈러 연산만으로 lock-free 큐가 되는 것은 아닙니다. 접수 순서대로 효과를 적용해야 한다면 키별 직렬 실행이나 완료 재정렬·저장소 버전 조건이 필요합니다.

검사는 빈 pop·포화 push·여러 번 wrap·참조 제거·undo 실패·새 분기·병렬 완료 역전을 포함합니다. 원형 큐는 기준 목록과 인출 결과를, undo는 상태와 양쪽 스택을 함께 대조해야 합니다.
