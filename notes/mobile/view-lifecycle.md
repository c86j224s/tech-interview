---
id: view-lifecycle
title: iOS 화면 재등장과 작업 수명
topic: 모바일
summary: 뷰 로드·appearance·해제를 구분하고 반복 갱신·관찰자·비동기 요청 세대와 화면 밖 작업 정책을 설명합니다.
questionIds: [ios-view-lifecycle, ios-navigation-view-retention, ios-hidden-screen-work-policy]
---

# iOS 화면 재등장과 작업 수명

## 화면으로 돌아오는 것은 새 뷰를 만드는 것과 다릅니다

프로필 화면에서 다른 화면으로 이동했다가 돌아왔는데 `viewDidLoad`의 조회가 다시 실행되지 않는다고 합시다. 이전 뷰가 메모리에 남아 재사용됐다면 정상입니다. 뷰 계층을 로드하는 사건, 화면에 나타나는 사건, 객체가 해제되는 사건은 다릅니다.

초기 버튼 연결·정적 제약·서브뷰 구성은 로드 시점, 최신 데이터 표현은 재등장 시점, 실제 표시 후 안내·애니메이션은 전환 완료 시점에 맞추어 배치합니다. 메서드 이름보다 반복 실행과 소유 수명의 계약을 이해해야 합니다.

## 각 시점에 맡길 책임을 정합니다

| 시점 | 대표 책임 | 흔한 오해 |
| --- | --- | --- |
| viewDidLoad | 로드된 뷰의 초기 구성 | 앱 전체에서 반드시 한 번뿐 |
| viewWillAppear | 현재 상태로 표시 준비 | 매번 서브뷰·관찰자를 추가해도 됨 |
| viewDidAppear | appearance 전환 완료 후 동작 | 여기서 모든 네트워크를 시작해야 함 |
| 사라짐·해제 | 화면 전용 작업 정리 | 사라지면 객체도 반드시 해제됨 |

navigation stack·tab·modal의 유지와 가림은 다릅니다. presentation 방식이나 사용자 전환 취소에 따라 appearance 전달도 달라질 수 있으므로 모든 컨테이너에서 하나의 고정 로그 순서를 가정하지 않습니다. 객체 ID·뷰 로드·appearance·deinit을 함께 기록해 실제 재사용을 확인합니다.

```diagram
{"title":"뷰는 남고 표시만 반복될 수 있습니다","caption":"화살표는 가능한 수명 흐름입니다. 다시 나타나는 경로는 기존 뷰를 재사용하므로 초기 로드가 반복될 필요가 없습니다.","rows":[[{"id":"load","label":"뷰 로드·초기 구성"}],[{"id":"appear","label":"표시 준비·등장","detail":["최신 상태 반영"]}],[{"id":"hidden","label":"화면 밖·뷰 보존","detail":["화면 전용 작업 정리"]}]],"edges":[{"from":"load","to":"appear","label":"첫 등장"},{"from":"appear","to":"hidden","label":"다른 화면으로"},{"from":"hidden","to":"appear","label":"기존 화면 재등장"}]}
```

## 반복 갱신은 누적이 아니라 동기화로 만듭니다

매번 나타날 때 모델 배열에 같은 데이터를 append하거나 옵저버를 추가하면 화면이 중복됩니다. 현재 저장소 snapshot으로 모델을 교체하고, 이미 관찰 중인지 토큰을 관리하며, 필요하지 않게 된 구독을 해제해야 합니다.

```text
onAppear:
    mark_screen_active()
    ensure_one_observation_subscription()
    render(current_store_snapshot())
    generation += 1
    start_refresh(capturedGeneration=generation)

onRefreshResult(result, capturedGeneration):
    run_on_UI_executor:
        if not active or capturedGeneration != generation: return
        render(result)

onDisappear:
    mark_screen_inactive()
    generation += 1
    cancel_screen_only_refresh()
    end_screen_only_observation()
```

이것은 Swift 문법이 아니라 상태 전이 모형입니다. UI 상태 검사와 적용은 같은 UI executor에서 수행해야 검사 직후 새 요청이 끼어드는 경쟁을 피합니다. 취소 요청이 성공해도 늦은 완료가 올 수 있으므로 요청 세대를 따로 검사합니다. 세대 검사는 해제된 메모리를 안전하게 접근하게 만드는 장치는 아닙니다.

## 모든 작업을 화면과 함께 취소하지는 않습니다

검색 자동완성·화면 애니메이션은 화면이 사라지면 필요가 없어질 수 있습니다. 여러 화면에서 재사용할 다운로드는 서비스가 소유하며 화면은 진행을 관찰할 수 있습니다. 결제·업로드처럼 이미 외부 효과가 시작된 작업은 화면 종료만으로 취소됐다고 보고하지 않습니다.

화면 밖 작업의 결과는 공용 저장소가 보존하고, 재등장한 화면은 현재 상태를 다시 읽습니다. Notification만 기다리면 사라져 있던 동안의 사건을 놓칠 수 있습니다. 공유 작업 하나를 첫 화면의 취소에 연결해 다른 화면까지 실패시키지 않도록 소유자를 분리합니다.

## 레이아웃 완료와 등장 완료도 같지 않습니다

Auto Layout의 frame은 계산 결과입니다. viewDidLoad에서 읽은 크기가 최종 화면 크기라고 가정하지 않습니다. 필요한 제약을 바꾸고 적절한 레이아웃 시점이나 `layoutIfNeeded()`로 계산한 뒤 관찰합니다. 반복 레이아웃 콜백에서 무조건 네트워크 요청을 시작하면 크기 변경마다 요청이 중복될 수 있습니다.

애니메이션 모델 상태와 화면에 실제 보이는 presentation 상태도 다릅니다. 측정 목적이 최종 배치인지 현재 표시인지 정해야 합니다. 화면 가시성 지표는 앱·씬 활성 상태와 가림까지 고려해야 단순 appearance 횟수를 사용자 체류 시간으로 오해하지 않습니다.

## 전환과 늦은 결과를 함께 시험합니다

push·pop·tab·modal·전환 취소를 반복하고 서브뷰·옵저버·타이머 수가 늘지 않는지 확인합니다. 느린 이전 조회와 빠른 새 조회를 역순 완료시켜 옛 결과가 화면을 덮지 않는지도 봅니다. 화면이 해제된 뒤 완료가 와도 공용 작업의 결과·임시 파일 정리가 누락되지 않아야 합니다.

이 노트는 생명주기 설계 지침이며 실제 UIKit 버전·컨테이너 조합에서 콜백을 실행해 확인한 결과는 아닙니다. 테스트 환경에서 객체 ID와 시점을 기록하고 API 계약과 실제 로그를 함께 대조해야 합니다.
