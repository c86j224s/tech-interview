---
id: api-meaning
title: API 혼합 버전·Patch Presence·Protobuf 번호
topic: 설계
summary: 파싱과 행동 호환·unknown enum·null/생략/빈 값·생성 기본값·field reservation·JSON gateway·오래된 소비자와 rollback을 설명합니다.
questionIds: [api-backward-compatibility, api-null-omission-patch, protobuf-field-number-reservation]
---

# API 혼합 버전·Patch Presence·Protobuf 번호

## 필드 추가와 상태 의미 추가는 다른 변경입니다

구앱이 `active`와 `closed`만 아는 상태에서 신server가 `status:paused`를 보내면, JSON parser가 문법을 읽는 데는 성공해도 모르는 값을 default(기본값)인 `active`로 해석해 중지된 기능을 실행할 수 있습니다. 따라서 파싱 성공과 업무 의미를 이해한 상태를 별도로 다루고, 구앱이 이 상태를 받았을 때 실제로 어떤 행동을 하는지 확인합니다.

모르는 장식 필드는 무시할 수 있지만 권한·금액·상태는 안전한 unknown(알 수 없는 값) 처리·명시적 version(계약 버전)·업데이트 안내를 함께 계약합니다.

엄격 schema·전체 응답 서명·cache key·직렬화 순서에 의존하는 client는 선택 필드 추가에도 실패할 수 있습니다. 기존 선택 입력을 필수로 바꾸거나 기본값·단위를 바꾸는 것은 구조가 비슷해도 의미 변화입니다.

## 수정 요청의 Presence를 값과 분리합니다

수정 요청에서는 값 자체와 presence(그 필드가 요청에 들어왔는지)를 따로 읽습니다. 현재 프로필 `{nickname:"old", tags:["a"]}`에서 `nickname`을 생략하면 `old`를 유지하고, `null`을 명시하면 삭제하며, 빈 문자열은 빈 값으로 저장할지 정책상 오류로 거절할지 정합니다. 생성 때 쓰는 기본값 함수를 patch에도 적용하면 생략된 필드까지 초기화되어 의도하지 않은 삭제가 생길 수 있으므로, 입력에 실제로 들어온 필드만 수정합니다.

| 입력 상태 | patch 의미의 예 | 별도 조건 |
| --- | --- | --- |
| 필드 없음 | 현재 값 유지 | presence 보존 |
| null | 삭제 | 삭제 불가 필드는 거절 |
| 빈 문자열 | 빈 값 또는 오류 | null과 구분 |
| 빈 배열 | 비어 있는 목록으로 교체 | 생략과 구분 |
| 값 존재 | 해당 값 적용 | 인가·검증·version |

JSON Merge Patch를 선택하면 object member(객체 필드)의 `null`은 삭제로, array(배열)는 일부 원소를 합치는 대신 전체 대체로 처리합니다. 예를 들어 현재 `tags:["a"]`에 `tags:["b"]`를 보내면 결과를 `["a","b"]`로 합치는 것이 아니라 `["b"]`로 바꾸므로, 원소 단위 수정이 필요하면 다른 patch 형식이나 명령을 선택합니다.

`null` 자체를 값으로 저장해야 한다면 같은 규칙을 그대로 쓰지 말고 다른 patch 형식/명령을 고려합니다. 중첩 object와 동시 수정에서는 각 필드의 presence를 유지하고 expected version(읽은 버전)을 비교해 다른 수정이 덮어쓰는 lost update를 막습니다.

```diagram
{"title":"혼합 버전에서 실제 행동까지 비교합니다","caption":"화살표는 요청·응답의 검증 조합입니다. schema 파싱 성공뿐 아니라 상태·재시도·서명·cache·사용자 흐름을 확인합니다.","rows":[[{"id":"oldclient","label":"구 client"},{"id":"newclient","label":"신 client"}],[{"id":"oldserver","label":"구 server"},{"id":"newserver","label":"신 server"}],[{"id":"contract","label":"동일 의도·안전한 unknown·결과 검증"}]],"edges":[{"from":"oldclient","to":"newserver","label":"전진 배포"},{"from":"newclient","to":"oldserver","label":"server rollback"},{"from":"oldserver","to":"contract","label":"옛 의미"},{"from":"newserver","to":"contract","label":"호환 의미"}]}
```

## Protobuf의 번호는 Wire 식별자입니다

예전 `int64 amount_cents=3`을 삭제한 뒤 `int64 quantity=3`으로 번호 3을 재사용하면, 과거 메시지에 들어 있던 값 `1000`이 새 의미의 수량 `1000`으로 읽힐 수 있습니다. 두 필드의 wire type(바이너리에서 값을 읽는 형식)이 같으면 파싱까지 성공해 잘못된 의미를 놓치기 쉬우므로, ‘읽혔다’를 ‘호환된다’로 보지 않습니다. 새 의미에는 새 번호를 배정하고, 삭제한 번호와 이름은 `reserved`로 보존합니다.

```proto
message Order {
  reserved 3;
  reserved "amount_cents";
  int64 quantity = 4;
}
```

binary unknown field 보존·unknown enum·presence는 언어/runtime/version 경로를 확인합니다. JSON 변환에서는 이름·기본값·unknown 처리 의미가 달라질 수 있어 gateway까지 시험합니다. 새 번호라는 사실만으로 금액 단위와 업무 규칙의 호환성이 보장되지는 않습니다.

## 소비자는 같은 날 모두 갱신되지 않습니다

구앱→신server와 신앱→구server를 모두 시험하고 버튼·오류 안내·retry·서명·cache·중복 효과를 확인합니다. 월말 batch·장기 미접속 앱은 짧은 관측 창의 호출 0으로 사라졌다고 할 수 없습니다. 지원 기간·최소 앱 version·폐기 안내·구 endpoint 유지와 제거 근거를 정합니다.

알 수 없는 enum·필드 접근 오류·노출 version별 사용자 실패를 관측합니다. 이 노트는 호환 설계이며 실제 protobuf compiler·구형 모바일 앱 조합을 실행한 결과는 아닙니다.
