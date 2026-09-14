---
id: "elasticsearch-wait-for-refresh-cost"
title: "Elasticsearch 쓰기에 refresh=wait_for와 강제 refresh를 적용하면 대기·세그먼트·병합 비용이 어떻게 다른가요?"
difficulty: "중하"
category: "데이터베이스"
tags: ["Elasticsearch","refresh","검색","심화 질문"]
related: ["elasticsearch-refresh-visibility","db-read-replica-consistency"]
promotedFrom: {"id":"elasticsearch-refresh-visibility","prompt":"`refresh=wait_for`와 즉시 강제 refresh의 비용을 비교해 보세요."}
---

# Elasticsearch 쓰기에 refresh=wait_for와 강제 refresh를 적용하면 대기·세그먼트·병합 비용이 어떻게 다른가요?

## 구두 답변

refresh=wait_for는 보통 요청의 변경이 refresh로 보일 때까지 기다려 즉시 강제 refresh 비용을 줄이는 선택입니다. 강제 refresh는 작은 segment와 후속 merge 부담을 늘릴 수 있습니다.

설정·listener 한도·refresh 비활성·서버 버전에 따라 동작을 확인합니다. 모든 쓰기에 대기를 붙이지 말고 저장 직후 검색이 필요한 요청에만 적용합니다. ID GET·원본 응답 표시와 비교하며 검색 노출 지연·색인 처리량·segment·I/O를 측정합니다.

## 득점 포인트

- refresh=wait_for는 보통 요청의 변경이 refresh로 보일 때까지 기다려 즉시 강제 refresh 비용을 줄이는 선택입니다. 강제 refresh는 작은 segment와 후속 merge 부담을 늘릴 수 있습니다.
- ID GET·원본 응답 표시와 비교하며 검색 노출 지연·색인 처리량·segment·I/O를 측정합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: refresh=wait_for는 보통 요청의 변경이 refresh로 보일 때까지 기다려 즉시 강제 refresh 비용을 줄이는 선택입니다.

## 더 파고들 거리

- [기본 상황과 비교: Elasticsearch가 문서 저장 성공을 반환했는데 바로 실행한 검색에는 문서가 없습니다. 왜 지연되며 즉시 확인이 필요한 화면은 어떻게 만드나요?](/tech-interview/questions/elasticsearch-refresh-visibility/)
