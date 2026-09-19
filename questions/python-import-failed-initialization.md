---
id: python-import-failed-initialization
title: 모듈 초기화 중 예외가 나면 sys.modules와 이미 import한 하위 모듈은 어떻게 남나요?
difficulty: 중하
category: 언어·런타임
tags:
  - Python
  - import
  - 언어·런타임
related:
  - python-gil-parallelism
---
# 모듈 초기화 중 예외가 나면 sys.modules와 이미 import한 하위 모듈은 어떻게 남나요?

## 구두 답변

import 중인 모듈이 top-level에서 예외를 내면 import machinery는 실패한 주 모듈을 완전 초기화된 것처럼 재사용하지 않도록 보통 해당 이름의 `sys.modules` entry를 제거합니다. 그러나 그 모듈이 예외 전에 성공적으로 import한 하위 모듈이나 그 하위 모듈의 외부 side effect까지 함께 rollback한다고 보면 안 됩니다.

상태를 `main → helper`로 두겠습니다. T0에는 두 key가 없습니다. T1에 main이 cache에 들어가고 helper를 import합니다. T2에 helper가 완전히 초기화되어 cache에 남고 registry에 handler를 하나 등록합니다. T3에 main의 설정 검증이 실패하면 main entry는 제거될 수 있지만 helper entry와 handler, logging 등록, 임시 파일 같은 side effect는 남을 수 있습니다. T4에 main을 다시 import하면 새 main object가 생기지만 helper는 cache hit로 재사용되어 helper top-level이 다시 실행되지 않을 수 있습니다. 그러면 재시도는 “깨끗한 처음부터”가 아니라 부분적으로 이전 상태를 가진 시도입니다.

따라서 import-time에 외부 연결·registry 등록을 많이 넣기보다 명시적 startup 단계와 idempotent cleanup을 둡니다. 실패 직후 `main`과 `helper`의 cache 존재를 따로 확인하고, registry count·handler identity·외부 자원 상태도 독립적으로 검사해야 합니다. 실패한 주 모듈만 제거된다는 일반 흐름과 특정 loader/package 구성의 세부를 구분해야 하며, side effect 자동 취소를 언어 보장으로 주장하면 안 됩니다. 관찰표에는 T3 직후 `main in sys.modules`, `helper in sys.modules`, registry 길이를 함께 남겨야 재시도가 새 module 생성 때문인지 helper 재사용 때문인지 판별할 수 있습니다. cleanup이 실패하면 같은 import를 반복할수록 handler가 누적될 수 있습니다.

## 득점 포인트

- 실패한 주 모듈의 cache cleanup과 성공한 helper의 잔존을 T0~T4로 나눠 설명합니다.
- cache 잔존과 logging·registry·파일 같은 외부 side effect rollback은 별개임을 말합니다.
- 재시도에서 helper가 cache hit로 재사용될 수 있다는 결과를 연결합니다.

## 감점 포인트

- 예외가 나면 `sys.modules` 전체가 비워진다고 하면 module별 cleanup 경계를 틀리게 설명한 것입니다.
- 하위 모듈의 handler와 외부 자원이 자동 rollback된다고 하면 import를 transaction처럼 오해한 것입니다.
- 두 번째 import가 모든 top-level 초기화를 처음부터 반복한다고 단정하면 cache 재사용을 놓칩니다.

## 더 파고들 거리

- 실패한 startup을 다시 시도하기 전 registry와 logging handler를 멱등적으로 정리하는 API를 설계해 보세요.
- import-time 초기화와 process startup 초기화를 분리했을 때 장애 복구와 관측 지점이 어떻게 달라지는지 비교해 보세요.
