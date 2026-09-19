---
id: capabilities-user-namespace-scope
title: user namespace 안에서 CAP_NET_ADMIN을 가진 프로세스가 호스트 네트워크를 바꾸지 못할 수 있는 이유는 무엇인가요?
difficulty: 중하
category: 보안
tags:
  - capability
  - execve
  - least privilege
related:
  - authentication-vs-authorization
---
# user namespace 안에서 CAP_NET_ADMIN을 가진 프로세스가 호스트 네트워크를 바꾸지 못할 수 있는 이유는 무엇인가요?

## 구두 답변

`CAP_NET_ADMIN`은 전역 네트워크 열쇠가 아니라 capability를 해석하는 user namespace와 조작 대상 network namespace의 소유 관계에 묶입니다. 컨테이너 프로세스가 자기 network namespace의 route를 바꾸는 것과 host network namespace의 route를 바꾸는 것은 다른 권한 검사입니다. 설명용으로 user namespace Uc가 network namespace Nc를 소유하고 프로세스가 Uc에서 `CAP_NET_ADMIN`을 effective로 가진 상태를 놓겠습니다. Nc의 `10.0.0.0/24` route 변경은 Uc capability가 검사 대상과 맞을 수 있지만, 초기 user namespace Uh가 소유한 host network Nh에 대해서는 같은 capability 숫자가 Uh의 권한을 대신하지 않습니다. Nh fd를 가지고 있어도 `setns`와 대상 owner 검사에서 막힐 수 있습니다. 이 상태는 문서 기반 예상 trace이지 route 변경의 실제 성공 결과가 아닙니다. 진단은 `/proc/self/ns/user`, `/proc/self/ns/net`, target의 namespace link와 `NS_GET_USERNS` 관계, 각 TID의 `CapEff`를 저장하고 `ip route`가 어느 namespace에서 실행됐는지 구분합니다. veth·bridge 연결은 패킷 경로를 만들 뿐 host route table write 권한을 주지 않습니다. device, BPF, physical NIC, LSM, seccomp는 network namespace만으로 설명되지 않습니다. 따라서 “내부 root는 아무것도 못 한다”도 틀리고 “CAP_NET_ADMIN이면 host도 관리한다”도 틀립니다. 대상 자원의 owner namespace, setns 권한, capability, 별도 kernel 정책을 모두 통과해야 한다는 결론을 내리겠습니다.

## 득점 포인트

- capability 숫자와 대상 user/network namespace owner를 함께 해석합니다.
- 자기 netns route 변경과 host netns route 변경의 권한 경계를 분리합니다.
- namespace link·NS_GET_USERNS·실제 route table을 관찰 증거로 제시합니다.

## 감점 포인트

- veth가 연결되면 host route table을 자동으로 수정할 수 있다고 말합니다.
- user namespace 안의 CAP_NET_ADMIN을 초기 namespace의 전역 권한으로 봅니다.
- setns와 대상 namespace owner 검사를 생략하고 capability만으로 결론 냅니다.

## 더 파고들 거리

- target network namespace가 같은 user namespace의 자식일 때 어떤 권한 검사가 남는지 설명해 보세요.
- BPF나 physical NIC 조작에서 network namespace 외에 필요한 device·LSM 조건을 나눠 보세요.
