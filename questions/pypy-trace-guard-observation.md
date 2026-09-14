---
id: "pypy-trace-guard-observation"
title: "PyPy의 반복 코드가 최적화됐는지 확인합니다. trace와 guard 실패·예열 비용은 어떻게 관찰하나요?"
difficulty: "중하"
category: "언어·런타임"
tags: ["Python","PyPy","trace JIT","예열","C 확장","심화 질문"]
related: ["python-pypy-jit"]
promotedFrom: {"id":"python-pypy-jit","prompt":"PyPy JIT 로그에서 실제 trace와 guard 실패를 어떻게 확인할까요?"}
---

# PyPy의 반복 코드가 최적화됐는지 확인합니다. trace와 guard 실패·예열 비용은 어떻게 관찰하나요?

## 구두 답변

JIT 로그·지원 profiler로 어떤 loop가 trace되고 guard에서 빠지는지 확인합니다. warm-up 이후의 빠른 구간과 컴파일·side exit 비용을 나눠야 합니다.

실제 PyPy 버전·입력 타입·예외·C 경계를 고정합니다. 같은 코드라도 짧게 끝나는 프로세스는 예열 비용을 회수하지 못할 수 있습니다. 전체 서비스 지연과 메모리·호환성을 함께 비교합니다.

## 득점 포인트

- JIT 로그·지원 profiler로 어떤 loop가 trace되고 guard에서 빠지는지 확인합니다. warm-up 이후의 빠른 구간과 컴파일·side exit 비용을 나눠야 합니다.
- 전체 서비스 지연과 메모리·호환성을 함께 비교합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: JIT 로그·지원 profiler로 어떤 loop가 trace되고 guard에서 빠지는지 확인합니다.

## 더 파고들 거리

- [기본 상황과 비교: 반복 계산이 많은 Python 서비스를 PyPy로 옮기려 합니다. trace JIT가 유리한 코드와 예열·C 확장 때문에 불리할 수 있는 경우를 어떻게 검증하나요?](/tech-interview/questions/python-pypy-jit/)
