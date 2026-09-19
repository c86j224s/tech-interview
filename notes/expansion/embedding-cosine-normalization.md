---
id: embedding-cosine-normalization
title: 임베딩의 코사인 유사도와 정규화
topic: 머신러닝
summary: >-
  벡터 방향과 크기를 분리해 cosine·dot·L2 normalization의 순위 계약과 zero
  vector·dimension·hubness 경계를 설명합니다.
questionIds: []
prerequisites:
  - classification-metrics
  - loss-objective
  - data-splits
related:
  - search-mapping
  - top-k-ranking
reviewedAt: '2026-09-19'
---
# 임베딩의 코사인 유사도와 정규화

## 벡터 공간 계약

임베딩 검색에서 먼저 고정해야 할 것은 “어떤 숫자가 가까움을 뜻하는가”입니다. query `q`와 문서 벡터 `d`의 dot product는 `q·d`이고, cosine은 `q·d/(||q||₂||d||₂)`입니다. 따라서 dot은 방향뿐 아니라 두 벡터의 크기도 순위에 반영하고, cosine은 방향의 일치만 남깁니다. encoder revision, 차원, dtype, metric, 정규화 여부를 응답과 인덱스 메타데이터에 함께 넣지 않으면 숫자가 있어도 같은 공간의 비교인지 알 수 없습니다.

scikit-learn의 cosine 문서는 cosine을 L2-normalized dot product로 설명합니다. 이 문서가 보장하는 것은 metric의 수학적 정의이지, 특정 ANN 엔진의 zero norm 반환값이나 모델 간 좌표 의미까지는 아닙니다. 후자는 서비스 계약으로 따로 검증해야 합니다.

## Dot과 cosine의 수치 추적

`q=[1,0]`, `a=[3,0]`, `b=[1,1]`를 계산해 보겠습니다. dot은 `q·a=3`, `q·b=1`이므로 a가 먼저입니다. 반면 `cos(q,a)=3/(1·3)=1`, `cos(q,b)=1/(1·√2)=0.7071`이므로 역시 a가 먼저지만, 이는 a의 방향이 정확히 같기 때문입니다. `c=[0.4,0]`를 넣으면 dot은 c가 0.4라 a가 크게 앞서고, cosine은 c도 1이라 a와 동률입니다. 이 동률은 정규화가 문서 길이나 magnitude를 relevance에서 제거한 결과입니다.

순위가 실제로 뒤집히는 반례도 필요합니다. `q=[1,0]`, `a=[2,2]`, `b=[1,0]`이면 dot은 a가 2, b가 1이라 a를 고릅니다. 하지만 cosine은 a가 `2/√8=0.7071`, b가 1이므로 b가 앞섭니다. 정규화 전후 결과가 다르다는 말은 구현 오류가 아니라 목적 함수가 달라졌다는 뜻입니다.

## 정규화 파이프라인

각 벡터에 대해 shape와 dimension을 먼저 확인하고, 모든 원소가 유한한지 검사한 뒤 norm을 계산합니다. `norm > ε`인 경우에만 `v / norm`을 저장합니다. query와 document에 서로 다른 전처리를 적용하면 “둘 다 정규화했다”는 표면만 같고 실제 공간은 달라집니다. 인덱스가 내부적으로 정규화하는지, 저장 시 사전 정규화가 필요한지는 사용 중인 엔진의 버전·매핑 계약으로 확인하고 작은 fixture로 대조합니다.

사전 정규화는 검색 시 곱셈을 단순하게 하고 exact dot과 cosine의 일치를 재현하기 쉽습니다. 대신 원래 norm을 버리면 길이·신뢰도 신호를 사후에 분석할 수 없습니다. 그 신호가 필요하다면 `raw_norm`을 별도 필드로 보존하되 similarity에 몰래 더하지 않습니다. 원본 norm이 문서 길이만 반영한다면 dot의 장점이 아니라 길이 편향일 수 있습니다.

## Zero vector 경계

zero vector는 norm이 0이므로 cosine이 수학적으로 정의되지 않습니다. 읽은 scikit-learn 문서만으로 특정 라이브러리가 NaN, 0, 예외 중 무엇을 반환한다고 일반화할 수 없습니다. 안전한 서비스 경로는 입력 벡터가 zero·NaN·infinite이면 query를 `422 invalid_embedding`으로 거절하거나, 제품이 허용한 명시적 fallback(키워드 검색 등)으로 보내는 것입니다. document의 경우 색인 거절·격리 큐·검색 제외 중 하나를 정책으로 정하고 reject 원인을 카운트합니다.

`v/(norm+ε)`로 나눈 값을 정상 relevance로 저장하는 방식은 zero의 의미를 임의로 바꿉니다. ε은 부동소수점 경계를 다루는 도구일 뿐 정의되지 않은 입력을 유효한 방향으로 만들지 않습니다. fixture에는 zero, 매우 작은 norm, NaN, 차원 하나 부족한 벡터를 넣고 상태 코드와 로그가 기대대로 나오는지 확인합니다.

