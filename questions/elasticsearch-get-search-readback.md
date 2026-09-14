---
id: "elasticsearch-get-search-readback"
title: "저장한 문서를 ID GET으로는 보는데 검색에는 없습니다. read-after-write 화면을 어떤 경로로 구성하나요?"
difficulty: "중하"
category: "데이터베이스"
tags: ["Elasticsearch","refresh","검색","심화 질문"]
related: ["elasticsearch-refresh-visibility","db-read-replica-consistency"]
promotedFrom: {"id":"elasticsearch-refresh-visibility","prompt":"ID 기반 GET과 검색의 가시성 계약을 테스트해 보세요."}
---

# 저장한 문서를 ID GET으로는 보는데 검색에는 없습니다. read-after-write 화면을 어떤 경로로 구성하나요?

## 구두 답변

Elasticsearch의 ID GET과 검색은 가시성 경로가 다를 수 있습니다. 알려진 ID의 저장 직후 확인은 GET이나 저장 응답을 이용하고 반드시 검색 결과에 나타나야 할 때만 refresh 대기를 검토합니다.

색인 성공을 검색 즉시 노출과 동일시하지 않고 원본 저장·색인 반영·검색 refresh를 따로 표시합니다. replica·routing·버전과 삭제·동시 수정도 시험합니다. 모든 쓰기에 강제 refresh를 넣어 작은 segment·merge 비용을 늘리기 전에 기능 요구를 구분합니다.

## 득점 포인트

- Elasticsearch의 ID GET과 검색은 가시성 경로가 다를 수 있습니다. 알려진 ID의 저장 직후 확인은 GET이나 저장 응답을 이용하고 반드시 검색 결과에 나타나야 할 때만 refresh 대기를 검토합니다.
- 모든 쓰기에 강제 refresh를 넣어 작은 segment·merge 비용을 늘리기 전에 기능 요구를 구분합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: Elasticsearch의 ID GET과 검색은 가시성 경로가 다를 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: Elasticsearch가 문서 저장 성공을 반환했는데 바로 실행한 검색에는 문서가 없습니다. 왜 지연되며 즉시 확인이 필요한 화면은 어떻게 만드나요?](/tech-interview/questions/elasticsearch-refresh-visibility/)
