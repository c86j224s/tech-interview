---
id: mlsearch-embedding-dimension-mismatch
title: 임베딩 차원이 768에서 1024로 바뀌면 인덱스 전환에서 무엇을 먼저 확인하나요?
difficulty: 중하
category: 머신러닝
tags:
  - embedding
  - dimension
  - migration
related:
  - elasticsearch-shard-mapping
  - elasticsearch-alias-reindex-cutover
---
# 임베딩 차원이 768에서 1024로 바뀌면 인덱스 전환에서 무엇을 먼저 확인하나요?

## 구두 답변

먼저 차원만 보지 말고 encoder revision, metric, normalization, dtype을 하나의 index contract로 고정합니다. 768 문서에 256개의 0을 붙여 1024 query와 비교하는 것은 배열 길이만 맞출 뿐 두 모델의 좌표 의미와 학습 분포를 맞추지 않으므로 기본 전환 전략으로 쓰지 않습니다. 이 판단은 scikit-learn cosine API의 규칙이 아니라 검색 서비스의 application contract입니다.

전환 trace는 old index의 1,000,000건, new schema 선언, dual-write 또는 backfill, 실패 4,000건, 성공 996,000건처럼 수량을 남기는 데서 시작합니다. backfill 문서는 모두 model revision 1024를 사용하고 query도 같은 revision만 new index로 보냅니다. 작은 sample에서 exact brute-force와 ANN의 top-K를 비교하고, shadow traffic에서 recall@K, nDCG, latency, zero 비율, old/new overlap을 측정합니다. raw score는 공간과 metric이 다르면 합치지 않고, 동시 제공이 필요하면 결과 source를 표시한 rank-level 결합으로 제한합니다.

cutover는 새 alias를 한 번에 바꾸는 행동이 아니라 오류율·recall·지연 기준과 rollback 조건을 가진 배포 단계입니다. 기준을 통과하면 alias를 new로 바꾸고 old를 보존해 되돌릴 수 있게 하며, 실패율이나 exact 대비 recall이 기준을 넘으면 old alias로 복귀합니다. index mapping·vendor 기본값은 사용 중인 버전의 실제 문서로 확인하고, 차원 전환 자체를 cosine 문서의 보장처럼 말하지 않습니다.

전환 중에는 document와 query가 다른 revision으로 만나는 요청을 오류로 막거나 old 경로로 명시적으로 보냅니다. 996,000건만 채워진 new index를 전체 서비스의 기본으로 바꾸지 않고, backfill 완료율과 실패 재처리 결과를 확인합니다. rollback 뒤에도 새 문서가 old와 new 중 어느 곳에 쓰였는지 추적해야 재전환 때 누락과 중복을 피할 수 있습니다.

## 득점 포인트

- dimension·revision·metric·normalization을 schema metadata로 묶습니다.
- backfill 성공/실패 수, exact-vs-ANN, shadow 지표, alias cutover를 순서대로 제시합니다.
- zero-padding과 서로 다른 score 합산을 거부하는 이유를 application contract로 밝힙니다.

## 감점 포인트

- 768과 1024를 zero-padding하면 같은 공간이라고 단정합니다.
- cosine 문서가 alias migration과 model compatibility를 보장한다고 인용합니다.
- backfill이나 rollback 조건 없이 alias만 바꿉니다.

## 더 파고들 거리

- dual-write 중 old/new query 비율과 revision mismatch를 관찰할 로그 스키마를 설계해 보세요.
- 새 encoder가 좋아 보여도 ANN recall 저하인지 모델 품질 저하인지 분리할 canary를 정해 보세요.
