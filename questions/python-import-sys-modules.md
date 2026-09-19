---
id: python-import-sys-modules
title: 같은 모듈을 여러 번 import해도 초기화가 반복되지 않는 이유와 sys.modules 삭제의 위험은 무엇인가요?
difficulty: 중하
category: 언어·런타임
tags:
  - Python
  - import
  - 언어·런타임
related:
  - python-gil-parallelism
---
# 같은 모듈을 여러 번 import해도 초기화가 반복되지 않는 이유와 sys.modules 삭제의 위험은 무엇인가요?

## 구두 답변

Python import는 완전히 해석된 모듈 이름을 `sys.modules`의 cache key로 사용합니다. 최초 import에서는 모듈 객체가 만들어지고 top-level 코드가 실행되지만, 같은 key가 이미 있으면 일반 import는 그 객체를 다시 실행하지 않고 재사용합니다.

```python
import sys
import math
m1 = sys.modules['math']
import math as m2
print(m1 is m2)  # True
```

반복 import가 한 번만 초기화되는 것은 파일을 전역적으로 한 번만 읽는다는 뜻이 아닙니다. 같은 소스가 다른 package 이름이나 loader 경로로 노출되면 key가 달라 별도 module identity가 생길 수 있습니다. 반대로 `del sys.modules['pkg.mod']` 후 `import pkg.mod`를 하면 새 module object가 만들어질 수 있습니다. 이전 module을 이미 참조하던 consumer, 이전 class의 instance, registry callback은 자동으로 새 객체를 보지 않습니다. 그래서 old `Handler`와 new `Handler`의 class identity가 달라져 `isinstance(old_instance, NewHandler)`가 false가 될 수 있습니다.

`importlib.invalidate_caches()`는 finder가 디렉터리의 새 파일을 다시 찾게 하는 기능이지 이미 로드한 module object를 교체하는 명령이 아닙니다. cache를 직접 삭제하면 import lock, thread가 가진 callback, singleton registry, 기존 인스턴스의 수명을 함께 정리해야 합니다. 일반 실행 중에는 삭제보다 명시적인 plugin stop→참조 해제→새 버전 공개 lifecycle이 안전합니다. 예를 들어 새 module을 먼저 import한 뒤 registry의 callback을 원자적으로 교체하고, old callback을 실행 중인 요청이 끝난 다음 old module을 폐기합니다. 이 순서를 생략하면 같은 파일의 class가 두 identity로 살아 있어 타입 검사와 전역 singleton 조회가 서로 다른 결과를 낼 수 있습니다.

## 득점 포인트

- key가 파일 경로가 아니라 완전히 해석된 module name이며 cache hit가 같은 identity를 재사용한다는 점을 설명합니다.
- `del sys.modules[...]` 후 새 module·class가 생기고 old alias와 instance가 남는 상태를 `isinstance` 예제로 추적합니다.
- invalidate_caches와 module replacement를 구분합니다.

## 감점 포인트

- sys.modules에서 삭제하면 모든 기존 참조도 자동으로 새 module을 본다고 하면 Python 참조 모델을 틀리게 설명한 것입니다.
- invalidate_caches를 reload API라고 말하면 finder cache와 module object cache를 혼동한 것입니다.
- 단순 재import만으로 registry와 thread callback이 정리된다고 가정하면 중복 side effect를 만들 수 있습니다.

## 더 파고들 거리

- 같은 파일을 두 이름으로 import하는 package layout에서 어떤 class identity가 분리되는지 재현해 보세요.
- plugin 교체 시 in-flight 요청이 old module을 끝까지 사용하도록 하는 drain 경계를 설계해 보세요.
