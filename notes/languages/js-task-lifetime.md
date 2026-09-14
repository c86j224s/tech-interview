---
id: js-task-lifetime
title: 화면 수명의 Listener·Fetch·취소된 결과
topic: 언어·런타임
summary: 등록·해제의 함수 정체성과 요청 세대를 연결하고 AbortSignal 공유·헤더와 본문 완료·서버 커밋·부분 결과의 차이를 설명합니다.
questionIds: [js-event-listener-cleanup, js-abortcontroller-lifetime, shared-abortsignal-completed-results]
---

# 화면 수명의 Listener·Fetch·취소된 결과

## 화면을 지워도 Window가 callback을 붙잡을 수 있습니다

화면을 열 때마다 window에 resize listener를 등록하고 닫을 때 DOM만 제거했다고 합시다. window는 여전히 callback을 참조하고 callback의 closure는 화면 상태를 참조할 수 있습니다. 화면을 여러 번 열면 이벤트 한 번에 여러 callback이 실행되고 필요 없는 객체도 남을 수 있습니다.

모든 listener가 반드시 누수라는 뜻은 아닙니다. 도달할 수 없는 DOM과 callback만 서로 참조한다면 GC 대상이 될 수 있습니다. 중요한 것은 window·timer·외부 구독 같은 장수 root에서 더 이상 필요 없는 상태로 이어지는 경로입니다.

## 등록하는 소유자가 해제도 보관합니다

removeEventListener에는 이벤트 종류·같은 함수 참조·capture 조건을 맞춥니다. 같은 소스의 새 화살표나 새 bind 함수는 다른 객체입니다. 등록 때 만든 참조를 보관하거나 지원되는 이벤트 API에서 AbortSignal을 사용합니다.

```js
function mountPanel(target, render) {
  const controller = new AbortController();
  const onResize = () => render();
  target.addEventListener('resize', onResize, { signal: controller.signal });
  const timer = setInterval(render, 1000);
  return () => {
    controller.abort();
    clearInterval(timer);
  };
}
```

AbortSignal에 묶은 listener는 정리되지만 timer는 별도라 직접 정리했습니다. 구독 해제 함수·Worker·관찰자도 각각 소유 범위에 포함합니다. once는 이벤트 한 번 이후 해제에 유용하지만 이벤트가 오지 않은 채 화면이 닫히는 경우까지 대신하지 않습니다. 루트 이벤트 위임도 루트 listener의 종료 수명과 대상 범위 검사는 필요합니다.

## Abort는 지원 API의 중단 신호이지 거래 롤백이 아닙니다

클라이언트가 주문 POST를 abort하기 직전에 서버가 DB를 커밋했다면 주문은 남습니다. 클라이언트 fetch 거절은 서버의 변경 취소 증명이 아닙니다. 논리 요청 ID를 유지하고 결과 조회·멱등 재시도로 불확실성을 복구해야 합니다.

| 시점 | abort 뒤 가능한 상태 | 호출자 책임 |
| --- | --- | --- |
| fetch 시작 전 | 이미 abort된 signal로 시작 실패 | 새 작업에는 새 controller |
| 헤더 수신 전 | fetch Promise 거절 | 오류·취소 분류 |
| 헤더 수신 후 본문 읽는 중 | Response는 받았지만 body 소비 실패 가능 | 단계별 완료 추적 |
| 본문·후속 결과 완료 | 이미 받은 결과가 사라지지 않음 | 현재 화면에 적용할지 결정 |
| 서버 변경 커밋 후 | 서버 효과 유지 가능 | 결과 조회·취소 API의 별도 계약 |

controller는 abort한 뒤 초기 상태로 되돌아가지 않습니다. 새로운 요청 수명에는 새 controller를 만듭니다. signal을 전달하지 않았거나 관찰하지 않는 후속 CPU 계산·캐시 작업까지 자동 중단되지 않습니다.

## 공유 신호는 같은 수명의 작업끼리 묶습니다

A·B fetch가 한 signal을 공유할 때 A가 본문까지 끝나고 B만 진행 중이면 abort가 A의 완료 데이터나 외부 효과를 지우지 않습니다. A 결과를 보존할지 전체 화면 계약상 폐기할지는 앱이 정합니다. Promise.all 거절만 보면 이미 성공한 하위 결과가 무엇인지 알기 어려울 수 있어 작업별 상태를 기록하거나 allSettled 등 필요한 집계를 사용합니다.

서로 다른 화면이나 다른 사용자의 작업에 controller를 공유하면 한 종료가 다른 작업을 끊을 수 있습니다. 취소 신호의 범위는 편리한 전역 변수보다 실제 소유·수명에 맞춰야 합니다.

```diagram
{"title":"사용자 종료와 실제 작업의 상태를 따로 추적합니다","caption":"화살표는 종료 신호와 결과 적용 검사입니다. 이미 완료한 A는 되돌리지 않고 아직 진행 중인 B에만 지원되는 중단을 요청합니다.","rows":[[{"id":"close","label":"화면 세대 종료·abort"}],[{"id":"a","label":"A 결과 이미 완료"},{"id":"b","label":"B 본문 아직 진행 중"}],[{"id":"apply","label":"현재 세대에만 결과 적용"}]],"edges":[{"from":"close","to":"a","label":"완료 데이터 유지 가능"},{"from":"close","to":"b","label":"중단 요청"},{"from":"a","to":"apply","label":"보존·폐기 정책"},{"from":"b","to":"apply","label":"늦은 결과 거절"}]}
```

## 늦은 결과는 취소와 별도로 막습니다

검색 A를 시작한 뒤 B로 바꿨다고 합시다. A를 abort했어도 취소를 지원하지 않는 변환이 끝날 수 있으므로 결과 적용 직전에 현재 세대와 비교합니다. `if (requestId !== currentRequestId) return`은 UI 역행을 막는 논리 검사입니다. 객체가 살아 있다는 것과 현재 화면에 쓰는 권한을 구분하는 것입니다.

단일 JavaScript 실행 흐름이어도 await 사이에 다른 요청이 상태를 바꿀 수 있습니다. 비교와 동기적인 상태 적용을 같은 실행 단계에 두고, 그 사이 또 await하면 다시 전제를 확인해야 합니다. 종료된 화면에 오류 알림을 보내는 경로도 같은 세대 규칙을 적용합니다.

## 반복 화면 전환과 응답 단계별 취소를 시험합니다

mount·unmount를 반복한 뒤 이벤트 한 번의 callback 수와 활성 timer·구독 수를 확인합니다. heap snapshot의 retained path로 장수 root를 찾아 정상 캐시와 불필요한 참조를 구분합니다. 즉시 GC 실행이나 메모리 수치 한 번만으로 누수 유무를 확정하지 않습니다.

테스트 서버에서 헤더 전·본문 중·커밋 후 응답 유실을 따로 제어하고, 취소 뒤 새 화면 결과가 덮이지 않는지 확인합니다. 이 노트는 소유·취소 설계이며 실제 주문 서버의 롤백 동작이나 전체 누수 실험을 수행한 결과는 아닙니다.
