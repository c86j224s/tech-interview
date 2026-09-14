---
id: go-map-state
title: Go Map의 동시 접근과 복합 상태 변경
topic: 언어·런타임
summary: 서로 다른 키의 내부 구조 공유와 mutex·owner goroutine·불변 map·sync.Map의 연산별 원자 경계를 설명합니다.
questionIds: [go-map-concurrent-access]
---

# Go Map의 동시 접근과 복합 상태 변경

## 서로 다른 키도 같은 내부 저장 구조를 사용합니다

goroutine A가 사용자 1을 갱신하고 B가 사용자 2를 갱신하므로 잠금이 필요 없다고 생각하기 쉽습니다. 하지만 일반 map은 bucket·확장·내부 메타데이터를 공유합니다. 키가 다르다는 업무 조건이 자료구조 내부의 동시 쓰기 안전성을 보장하지 않습니다. 동시 읽기·쓰기 역시 적절한 동기화가 필요합니다.

런타임이 concurrent map 오류를 탐지할 수 있어도 항상 탐지된다는 보장은 아닙니다. fatal 메시지가 없거나 한 번의 테스트가 통과했다고 안전한 사용이 되는 것은 아닙니다.

## 불변식 전체를 같은 잠금으로 보호합니다

```go
type Counter struct {
    mu sync.Mutex
    values map[string]int
}
func (c *Counter) Add(key string, delta int) int {
    c.mu.Lock()
    defer c.mu.Unlock()
    c.values[key] += delta // values는 생성 시 make로 준비
    return c.values[key]
}
```

값 읽기·계산·쓰기를 같은 임계 구역에 둡니다. map 읽기만 RLock하고 나서 map에 저장된 포인터의 필드를 바꾸면 그 대상 필드를 제대로 보호하지 못할 수 있습니다. 다른 API가 raw map이나 가변 value 참조를 반환해 잠금 밖에서 변경하게 하지 않습니다.

| 구조 | 장점 | 별도 비용·조건 |
| --- | --- | --- |
| Mutex·RWMutex | 복합 불변식 표현이 직접적 | 경합·긴 임계 구역 |
| owner goroutine | 명령 순서·상태 소유 명확 | bounded 큐·종료·두 owner 조정 |
| 불변 map snapshot | 읽기 경로 단순화 | 복사·깊은 불변·게시·다중 writer |
| sync.Map | 특정 동시 접근 패턴에 적합 | 연산별 계약·복합 변경·Range 한계 |

## Sync.Map도 Load 다음 Store를 하나로 만들지는 않습니다

두 goroutine이 Load에서 없음으로 보고 각각 생성·Store하면 중복 생성이 일어납니다. LoadOrStore·지원되는 CAS 연산이나 별도 잠금으로 필요한 경계를 표현해야 합니다. LoadOrStore 호출 인자를 만들기 위해 비싼 생성 함수를 먼저 실행했다면 저장은 하나여도 생성 부수 효과는 이미 두 번일 수 있습니다.

```diagram
{"title":"개별 연산의 안전성과 전체 변경의 원자성을 나눕니다","caption":"화살표는 경쟁 가능한 실행 단계입니다. 두 Load가 모두 없음이어도 하나의 원자 선택 경계에서 승자를 정해야 하며 생성 부수 효과는 별도입니다.","rows":[[{"id":"a","label":"A Load · 없음"},{"id":"b","label":"B Load · 없음"}],[{"id":"choose","label":"LoadOrStore 또는 잠금","detail":["하나의 저장 결과 선택"]}],[{"id":"effect","label":"생성 부수 효과는 별도 관리"}]],"edges":[{"from":"a","to":"choose","label":"후보 A"},{"from":"b","to":"choose","label":"후보 B"},{"from":"choose","to":"effect","label":"저장 원자성의 범위"}]}
```

sync.Map의 Range를 전체 map의 단일 시점 snapshot으로 가정하지 않습니다. 여러 키 합계·이체·용량 제한 같은 불변식은 더 넓은 동기화가 필요합니다. 지원 메서드와 비교 가능한 값의 조건도 실제 Go 버전에 맞게 확인합니다.

## 불변 Snapshot도 깊은 불변과 안전한 게시가 필요합니다

새 map을 완전히 만든 뒤 atomic.Value나 적절한 atomic pointer·잠금으로 루트를 게시하고 이후 수정하지 않는 방식은 읽기에 적합할 수 있습니다. map 내부의 slice·포인터가 여전히 공유 가변 객체를 가리키면 전체 snapshot은 불변이 아닙니다. 독자는 같은 루트를 한 번 얻어 관련 필드를 읽습니다.

여러 writer가 같은 옛 snapshot을 복사하고 각각 store하면 앞 변경이 사라질 수 있습니다. writer 직렬화 또는 CAS 실패 후 최신 상태에서 재계산하는 계약이 필요합니다. 샤딩도 키별 경합을 줄일 뿐 여러 샤드에 걸친 원자성을 자동 제공하지 않습니다. 잠금 순서·공통 조정 경계를 정합니다.

## Race Detector와 논리 경쟁 시험을 함께 사용합니다

동시 갱신·조회·삭제를 `go test -race`로 검사하고, 두 worker가 없음 조회를 동시에 마치도록 장벽을 둬 중복 생성·불변식 위반을 확인합니다. 원자 연산만 사용해 data race가 없어도 lost update·중복 부수 효과가 생길 수 있습니다.

읽기·쓰기 비율·map 크기·키 분포·다중 키 작업을 고정해 선택 구조를 비교합니다. 이 노트는 안전한 상태 관리 설명이며 실제 운영 map의 성능 측정이나 모든 동시성 경로를 검증한 결과는 아닙니다.