## 차원과 모델 전환

768차원 모델에서 1024차원 모델로 바꿀 때 zero-padding으로 한쪽을 늘리는 것은 두 모델의 좌표 의미를 맞춰 주지 않습니다. 새 인덱스 스키마에 `model_revision`, `dimension=1024`, metric, normalization, dtype을 선언하고, 동일 revision으로 문서를 backfill합니다. 예를 들어 old 1,000,000건 중 996,000건을 성공시켰다면 나머지 4,000건의 실패 원인과 query의 old/new 비율을 별도 지표로 둡니다.

작은 표본에서는 exact brute-force top-K와 ANN top-K를 비교해 score 계산과 근사 탐색을 분리합니다. shadow traffic에서 recall@K, nDCG, latency, old/new overlap, zero 비율을 비교한 뒤 alias를 전환합니다. old와 new raw score를 산술 평균하지 말고, 두 결과가 함께 필요한 동안에는 rank-level 결합을 사용하며 결과의 space를 표시합니다. rollback은 새 revision의 오류율·recall·지연이 사전 기준을 넘을 때 alias를 old로 되돌리는 방식이어야 합니다.

## Hubness 진단

소수 문서가 많은 query의 top-K에 반복되는 현상을 바로 cosine 오류라고 부르면 안 됩니다. cosine은 norm 차이만 제거하므로, 모든 벡터가 특정 방향에 몰리는 anisotropic 분포나 중복 문서는 남습니다. 10,000개 query의 top-10이면 총 출현 수는 100,000입니다. 예를 들어 문서 X가 8,000회, Y가 6,000회, 나머지 90,000회가 고르게 나타났다면 X/Y의 빈도 자체를 조사 대상으로 기록합니다.

먼저 exact brute-force에서도 X/Y가 반복되는지 확인합니다. exact와 ANN이 모두 같으면 공간·데이터 현상을 우선 의심하고, ANN에서만 반복되면 탐색 파라미터, graph, shard routing, filter, quantization을 대조합니다. norm histogram, 평균 각도, duplicate rate, 언어·tenant별 recall을 함께 보면 한 집단에만 몰린 문제를 찾을 수 있습니다. 보편적인 “출현률 몇 퍼센트면 bug” 임계값은 없으므로 labeled query와 exact oracle을 기준으로 운영선을 정합니다.

## 비용과 검증 표

정규화는 벡터 하나당 `O(D)`, brute-force query는 `O(ND)`, 저장 공간은 대략 `N·D·bytes`입니다. 1024차원으로 늘리면 저장·메모리 대역폭·ANN 구축 시간이 함께 증가합니다. 평가 파일에는 query ID, encoder revision, dimension, normalization flag, metric, index revision, exact score, ANN score를 저장합니다. top-K overlap만 높고 score가 다를 수 있으므로 두 지표를 분리합니다.

### 실행 가능한 산술 검산

아래 계산은 설명용 Python 산술이며 특정 검색 엔진 실행 결과가 아닙니다.

```python
import math
q=(1,0); a=(2,2); b=(1,0)
def dot(x,y): return sum(i*j for i,j in zip(x,y))
def cos(x,y): return dot(x,y)/(math.hypot(*x)*math.hypot(*y))
print(dot(q,a), dot(q,b), cos(q,a), cos(q,b))
# 2 1 0.7071067811865475 1.0
```

이 출력은 dot에서는 a, cosine에서는 b가 앞선다는 상태를 확인합니다. 실제 시스템에서는 tolerance, tie policy, invalid-input policy까지 테스트에 포함해야 합니다.

```diagram
{"title":"임베딩 비교의 계약 경로","caption":"정규화 여부와 모델 공간을 먼저 확인한 뒤 유사도를 계산하고 exact 기준과 ANN 결과를 대조합니다.","rows":[[{"id":"model","label":"모델 공간","detail":["revision · dimension","dtype 기록"]}],[{"id":"check","label":"입력 검사","detail":["finite · shape","norm > epsilon"]}],[{"id":"metric","label":"metric 선택","detail":["dot 또는 cosine","query·문서 동일"]}],[{"id":"oracle","label":"검색 검증","detail":["exact·ANN 대조","recall·latency"]}]],"edges":[{"from":"model","to":"check","label":"같은 공간"},{"from":"check","to":"metric","label":"유효 벡터"},{"from":"metric","to":"oracle","label":"순위 생성"}]}
```

## 참고 자료와 확인 경계

- https://scikit-learn.org/stable/modules/metrics.html#cosine-similarity — cosine이 L2-normalized dot product라는 정의를 확인했습니다. zero norm의 구체적인 런타임 반환, ANN 엔진의 dimension schema, hubness 진단 임계값은 이 문서가 정하지 않으므로 서비스 제안으로 구분했습니다.
- https://scikit-learn.org/stable/modules/clustering.html#k-means — 본 장의 직접 근거는 아니며 유사도와 별개인 K-means 문서입니다. 모델·인덱스 전환은 애플리케이션 계약으로 다뤘습니다.
