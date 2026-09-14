---
id: "k8s-network-policy"
title: "NetworkPolicy를 만들었는데 Pod의 외부 통신이 계속됩니다. 무엇을 선택하고 어떤 경로를 막는지 어떻게 확인하나요?"
answerMinutes: 5
followups: [{"id": "network-tls-mtls-identity", "prompt": "네트워크 신원을 인증한 뒤에도 API·테넌트 인가는 어디에서 수행하나요?"}, {"id": "agent-data-egress", "prompt": "읽을 수 있는 자료라도 외부 목적지에 보낼 수 있는지는 어디에서 별도로 검사하나요?"}, {"id": "k8s-service-network", "prompt": "새 backend가 생겨도 긴 TCP·HTTP/2 연결이 옮겨가지 않는 이유를 어떻게 확인하나요?"}]
difficulty: "중하"
category: "보안"
tags: ["Kubernetes", "보안", "NetworkPolicy"]
related: ["network-tls-mtls-identity", "agent-data-egress", "k8s-service-network"]
---

# NetworkPolicy를 만들었는데 Pod의 외부 통신이 계속됩니다. 무엇을 선택하고 어떤 경로를 막는지 어떻게 확인하나요?

## 구두 답변

NetworkPolicy의 동작은 지원하는 네트워크 구현과 정책이 선택한 Pod·방향·peer·port에 달려 있습니다. 객체가 생성됐다는 사실만으로 실제 enforcement가 되는 것은 아닙니다.

### 동작 원리와 전제

ingress와 egress를 따로 정하고 namespaceSelector·podSelector의 결합 의미를 확인합니다. 선택되지 않은 Pod와 기본 허용 상태를 구분합니다. DNS를 차단하면 정상 외부 호출도 이름을 못 찾을 수 있어 필요한 통신을 명시합니다.

### 선택과 실패 처리

정책들은 보통 허용 규칙이 합쳐지는 방식이므로 한 정책의 제한을 다른 허용 정책이 넓힐 수 있습니다. hostNetwork·노드 트래픽·NAT 전후 주소 등 세부 동작은 CNI와 환경에서 확인합니다. 애플리케이션 인증·인가를 대체하지 않습니다.

### 구체적인 사례와 검증

default deny를 적용한 뒤 필요한 DNS·DB·모니터링 통신을 명시적으로 허용하는 방법을 사용할 수 있습니다. 이때 namespace 라벨과 Pod selector가 AND인지 OR인지 YAML 구조에 따라 의도가 달라지므로 실제 통신 테스트를 둡니다. 정책이 여러 개면 허용 규칙의 합이 예상보다 넓어질 수 있어 단일 파일만 검토하지 않습니다. CNI가 정책을 지원하지 않으면 API 객체는 존재해도 패킷을 막지 못할 수 있습니다. 외부 도메인별 제약이나 HTTP 경로 인가가 필요하면 기본 NetworkPolicy 밖 기능을 검토하고 그 보장 범위를 명시합니다.

실제 Pod에서 허용·금지 peer와 port를 테스트하고 새 namespace·라벨 변경·DNS를 포함합니다. 외부 데이터 전송 제한에는 목적지와 앱 계층 정책이 추가로 필요할 수 있습니다. 정책 파일과 실제 통신 결과를 함께 검증하겠습니다.

## 득점 포인트

- 핵심 구분: NetworkPolicy의 동작은 지원하는 네트워크 구현과 정책이 선택한 Pod·방향·peer·port에 달려 있습니다.
- 선택 조건: 정책들은 보통 허용 규칙이 합쳐지는 방식이므로 한 정책의 제한을 다른 허용 정책이 넓힐 수 있습니다.
- 검증 기준: 실제 Pod에서 허용·금지 peer와 port를 테스트하고 새 namespace·라벨 변경·DNS를 포함합니다.

## 감점 포인트

- NetworkPolicy 객체 생성 성공이 실제 패킷 차단의 증거라고 한다.

## 더 파고들 거리

- 네트워크 신원을 인증한 뒤에도 API·테넌트 인가는 어디에서 수행하나요?
- 읽을 수 있는 자료라도 외부 목적지에 보낼 수 있는지는 어디에서 별도로 검사하나요?
- 새 backend가 생겨도 긴 TCP·HTTP/2 연결이 옮겨가지 않는 이유를 어떻게 확인하나요?
