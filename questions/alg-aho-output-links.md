---
id: alg-aho-output-links
title: 한 텍스트 위치에서 짧은 패턴과 긴 패턴이 동시에 끝날 때 Aho-Corasick은 모든 출현을 어떻게 보고하나요?
difficulty: 중하
category: 알고리즘
tags:
  - Aho-Corasick
  - output link
  - 다중 매치
related:
  - algorithm-trie-prefix-memory
---
# 한 텍스트 위치에서 짧은 패턴과 긴 패턴이 동시에 끝날 때 Aho-Corasick은 모든 출현을 어떻게 보고하나요?

## 구두 답변

현재 상태가 terminal인지 확인하는 것만으로는 부족합니다. 현재 상태의 failure 경로에 있는 terminal 상태도 모두 같은 텍스트 위치에서 끝나는 패턴이기 때문입니다. `he`와 `she`를 사전에 넣고 `she`를 읽으면 마지막 위치에서 `she` 상태가 terminal이고, 그 failure suffix인 `he`도 terminal입니다. 종료 위치는 둘 다 2이지만 시작 위치는 각각 0과 1입니다.

가장 단순한 구현은 현재 상태에서 root까지 failure link를 따라가며 모든 terminal을 검사하는 것입니다. 그러나 긴 suffix 사슬을 매 위치마다 걷는 비용이 커질 수 있습니다. 그래서 각 상태에 대해 failure 경로에서 가장 가까운 terminal을 가리키는 output link 또는 exit link를 저장합니다. 검색할 때 현재 terminal을 보고한 뒤 exit link를 따라 다음 terminal로 이동하면, 실제 출현 하나마다 O(1)에 가까운 보고 비용을 부담해 `O(T+Z)` 형태로 정리할 수 있습니다. `T`는 텍스트 길이, `Z`는 결과 수입니다.

중복 문자열을 여러 ID로 등록할 수 있다면 terminal에 한 ID만 둘지 모두 반환할지 정해야 합니다. “금칙어가 하나라도 있는가”와 “모든 패턴 ID와 위치를 반환하라”는 서로 다른 출력 계약입니다.

출력 위치를 계산할 때는 각 terminal의 길이를 사용합니다. `she`가 끝난 텍스트 위치가 2라면 `she`의 시작은 `2-3+1=0`, failure chain의 `he` 시작은 `2-2+1=1`입니다. 현재 상태만 보고 `she` 하나만 반환하면 `he`를 빠뜨리고, terminal chain을 무한히 순회하면 root에 도달하는 종료 조건을 놓친 것입니다. exit link는 “가장 가까운 다음 terminal”만 연결하고, 그 링크를 반복해 모든 terminal을 방문합니다.

출력량을 비용에 넣는 것도 실무적으로 중요합니다. 금칙어 하나라도 발견하면 첫 terminal에서 중단할 수 있지만, 감사 로그에 모든 패턴과 위치를 기록하면 `Z`개의 결과를 저장·직렬화해야 합니다. 같은 텍스트에서 패턴 `a`, `aa`, `aaa`를 찾는 경우처럼 output chain이 길어지는 입력으로 p99를 확인해야 자동자 전이 비용과 결과 비용을 분리할 수 있습니다.

## 득점 포인트

- 현재 상태와 failure/output chain의 terminal을 모두 보고한다.
- `he`와 `she`의 동일 종료 위치를 계산한다.
- 출력량 Z를 시간 비용에 포함한다.

## 감점 포인트

- 현재 trie 노드 하나만 terminal이면 짧은 패턴도 자동 보고된다고 한다.
- Aho-Corasick의 검색 비용을 결과 수와 무관한 O(T)로 단정한다.

## 더 파고들 거리

- 출력 목록이 아니라 매치 개수만 필요할 때 어떤 누적값을 저장할까요?
- 문자열이 같아도 ID를 모두 의미 있는 규칙으로 보면 각각 보고하고, 집합 의미라면 terminal ID를 deduplicate해야 결과 수와 비용이 달라집니다.
