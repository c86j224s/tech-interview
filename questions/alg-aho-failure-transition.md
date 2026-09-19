---
id: alg-aho-failure-transition
title: Aho-Corasick에서 현재 trie 간선이 없을 때 failure link를 따라가면 무엇을 보존하나요?
difficulty: 중하
category: 알고리즘
tags:
  - Aho-Corasick
  - trie
  - failure link
related:
  - algorithm-trie-prefix-memory
---
# Aho-Corasick에서 현재 trie 간선이 없을 때 failure link를 따라가면 무엇을 보존하나요?

## 구두 답변

failure link를 따라가면 지금까지 읽은 텍스트의 suffix 중에서 사전 패턴의 접두로 해석할 수 있는 가장 긴 상태를 보존합니다. 부모로 돌아가는 링크가 아니며, 이미 읽은 문자를 버리고 root에서 다시 시작하는 것도 아닙니다. 현재 상태에서 다음 문자의 간선이 없으면 failure 상태로 이동한 뒤 같은 문자를 다시 전이합니다.

예를 들어 사전에 `ab`와 `bc`가 있고 상태가 `ab`일 때 `c` 간선이 없다고 하겠습니다. `ab`의 suffix 중 trie 상태인 `b`로 failure한 뒤, `b`에서 `c`를 읽어 `bc` 상태로 갑니다. root로만 초기화하면 텍스트 끝의 `bc`를 놓칩니다. 이 상태 불변식은 “현재 상태가 처리된 텍스트의 suffix 중 가장 긴 사전 prefix”라는 한 문장으로 점검할 수 있습니다.

링크 구축은 부모와 마지막 간선 문자 `c`에 대해 `go(link[parent], c)`를 이용합니다. root와 root의 자식은 root를 가리키며, 더 깊은 노드는 짧은 깊이의 link와 전이가 먼저 계산되어야 합니다. 루프가 종료되지 않는다면 root의 자기 링크나 실패 전이 정의가 잘못된 것입니다.

실제 상태 전이에서 텍스트 인덱스는 failure를 따라가도 증가하지 않습니다. 문자 `c` 하나를 소비한 뒤, 현재 상태에서 가능한 suffix 상태를 찾는 동안 상태 번호만 바꾸고, 최종적으로 `go(state,c)`를 한 번 결정합니다. 이 문자를 다시 소비하는 것으로 처리하면 같은 문자를 두 번 읽은 것처럼 되어 결과 위치가 틀어집니다. 구현이 while로 failure를 따라간다면 root에서 `go(root,c)`를 정하고 루프를 종료하는 경계를 명확히 해야 합니다.

`ab`와 `bc` 예에서는 텍스트 `abc`의 세 번째 문자 `c`를 이미 읽은 상태에서 `ab`에서 `b`로 내려간 다음 `bc`로 전이합니다. 결과 상태가 `bc`이므로 terminal이면 시작 위치는 1입니다. failure가 텍스트를 뒤로 이동시키는 것이 아니라 상태 표현만 바꾸고 같은 입력 문자를 재해석한다는 점이 핵심입니다.

## 득점 포인트

- failure가 longest proper suffix 상태를 보존한다고 설명한다.
- `ab`에서 `bc`로 이어지는 구체적인 fallback을 추적한다.
- failure를 부모 링크와 구분한다.

## 감점 포인트

- 간선이 없으면 언제나 root로 돌아간다고 한다.
- failure link가 trie 부모를 가리킨다고 오해한다.

## 더 파고들 거리

- BFS 구축에서 깊이 순서가 필요한 이유는 무엇인가요?
- failure를 따라가는 동안 위치는 증가하지 않고, 문자 하나를 최종 상태로 소비했을 때만 텍스트 위치를 한 번 증가시킵니다.
