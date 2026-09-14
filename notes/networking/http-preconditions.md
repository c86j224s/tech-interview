---
id: http-preconditions
title: HTTP 조건부 변경과 이어받기
topic: 네트워크
summary: If-Match의 낡은 쓰기 방지와 If-Range의 동일 표현 확인을 구분하고 412·206·200·416 이후의 안전한 처리 순서를 설명합니다.
questionIds: [http-if-match-updates, http-range-resume-download]
---

# HTTP 조건부 변경과 이어받기

## 같은 URL이 같은 상태를 뜻하지는 않습니다

문서 v7을 읽은 두 사용자가 각각 수정하거나, 파일의 앞부분을 받은 뒤 서버 파일이 바뀌는 상황을 생각해 보겠습니다. URL이 같아도 기준 데이터는 다릅니다. HTTP의 조건부 요청은 “내가 알고 있는 표현이 아직 맞을 때만 이 동작을 수행하라”는 전제를 전달합니다.

If-Match는 주로 변경의 기준 버전을 보호하고, If-Range는 부분 다운로드를 같은 표현에 이어 붙일 수 있는지 확인합니다. 두 경우 모두 태그는 인가가 아니라 표현·버전의 전제입니다.

## If-Match는 비교와 쓰기가 원자적이어야 합니다

| 순서 | 사용자 A | 사용자 B | 서버 버전 |
| --- | --- | --- | --- |
| 1 | v7 조회 | v7 조회 | 7 |
| 2 | If-Match v7로 저장 성공 | 편집 중 | 8 |
| 3 | 완료 | If-Match v7로 저장 | 8, 전제 실패 |

서버는 인증·인가 뒤 강한 비교 의미에 따라 조건을 검사합니다. 일반적인 전제 불일치는 412로 알립니다. 서버 코드에서 ETag를 읽고 비교한 뒤 조건 없는 UPDATE를 수행하면 그 사이 다른 변경이 들어올 수 있습니다.

```text
update(request):
    principal = authenticate(request)
    authorize_resource(principal, request.target)
    require_valid_strong_precondition(request.ifMatch)
    begin transaction
        changed = update_where_version_matches(
            target, expectedVersion, newContent)
        if changed != 1:
            rollback
            return precondition_failed
    commit
    return new_representation_and_etag
```

이 모형은 API가 ETag와 도메인 버전을 안전하게 연결하는 계약을 제공한다는 전제입니다. 표현별 태그를 내부 버전 숫자로 임의 파싱해도 된다는 뜻은 아닙니다. 조건 없는 쓰기를 허용하지 않을 경우 428 같은 명시적 전제 요구 정책을 둘 수 있습니다.

## 충돌 뒤 태그만 바꾸면 보호를 우회합니다

B가 412를 받은 뒤 새 태그 v8만 얻어 같은 옛 전체 본문을 다시 저장하면 A의 변경을 덮을 수 있습니다. 원래 읽은 본문·B의 변경 의도·현재 본문을 비교해 병합하거나 사용자에게 충돌을 보여 주어야 합니다.

변경 응답 유실은 전제 실패와 다릅니다. 실제로 v8을 만들었는데 응답만 사라졌을 수 있으므로 논리 요청 ID·결과 조회가 필요할 수 있습니다. ETag만으로 요청 중복과 모든 외부 효과를 해결하지 않습니다.

## Range는 바이트 위치이지 파일 정체성이 아닙니다

v7 파일 앞 1,000바이트를 받은 뒤 같은 URL의 v8 파일에서 1,000번 이후를 가져와 붙이면 손상됩니다. 부분 파일에는 validator·총길이·인코딩·완료 범위를 저장하고 다음 요청에 Range와 적절한 If-Range를 사용합니다.

```diagram
{"title":"부분 응답과 전체 응답의 분기","caption":"화살표는 이어받기 응답 처리입니다. 200을 받았는데 기존 부분 파일에 append하면 전체 본문이 중복되므로 새 전체 다운로드로 전환해야 합니다.","rows":[[{"id":"request","label":"Range + If-Range","detail":["이전 파일 validator"]}],[{"id":"partial","label":"206 Partial Content","detail":["범위·validator 검사 후 결합"]},{"id":"full","label":"200 OK","detail":["기존 부분을 이어붙이지 않음"]}]],"edges":[{"from":"request","to":"partial","label":"같은 표현·범위 허용"},{"from":"request","to":"full","label":"변경 또는 범위 무시"}]}
```

서버는 Range를 무시할 수 있습니다. 206이어도 Content-Range의 시작·끝·전체 길이와 요청 범위가 맞는지 확인합니다. 범위가 유효하지 않아 416이 오면 로컬 길이를 믿고 성공 처리하지 말고 현재 표현 정보를 재확인합니다. If-Range에 weak ETag를 사용하지 않는 등 허용 validator 규칙을 지켜야 합니다.

## 인코딩과 최종 무결성도 같은 기준이어야 합니다

압축된 표현의 offset과 압축 해제된 파일의 길이를 섞으면 범위가 틀립니다. 이전 응답의 Content-Encoding과 실제 저장한 바이트 기준을 유지해야 합니다. 인증 URL을 갱신해도 같은 객체 버전을 가리키는지 확인합니다.

| 응답·상태 | 처리 |
| --- | --- |
| 206, 기대 범위·동일 표현 | 해당 바이트를 지정 위치에 저장 |
| 200 전체 표현 | 전체 받기 경로로 시작, 무조건 append 금지 |
| 416 | 범위·현재 길이·파일 버전 재확인 |
| checksum 불일치 | 결합 결과를 완료 파일로 공개하지 않음 |

최종 해시는 손상·누락을 찾는 데 유용하지만 해시의 신뢰된 출처가 없으면 진위까지 보장하지 않습니다. 다운로드 중 임시 파일을 최종 파일로 보이게 하지 않고, 검증된 전체 결과만 공개합니다.

## 변경과 재개를 교차시켜 시험합니다

A·B의 동시 저장에서 한 요청이 낡은 전제로 거절되는지, 412 뒤 자동 덮어쓰기가 없는지 확인합니다. 이어받기는 중간 파일 변경·Range 무시·잘못된 Content-Range·URL 만료·최종 hash를 시험합니다.

작업 성공은 상태 코드 하나가 아니라, 허용된 주체가 올바른 기준 상태에 변경했고 같은 표현의 바이트로 완전한 파일을 만들었는지까지 확인한 결과입니다.
