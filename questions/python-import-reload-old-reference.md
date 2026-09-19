---
id: python-import-reload-old-reference
title: importlib.reload 뒤 from 모듈 import 이름으로 받은 참조가 그대로인 이유는 무엇인가요?
difficulty: 중하
category: 언어·런타임
tags:
  - Python
  - import
  - reload
  - 언어·런타임
related:
  - python-gil-parallelism
---
# importlib.reload 뒤 from 모듈 import 이름으로 받은 참조가 그대로인 이유는 무엇인가요?

## 구두 답변

`from service import Handler`는 consumer namespace에 현재 Handler 객체에 대한 별도 이름 binding을 만듭니다. 이후 `importlib.reload(service)`를 호출하면 기존 module object의 namespace에서 module code가 다시 실행되고, 그 namespace의 `Handler`가 새 class 객체로 바뀔 수 있습니다. 하지만 consumer.Handler는 module attribute를 매번 재조회하는 proxy가 아니므로 자동으로 새 class에 재바인딩되지 않습니다.

```python
# consumer.py
from service import Handler

# 다른 코드
import service, importlib
old = consumer.Handler
importlib.reload(service)
new = service.Handler
print(old is new)  # 보통 False
```

반대로 `import service` 뒤 `service.Handler`를 읽는 코드는 reload 후 module namespace의 새 이름을 볼 수 있습니다. 그래도 기존 Handler instance의 `__class__`, registry에 저장한 callback, 이미 생성한 bound method가 자동으로 새 객체로 교체되지는 않습니다. reload는 module dictionary를 유지하므로 새 실행에서 다시 대입하지 않은 이름이 남을 수 있고, reload 중 예외가 나면 namespace가 부분적으로 갱신될 수 있습니다. 공식 importlib 문서가 지적하듯 thread-safe한 일반 hot-reload 계약으로 취급하면 안 됩니다. 실제 교체는 old instance 중지, callback 제거, registry drain, 새 member 공개를 명시적으로 나눠야 합니다. 예를 들어 consumer가 `Handler`를 from-import한 채라면 reload 직후에도 old를 호출할 수 있으므로, 교체 함수가 새 module에서 constructor를 다시 얻고 old 객체를 더 이상 받지 않는 registry 상태를 확인해야 합니다. reload 성공 여부와 참조 교체 완료 여부는 별도의 상태로 기록합니다.

## 득점 포인트

- from-import 이름이 consumer namespace의 독립 참조이고 module-qualified lookup은 reload된 namespace를 다시 본다는 차이를 설명합니다.
- old/new class identity와 기존 instance·callback의 수명을 분리합니다.
- reload dictionary 보존과 실패 시 부분 상태, thread-safety caveat를 구분합니다.

## 감점 포인트

- reload가 모든 외부 alias와 instance의 class를 자동 교체한다고 하면 참조 갱신 모델을 잘못 설명한 것입니다.
- `import service`만 쓰면 old bound method와 registry도 새 코드로 바뀐다고 하면 수명 경계를 누락합니다.
- reload 실패를 완전 rollback으로 가정하면 일부 새 이름과 일부 옛 이름이 섞일 수 있는 상태를 놓칩니다.

## 더 파고들 거리

- module qualified access와 from-import alias를 각각 dependency injection 경계에서 사용할 때 테스트 격리 비용을 비교해 보세요.
- reload 가능한 plugin에서 old/new version이 동시에 살아 있는 동안 `isinstance`와 serialization을 어떻게 처리할지 정해 보세요.
