---
id: mlsearch-transformer-causal-padding-mask
title: padding mask와 causal mask는 어떤 attention edge를 각각 차단하나요?
difficulty: 중하
category: 머신러닝
tags:
  - Transformer
  - attention mask
  - sequence
related:
  - agent-context-engineering
  - ml-loss-objective
---
# padding mask와 causal mask는 어떤 attention edge를 각각 차단하나요?

## 구두 답변

padding mask는 batch 길이를 맞추기 위해 넣은 fake PAD key를 읽지 못하게 하고, causal mask는 autoregressive 위치가 미래 key를 읽지 못하게 합니다. 길이 3인 입력을 길이 5로 padding하면 위치 3·4의 PAD 열을 차단하고, causal mask에서는 query `t`가 key `s>t`를 차단합니다. decoder에서는 두 제약을 결합하지만, query PAD의 loss를 무시하는 것과 PAD key를 가리는 것은 별개입니다.

길이 4 causal matrix는 `q0:[1,0,0,0]`, `q1:[1,1,0,0]`, `q2:[1,1,1,0]`, `q3:[1,1,1,1]`입니다. padding된 `[A,B,C,PAD]`라면 실제 query들이 마지막 PAD key를 읽지 않도록 별도 key mask가 필요합니다. 금지 score에 큰 음수를 더해 softmax 기여를 0에 가깝게 만들지만, framework마다 True/False의 의미, broadcast shape, additive/bool dtype 계약이 다르므로 확인하겠습니다.

검증은 batch padding과 causal을 작은 score matrix로 각각 켠 뒤 허용 edge를 표로 확인합니다. all-masked row는 softmax NaN이나 잘못된 분포를 만들 수 있으므로, 실제 가능한 row에 적어도 하나의 key가 남는지도 assertion을 둡니다. 단순히 “mask가 있다”가 아니라 query-key 축과 position 방향이 맞는지 봅니다.


작은 tensor shape로 검증합니다. mask를 `[batch=2,heads=1,query=4,key=4]`로 broadcast한다고 할 때 A가 오른쪽 PAD를 가진 `[A,B,C,PAD]`이면 q2의 causal 허용 key는 0,1,2이고 PAD key 3은 padding mask로 제거됩니다. q3가 PAD query라면 loss만 무시하는지, attention row 자체를 계산하는지는 모델 계약으로 분리해야 합니다. boolean True가 keep인지 block인지는 framework마다 다를 수 있으므로 실제 mask dump와 expected edge를 비교하고 all-masked row를 허용하지 않습니다. Transformer 논문 abstract만으로 이 API 의미를 확정하지 않습니다.
## 득점 포인트

- padding은 fake token, causal은 미래 position을 막는다는 축별 차이를 설명한다.
- 길이 4 causal matrix와 padding key 열을 구체적으로 보여 준다.
- broadcast shape·dtype·True/False 의미·all-masked row를 검증한다.

## 감점 포인트

- causal mask가 PAD token만 막는다고 말한다.
- loss에서 PAD label을 무시하면 attention PAD leakage도 자동 해결된다고 한다.
- framework mask의 boolean 방향과 Q/K 축을 확인하지 않는다.

## 더 파고들 거리

- 왼쪽 padding과 오른쪽 padding에서 position ID와 causal mask를 어떻게 맞추겠습니까?
- decoder prefill과 한 token decode에서 mask shape를 어떻게 다르게 broadcast하겠습니까?
- all-masked row를 허용하지 않으면서 variable-length batch를 처리하는 방식을 말해 보세요.
