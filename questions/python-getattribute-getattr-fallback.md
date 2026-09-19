---
id: python-getattribute-getattr-fallback
title: __getattribute__와 __getattr__를 함께 정의할 때 fallback과 무한 재귀를 어떻게 피하나요?
difficulty: 중하
category: 언어·런타임
tags:
  - Python
  - descriptor
  - attribute-hooks
  - 언어·런타임
related:
  - python-duck-typing
  - python-mutable-default
---
# __getattribute__와 __getattr__를 함께 정의할 때 fallback과 무한 재귀를 어떻게 피하나요?

## 구두 답변

`__getattribute__`는 인스턴스 점 표기법의 앞단에서 매번 호출됩니다. 기본 descriptor 우선순위를 그대로 쓰려면 내부에서 `object.__getattribute__(self, name)`으로 위임해야 합니다. 반대로 `self.__dict__`나 `self._values`를 점 표기법으로 읽으면 그 읽기 자체가 다시 override에 들어가 무한 재귀가 될 수 있습니다.

`__getattr__`는 선처리 hook이 아니라 기본 lookup이 `AttributeError`를 낸 뒤에 호출되는 보조 경로입니다. 예를 들어 region이라는 설정 키만 보완한다면 다음처럼 이름을 좁혀야 합니다.

```python
class Config:
    def __getattribute__(self, name):
        return object.__getattribute__(self, name)
    def __getattr__(self, name):
        if name == 'region': return 'local'
        raise AttributeError(name)
```

T0에 `cfg.region`이 들어오면 `__getattribute__`가 기본 조회를 시도합니다. T1에 실제 속성이 없어서 AttributeError가 발생하고, T2에 Python의 attribute fallback이 `__getattr__('region')`을 호출해 local을 반환합니다. `cfg.typo`라면 `__getattr__`도 같은 AttributeError를 다시 내야 합니다. `except Exception`으로 모든 오류를 fallback 처리하면 property 계산 중 ValueError나 내부 버그까지 “없는 속성”으로 숨깁니다. 직접 `__getattr__`를 호출하는 방식보다 기본 machinery에 맡기는 편이 예외 의미를 보존합니다. 특히 `object.__getattribute__`가 발생시킨 AttributeError만 fallback 대상이어야 하므로, 조회 중인 이름과 무관한 계산 예외를 넓은 `except`로 감싸지 않습니다. 예를 들어 region의 기본값은 줄 수 있지만, 설정 파일 파싱의 ValueError는 그대로 호출자에게 보여야 원인을 잃지 않습니다.

## 득점 포인트

- `__getattribute__`가 모든 접근의 첫 단계이고 `__getattr__`가 AttributeError 뒤의 보조 단계라는 순서를 말합니다.
- 재귀를 피하기 위해 `object.__getattribute__`를 사용하고 내부 상태도 안전한 경로로 읽는 코드를 제시합니다.
- 예상하는 fallback 이름만 처리하고 다른 오류는 보존하는 이유를 설명합니다.

## 감점 포인트

- `__getattr__`가 모든 속성 접근을 먼저 처리한다고 하면 hook 순서를 뒤집은 것입니다.
- `self._values`를 점 표기법으로 읽어도 안전하다고 하면 재귀 가능성을 누락합니다.
- `except Exception: return None`을 fallback으로 쓰면 진짜 계산 실패를 속성 부재로 바꾸게 됩니다.

## 더 파고들 거리

- descriptor의 `__get__`에서 발생한 AttributeError가 `__getattr__`로 이어지는 경계를 작은 재현으로 확인해 보세요.
- 로깅을 위해 `__getattribute__`를 감쌀 때 private name과 내부 sentinel을 어떻게 제외할지 설계해 보세요.
