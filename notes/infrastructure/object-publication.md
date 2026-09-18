---
id: object-publication
title: Multipart 업로드와 객체·DB·CDN의 공개 버전
topic: 인프라
summary: part 전송·complete·checksum·메타데이터 전환을 나누고 응답 유실·불변 키·CDN cache·고아 객체와 진행 중 upload 정리를 설명합니다.
questionIds: [object-storage-consistency, object-storage-multipart-upload]
---

# Multipart 업로드와 객체·DB·CDN의 공개 버전

객체 업로드의 완료는 part 전송이 끝났다는 뜻이 아니라, 원하는 객체 버전을 확인하고 애플리케이션의 공개 포인터가 그 버전을 가리키는 상태까지 도달했다는 뜻이어야 합니다. 저장소·DB·CDN이 각각 다른 수명을 가지므로 중단 시 어느 단계까지 진행됐는지 조회 가능한 상태 기계가 필요합니다.

## 객체 저장소 최신 버전과 CDN 바이트의 시점 차이

같은 report 키를 v1에서 v2로 덮었는데 origin은 v2, CDN은 TTL 안의 v1, DB는 새 메타데이터를 가리킬 수 있습니다. 특정 객체 저장소가 강한 읽기 일관성을 제공해도 CDN·DB와 하나의 원자 상태가 되는 것은 아닙니다. 제품별 PUT·GET·LIST·삭제·복제의 보장 범위를 확인해야 합니다.

객체부터 저장하고 DB 업데이트 전에 죽으면 고아 객체가 남을 수 있고, DB부터 공개하면 아직 없는 객체를 가리킬 수 있습니다. 접수·전송·검증·공개 단계를 나누어 복구 가능한 상태로 관리합니다.

독자가 보는 상태는 `DB current pointer`, `origin object version`, `CDN response version` 세 값의 조합입니다. v2 포인터 전환 직후 CDN이 v1을 내놓는 trace를 허용할지, 불변 URL로 회피할지, 무효화 완료를 공개 조건으로 삼을지를 제품 계약으로 고정해야 합니다. 원본 GET 성공만으로 최종 사용자에게 최신 바이트가 전달됐다고 판정하지 않습니다.

## Multipart Part 성공과 Complete 상태의 분리

| 상태 | 보관할 정보 | 완료로 보지 않을 것 |
| --- | --- | --- |
| upload 시작 | upload ID·대상 키·소유자·입력 버전 | 최종 객체 존재 |
| part 전송 | part 번호·길이·checksum·제품 식별값 | 전체 조합 무결성 |
| complete 요청 | 정확한 part 목록·업로드 세대 | 응답 timeout의 실패 확정 |
| 객체 확인 | 최종 version·크기·checksum | 앱 공개 승인 |
| DB 포인터 전환 | 기대 버전·새 객체 참조 | 옛 URL의 즉시 폐기 |

예를 들어 part 3만 실패했다면 part 3만 재전송할 수 있지만, complete에는 제품이 요구하는 최종 part 목록과 순서를 제출해야 합니다. 같은 part 번호를 교체할 수 있는지, 최종 목록의 순서·최소 크기·기타 제한은 제품 계약을 먼저 대조합니다. ETag는 multipart·암호화 구성에서 항상 전체 파일 MD5를 뜻하지 않으므로, part별 checksum과 최종 파일의 길이·조합·지원되는 전체 checksum을 따로 확인합니다.

```diagram
{"title":"완성된 객체 버전만 공개 포인터로 연결합니다","caption":"화살표는 앱의 공개 순서입니다. 저장소 complete와 DB 전환은 다른 거래이므로 중단 후 각 상태를 조회해 대사할 수 있어야 합니다.","rows":[[{"id":"parts","label":"upload ID의 parts 전송"}],[{"id":"complete","label":"최종 complete·객체 확인"}],[{"id":"validate","label":"크기·checksum·내용 검증"}],[{"id":"pointer","label":"DB 포인터 조건부 전환"}]],"edges":[{"from":"parts","to":"complete","label":"제품의 조합 계약"},{"from":"complete","to":"validate","label":"특정 객체 version"},{"from":"validate","to":"pointer","label":"공개 조건 충족"}]}
```

각 part 성공 응답은 “이 part를 다시 쓸 수 있다”는 증거이지 전체 파일의 공개 가능성을 뜻하지 않습니다. 실패를 재현할 때 누락·순서 변경·checksum 불일치에 대해 complete가 어떤 오류를 내는지, 성공 후 최종 크기·checksum·metadata가 기대 세대와 맞는지를 각각 assertion으로 둡니다. 제품별 ETag·checksum 의미와 part 제한은 사용 중인 저장소의 공식 문서로 확인한 뒤에만 구현 계약에 넣습니다.

