---
id: "object-storage-multipart-upload"
title: "큰 파일을 multipart upload로 나눠 보냅니다. 일부 part만 성공하거나 완료 응답을 잃으면 어떻게 복구하나요?"
answerMinutes: 5
followups: [{"id": "http-range-resume-download", "prompt": "다운로드 재개에서 이전 바이트와 새 파일 버전이 섞이지 않게 어떤 조건을 검사하나요?"}, {"id": "file-checksum-integrity", "prompt": "전송한 파일의 바이트 일치와 출처·실행 안전성을 어떤 검증으로 나누나요?"}, {"id": "object-storage-consistency", "prompt": "객체 저장·DB 포인터·CDN의 서로 다른 최신성을 어떤 공개 상태로 연결하나요?"}]
difficulty: "중하"
category: "인프라"
tags: ["객체 저장소", "인프라"]
related: ["http-range-resume-download", "file-checksum-integrity", "object-storage-consistency"]
---

# 큰 파일을 multipart upload로 나눠 보냅니다. 일부 part만 성공하거나 완료 응답을 잃으면 어떻게 복구하나요?

## 구두 답변

multipart는 조각별 전송과 최종 객체 확정을 분리하는 방식입니다. part 성공은 완성 객체의 공개가 아니며 upload ID·part 번호·검증 정보와 최종 완료 상태를 추적해야 합니다.

### 동작 원리와 전제

실패한 part만 다시 보낼 수 있지만 같은 번호의 교체·최종 조합 규칙은 제품 계약을 확인합니다. complete 응답 유실 뒤 무조건 새 업로드를 만들지 않고 기존 작업과 객체 버전을 조회합니다. 단순 ETag를 항상 전체 파일의 MD5라고 해석하지 않습니다.

### 선택과 실패 처리

중단된 업로드는 저장 비용을 차지할 수 있어 abort·lifecycle 정책을 둡니다. 정리 전에 진행 중 작업인지 확인하고 작업 ID와 소유자를 연결합니다. presigned URL은 권한·만료·대상 키·크기를 제한합니다.

### 구체적인 사례와 검증

최종 complete가 timeout되면 part를 다시 업로드하기보다 upload ID와 객체 상태를 조회할 수 있는지 확인합니다. 이미 완료된 객체에 새 업로드를 시작하면 비용과 version이 늘 수 있습니다. part checksum은 각 조각의 무결성을 검사하고 전체 파일의 조합·길이 검증은 별도로 수행합니다. ETag가 multipart 구성 정보를 반영하는 제품에서는 이를 전체 원본 MD5로 대체하면 안 됩니다. 중단된 upload 청소는 일정 시간보다 오래됐다는 이유만으로 즉시 수행하지 않고 장기 작업과 사용자 재개 요구를 고려합니다. 운영에서는 남은 part 바이트와 가장 오래된 upload를 관찰합니다.

part 누락·중복·순서·완료 응답 유실·checksum 오류를 시험합니다. 최종 파일 무결성과 메타데이터 공개 상태를 확인합니다. 재개 기능이 있다고 사용자 취소와 고아 조각 정리가 자동 해결되는 것은 아닙니다.

## 득점 포인트

- 핵심 구분: multipart는 조각별 전송과 최종 객체 확정을 분리하는 방식입니다.
- 선택 조건: 중단된 업로드는 저장 비용을 차지할 수 있어 abort·lifecycle 정책을 둡니다.
- 검증 기준: part 누락·중복·순서·완료 응답 유실·checksum 오류를 시험합니다.

## 감점 포인트

- 각 part가 성공했으면 최종 객체의 완성·공개·전체 checksum도 보장됐다고 한다.

## 더 파고들 거리

- 다운로드 재개에서 이전 바이트와 새 파일 버전이 섞이지 않게 어떤 조건을 검사하나요?
- 전송한 파일의 바이트 일치와 출처·실행 안전성을 어떤 검증으로 나누나요?
- 객체 저장·DB 포인터·CDN의 서로 다른 최신성을 어떤 공개 상태로 연결하나요?
