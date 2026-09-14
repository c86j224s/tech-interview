---
id: go-request-lifetime
title: Go 요청의 Context·Errgroup·Defer 수명
topic: 언어·런타임
summary: 필수 의존성과 요청 문맥을 나누고 errgroup 취소·활성 상한·Wait 완료·defer의 함수 범위·정리 오류를 설명합니다.
questionIds: [go-context-values, go-errgroup-limit, go-defer-loop-lifetime]
---

# Go 요청의 Context·Errgroup·Defer 수명

## Context에 넣으면 함수 인자가 사라져도 의존성은 남습니다

DB·설정·사용자·큰 요청 본문을 모두 context에 넣으면 함수 서명은 짧아집니다. 하지만 어떤 값이 필수인지 호출자가 알기 어렵고 테스트·배치 진입점에서 값이 빠질 수 있습니다. context는 취소·deadline과 요청 범위 메타데이터를 전달하는 수단이지 모든 의존성을 숨기는 저장소가 아닙니다.

저장소·필수 설정은 명시적인 인자나 객체 의존성으로 둡니다. 요청 ID·검증된 주체 같은 문맥 값은 충돌을 피하는 비공개 키 타입과 안전한 accessor로 다루고 누락·타입 오류를 명시합니다. 문맥에 가변 포인터를 넣었다고 요청별 복사나 동기화가 생기지는 않습니다.

## 취소를 전달하는 것과 관찰하는 것은 다릅니다

하위 함수에 ctx를 넘겨도 그 함수가 I/O·채널·반복 경계에서 취소를 관찰해야 종료됩니다. 편의상 context.Background로 바꾸면 상위 deadline을 잃을 수 있습니다. 요청 뒤에도 반드시 지속할 작업은 임의 goroutine을 남기기보다 별도 내구 작업과 소유자·기한으로 분리합니다.

context를 장수 객체에 저장하면 그 안의 큰 값·토큰·사용자 정보 수명이 늘어날 수 있습니다. 원문 자격과 큰 payload를 불필요하게 넣지 않습니다. 자식 context를 만든 소유자는 적절한 시점에 cancel을 호출해 관련 자원을 정리합니다.

## Errgroup은 첫 오류를 알리되 모든 함수의 종료를 기다립니다

`errgroup.WithContext`는 첫 non-nil 오류에 파생 context 취소를 연결하고, Wait는 등록된 함수들이 반환할 때까지 기다린 뒤 오류를 반환합니다. 오류가 났다고 다른 함수가 강제 중단되는 것이 아닙니다. 파생 context는 Wait가 반환할 때도 취소되므로 그룹 성공 뒤 후속 작업의 장기 context로 무심코 재사용하지 않습니다.

| 책임 | errgroup이 제공하는 부분 | 남는 설계 |
| --- | --- | --- |
| 완료 집계 | Wait로 함수 반환 확인 | 취소 무시 작업의 기한 |
| 오류 | 첫 non-nil 오류 반환 | 필수·선택 결과 정책 |
| 동시 실행 | SetLimit 등의 활성 수 제한 | 입력 목록·제출 대기자 상한 |
| 결과 | 함수 실행 | 공유 map·slice의 동기화 |

추천 API는 선택적이고 계정 API는 필수라면 추천 실패를 명시적인 부분 결과로 기록하고 필수 실패만 그룹 오류로 처리할 수 있습니다. 모든 오류를 빈 성공값으로 숨기면 장애를 정상 데이터 부재로 오인하므로 결과 상태를 구분합니다.

## SetLimit 앞에도 대기자가 생길 수 있습니다

SetLimit에 도달하면 Group.Go 호출 자체가 활성 자리를 기다릴 수 있습니다. goroutine 안에서 무한히 Group.Go를 호출하거나 모든 입력을 미리 메모리에 만들면 활성 수만 제한하고 대기·입력 메모리는 제한하지 못합니다. 취소 가능한 제출·bounded 입력·TryGo 거절 또는 별도 worker pool 등 실제 계약에 맞는 구조를 선택합니다.

활성 작업이 자기 그룹에 자식 작업을 넣고 기다리는 구조도 한도에 따라 교착할 수 있습니다. 실행 중 limit을 바꾸는 것도 라이브러리 계약을 확인합니다. 결과 배열은 미리 크기를 정하고 각 worker가 독립 인덱스를 담당할 수 있지만 동시에 append하면 slice 헤더·저장소가 경쟁합니다. 루프 캡처는 Go 버전과 := 선언·기존 변수 대입을 구분합니다.

```diagram
{"title":"작업 제출과 실행과 정리는 각각 상한이 필요합니다","caption":"화살표는 요청 수명입니다. 활성 고루틴 수 제한만으로 제출을 기다리는 요청과 입력 데이터가 자동 제한되지는 않습니다.","rows":[[{"id":"input","label":"제한된 입력·제출 대기"}],[{"id":"group","label":"errgroup 활성 작업","detail":["ctx를 실제 대기에 전달"]}],[{"id":"wait","label":"Wait로 실제 반환 확인"}],[{"id":"cleanup","label":"자원 정리·결과 확정"}]],"edges":[{"from":"input","to":"group","label":"상한 안 수락"},{"from":"group","to":"wait","label":"성공·실패·취소"},{"from":"wait","to":"cleanup","label":"남은 책임 종료"}]}
```

## Defer는 루프 한 번이 아니라 현재 함수가 끝날 때 실행됩니다

긴 함수의 루프에서 파일을 열 때마다 defer Close를 등록하면 함수 반환 전까지 열린 파일이 쌓일 수 있습니다. 반복별 짧은 helper 함수에서 open·defer·처리를 묶거나 필요한 시점에 명시적으로 닫습니다. open 오류를 먼저 검사하고 유효한 자원에만 정리를 등록합니다.

```go
func processOne(path string) (err error) {
    f, err := os.Open(path)
    if err != nil { return err }
    defer func() {
        if closeErr := f.Close(); err == nil {
            err = closeErr
        }
    }()
    return consume(f)
}
```

os와 consume의 실제 구현은 호출 환경에서 제공합니다. 이 예제는 주 오류가 있으면 그것을 유지하고, 주 오류가 없을 때 close 오류를 반환하는 정책입니다. 두 오류를 모두 보고해야 하면 지원 버전의 errors.Join 등 명시적 결합을 사용합니다. 저장 작업의 close·flush·내구 성공 의미는 별도 계약입니다.

defer의 함수 값과 인자는 등록 시 평가되지만 closure가 나중에 읽는 변수는 다를 수 있습니다. 여러 defer는 역순으로 실행됩니다. 정상 반환과 같은 goroutine의 panic 전파에는 정리가 일어날 수 있지만 os.Exit·프로세스 강제 종료에서 같은 보장을 기대하지 않습니다. defer로 잠금을 풀더라도 함수가 너무 길면 임계 구역도 길어집니다.

## 취소·누락값·정리 오류를 따로 주입합니다

값 없는 context로 helper를 호출해 명확한 오류가 나오는지, 첫 자식 오류가 다른 자식에게 전달되는지, 취소를 무시한 자식 때문에 Wait가 기다리는지 확인합니다. 제출 상한에서 부모가 취소되는 상황도 포함합니다.

루프의 많은 파일·중간 반환·읽기 오류·close 오류를 넣고 최대 열린 자원이 제한되는지 측정합니다. 이 노트는 Go 표준 기능과 errgroup의 수명 설계이며 실제 외부 API·파일 장애·선택한 errgroup 버전의 통합 실행 결과는 아닙니다.