## Complete 응답 유실과 기존 결과 확인

complete가 서버에서 성공했지만 응답이 유실되면 클라이언트는 실패인지 알 수 없습니다. 무조건 새 upload를 만들기보다 기존 upload ID·대상 객체 version·메타데이터·checksum을 조회해 실제 결과를 확인할 수 있는지 봅니다. 완료된 upload ID가 더 이상 조회되지 않는 제품도 있으므로 객체 존재와 기대 version을 함께 대조하는 복구 계약이 필요합니다.

같은 키를 다른 writer가 덮을 수 있으면 존재만 확인해서는 내 업로드 성공인지 알 수 없습니다. 불변 버전 키·요청 ID metadata·조건부 쓰기 등 지원 기능으로 정체성을 결합합니다. 재시도 자체의 멱등성은 제품 API와 앱 상태 머신에서 확인해야 합니다.

클라이언트 상태는 `complete sent`, `outcome unknown`, `verified complete`, `verified absent`를 구분해야 합니다. outcome unknown에서 새 upload를 무조건 시작하면 중복 객체와 포인터 경쟁이 생길 수 있으므로 upload ID·불변 key·request metadata를 조회하고, 조회 불가일 때만 재시작 기준을 적용합니다. “객체가 있다”와 “내 요청의 객체다”를 구분할 식별자가 없으면 복구 자동화를 안전하게 만들 수 없습니다.

## 불변 키·조건부 포인터와 공개 포인터 경쟁 완화

새 객체를 `report/version-8` 같은 불변 키로 저장하고 검증한 뒤 DB의 current_version=7 조건으로 포인터를 8로 바꾸면 옛 writer가 최신 포인터를 덮는 것을 막을 수 있습니다. 이는 DB 포인터 전환 경계의 계약이며 객체 저장·CDN 전체가 하나의 거래라는 뜻은 아닙니다.

실패 writer의 객체는 나중 정리할 수 있지만 아직 진행 중인 upload·독자·재시도·공개 URL이 참조하는지 확인해야 합니다. 단순 생성 시각만 보고 오래된 객체를 지우면 긴 작업이나 정상 옛 버전 다운로드를 끊을 수 있습니다. 참조 원장·작업 수명·보관 기간·삭제 세대를 함께 봅니다.

## CDN 수명과 URL 수명의 분리

`report/version-8` 같은 불변 키를 URL에 사용하면 같은 키의 내용 교체로 CDN이 옛 바이트를 내놓는 혼동을 줄일 수 있습니다. 그래도 옛 버전 접근을 언제 종료할지·권한 회수·presigned URL 만료·CDN 인증은 별도로 정해야 합니다. 같은 키 덮어쓰기를 유지한다면 제품이 정의한 `validator`와 `Cache-Control`의 의미·설정을 대조하고, 무효화 완료 신호 뒤 edge에서 기대 version의 응답이 실제로 전파됐는지 확인합니다.

업로드 URL은 접수 권한이며 검사 완료·공개 승인은 아닙니다. 미검사 객체는 격리하고 원본·변환본의 공개 정책과 개인정보 보관을 나눕니다. checksum이 맞아도 출처·악성 콘텐츠·자원 사용 안전성이 증명되는 것은 아닙니다.

## 미완료 Part와 고아 객체 정리

중단된 multipart parts는 저장 비용을 만들 수 있어 abort·lifecycle 정책과 관측을 둡니다. 현재 upload 소유자·lease·재개 기한·실제 진행 여부를 확인하고 정상 긴 작업을 정리하지 않습니다. 삭제·abort와 늦은 전송이 경쟁할 때 제품 동작과 재시도 결과를 확인합니다.

테스트는 part 누락·중복·다른 순서·checksum 오류·complete 응답 유실·DB 전환 실패·동시 writer·CDN hit를 나눕니다. 현재 작업에서는 실제 객체 저장소 upload·abort·공개를 실행하지 않았습니다. 본문은 공개 상태와 복구 설계입니다.

정리 작업은 생성 시각만 보는 삭제가 아니라 참조·lease·upload 상태·보관 기한을 합친 후보 생성이어야 합니다. 정상 긴 업로드와 중단된 upload를 각각 두고 lifecycle/abort가 예상된 것만 회수하는지 확인하며, 늦은 part 전송이 이미 abort된 upload에 대해 재시도 가능한 실패를 내는지도 봅니다. 현재 문서의 실제 저장소 미실행 한계는 유지합니다.
