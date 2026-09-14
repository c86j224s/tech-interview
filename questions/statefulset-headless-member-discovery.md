---
id: "statefulset-headless-member-discovery"
title: "StatefulSet의 ordinal DNS로 멤버를 찾습니다. 안정적인 이름과 현재 접속·합의 멤버십은 어떻게 구분하나요?"
difficulty: "중하"
category: "인프라"
tags: ["Kubernetes","Pod","Deployment","StatefulSet","심화 질문"]
related: ["k8s-pod-deployment-statefulset","k8s-reconciliation"]
promotedFrom: {"id":"k8s-pod-deployment-statefulset","prompt":"Headless Service와 StatefulSet ordinal DNS가 클러스터 멤버 발견에 어떻게 쓰이는지 설명해 보세요."}
---

# StatefulSet의 ordinal DNS로 멤버를 찾습니다. 안정적인 이름과 현재 접속·합의 멤버십은 어떻게 구분하나요?

## 구두 답변

ordinal DNS는 안정적인 발견 이름을 제공할 수 있지만 그 이름의 Pod가 현재 준비됐거나 합의의 투표자라는 뜻은 아닙니다. 실제 주소·readiness·cluster membership을 분리합니다.

재시작한 동일 ordinal의 로그·세대·자격을 검증합니다. Headless Service의 publishNotReadyAddresses 등 발견 설정은 부트스트랩 요구와 함께 확인합니다. DNS cache와 합의 구성 변경을 같은 절차로 취급하지 않습니다.

## 득점 포인트

- ordinal DNS는 안정적인 발견 이름을 제공할 수 있지만 그 이름의 Pod가 현재 준비됐거나 합의의 투표자라는 뜻은 아닙니다. 실제 주소·readiness·cluster membership을 분리합니다.
- DNS cache와 합의 구성 변경을 같은 절차로 취급하지 않습니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: ordinal DNS는 안정적인 발견 이름을 제공할 수 있지만 그 이름의 Pod가 현재 준비됐거나 합의의 투표자라는 뜻은 아닙니다.

## 더 파고들 거리

- [기본 상황과 비교: Kubernetes에서 API 서버와 고정 식별자·디스크가 필요한 저장 서버를 배포합니다. Pod, Deployment, StatefulSet은 어떤 역할이 다른가요?](/tech-interview/questions/k8s-pod-deployment-statefulset/)
