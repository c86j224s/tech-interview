---
id: "k8s-serviceaccount-token"
title: "Pod에 ServiceAccount 토큰이 있습니다. 이를 가진 앱이 클러스터 전체를 관리하게 두어도 되나요?"
answerMinutes: 5
followups: [{"id": "gitops-secrets-delivery", "prompt": "배포 자격과 비밀값이 Git·이미지·로그에 남지 않게 어떤 전달 경로를 사용하나요?"}, {"id": "agent-least-privilege", "prompt": "실행 주체가 받은 자격과 모델이 제안한 대상 인자를 어떻게 분리해 최소 권한을 강제하나요?"}, {"id": "authentication-vs-authorization", "prompt": "유효하게 로그인한 주체라도 해당 자원을 변경할 수 있는지는 어디에서 검사하나요?"}]
difficulty: "중하"
category: "보안"
tags: ["Kubernetes", "보안", "ServiceAccount"]
related: ["gitops-secrets-delivery", "agent-least-privilege", "authentication-vs-authorization"]
---

# Pod에 ServiceAccount 토큰이 있습니다. 이를 가진 앱이 클러스터 전체를 관리하게 두어도 되나요?

## 구두 답변

ServiceAccount는 workload의 Kubernetes API 신원이며 실제 권한은 RBAC와 자원 범위로 제한해야 합니다. 토큰을 가진다는 사실이 관리자 권한이 필요한 이유는 아닙니다.

### 동작 원리와 전제

필요한 verb·resource·namespace만 허용하고 API를 쓰지 않는 Pod에는 불필요한 토큰 마운트를 줄입니다. projected token의 audience·만료·회전과 앱의 재읽기 동작을 확인합니다. 토큰을 이미지나 로그·모델 문맥에 복사하지 않습니다.

### 선택과 실패 처리

클라우드 workload identity와 Kubernetes API 자격은 별도일 수 있습니다. 노드 공통 자격을 모든 Pod가 읽게 하지 않고 서비스별 범위를 제한합니다. Secret을 읽는 권한이 사실상 다른 자격을 얻는 경로가 되는지도 검토합니다.

### 구체적인 사례와 검증

앱이 자신의 Pod 상태만 읽으면 충분한데 Secret 전체 읽기 권한을 주면 다른 서비스 자격을 얻는 경로가 열릴 수 있습니다. 최소 권한은 직접 API 동작뿐 아니라 그 결과로 얻는 비밀의 영향도 봐야 합니다. 토큰 rotation을 지원하는 앱은 파일을 한 번 읽고 영구 캐시하지 않고 필요한 갱신 계약을 따릅니다. audience가 다른 토큰을 외부 API가 받아들이는 혼동도 방지합니다. 실험 환경에서 권한 거절을 만나면 cluster-admin을 붙여 해결하기보다 필요한 verb·resource를 확인합니다. 생성 코드와 외부 도구가 Pod 자격을 읽지 못하도록 실행 경계도 나눕니다.

다른 namespace 접근·만료·회전·Pod 삭제·권한 철회를 시험합니다. RBAC 설정과 실제 API 응답을 확인하고 권한 거절을 넓은 role로 무조건 해결하지 않습니다. 실행 주체의 최소 권한과 감사 추적이 핵심입니다.

## 득점 포인트

- 핵심 구분: ServiceAccount는 workload의 Kubernetes API 신원이며 실제 권한은 RBAC와 자원 범위로 제한해야 합니다.
- 선택 조건: 클라우드 workload identity와 Kubernetes API 자격은 별도일 수 있습니다.
- 검증 기준: 다른 namespace 접근·만료·회전·Pod 삭제·권한 철회를 시험합니다.

## 감점 포인트

- Pod의 ServiceAccount에는 편의상 cluster-admin을 부여해도 된다고 한다.

## 더 파고들 거리

- 배포 자격과 비밀값이 Git·이미지·로그에 남지 않게 어떤 전달 경로를 사용하나요?
- 실행 주체가 받은 자격과 모델이 제안한 대상 인자를 어떻게 분리해 최소 권한을 강제하나요?
- 유효하게 로그인한 주체라도 해당 자원을 변경할 수 있는지는 어디에서 검사하나요?
