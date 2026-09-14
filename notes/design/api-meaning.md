---
id: api-meaning
title: API 혼합 버전·Patch Presence·Protobuf 번호
topic: 설계
summary: 파싱과 행동 호환·unknown enum·null/생략/빈 값·생성 기본값·field reservation·JSON gateway·오래된 소비자와 rollback을 설명합니다.
questionIds: [api-backward-compatibility, api-null-omission-patch, protobuf-field-number-reservation]
---

# API 혼합 버전·Patch Presence·Protobuf 번호

## 필드 추가와 상태 의미 추가는 다른 변경입니다

구앱이 active·closed만 알 때 `status:paused`를 보내면 JSON parser는 성공해도 default를 active로 해석해 중지된 기능을 실행할 수 있습니다. 모르는 장식 필드는 무시할 수 있어도 권한·금액·상태는 안전한 unknown 처리·명시적 version·업데이트 안내가 필요합니다.

엄격 schema·전체 응답 서명·cache key·직렬화 순서에 의존하는 client는 선택 필드 추가에도 실패할 수 있습니다. 기존 선택 입력을 필수로 바꾸거나 기본값·단위를 바꾸는 것은 구조가 비슷해도 의미 변화입니다.

## 수정 요청의 Presence를 값과 분리합니다

현재 프로필 `{nickname:"old", tags:["a"]}`에서 nickname 생략은 유지, 명시적 null은 삭제, 빈 문자열은 빈 값 또는 정책상 오류처럼 계약을 정합니다. 생성 기본값 함수를 patch에도 쓰면 생략 필드를 초기화해 의도하지 않은 삭제가 생길 수 있습니다.

| 입력 상태 | patch 의미의 예 | 별도 조건 |
| --- | --- | --- |
| 필드 없음 | 현재 값 유지 | presence 보존 |
| null | 삭제 | 삭제 불가 필드는 거절 |
| 빈 문자열 | 빈 값 또는 오류 | null과 구분 |
| 빈 배열 | 비어 있는 목록으로 교체 | 생략과 구분 |
| 값 존재 | 해당 값 적용 | 인가·검증·version |

JSON Merge Patch를 선택하면 object member의 null 삭제·array 전체 대체 등 그 형식의 규칙을 따릅니다. null 자체를 값으로 저장할 필요가 있으면 다른 patch 형식/명령을 고려합니다. 중첩 object·동시 수정은 presence를 보존하고 expected version 등으로 lost update를 막습니다.

```diagram
{"title":"혼합 버전에서 실제 행동까지 비교합니다","caption":"화살표는 요청·응답의 검증 조합입니다. schema 파싱 성공뿐 아니라 상태·재시도·서명·cache·사용자 흐름을 확인합니다.","rows":[[{"id":"oldclient","label":"구 client"},{"id":"newclient","label":"신 client"}],[{"id":"oldserver","label":"구 server"},{"id":"newserver","label":"신 server"}],[{"id":"contract","label":"동일 의도·안전한 unknown·결과 검증"}]],"edges":[{"from":"oldclient","to":"newserver","label":"전진 배포"},{"from":"newclient","to":"oldserver","label":"server rollback"},{"from":"oldserver","to":"contract","label":"옛 의미"},{"from":"newserver","to":"contract","label":"호환 의미"}]}
```

## Protobuf의 번호는 Wire 식별자입니다

예전 `int64 amount_cents=3`을 삭제한 뒤 `int64 quantity=3`으로 재사용하면 과거 메시지의 1000이 새 수량 1000으로 읽힐 수 있습니다. wire type이 같아 파싱이 성공하는 것이 더 위험할 수 있습니다. 새 의미에는 새 번호를 쓰고 삭제 번호와 이름은 reserved로 보존합니다.

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
