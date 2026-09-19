---
id: columnar-vectorized-execution
title: 컬럼 저장 압축·벡터화 실행
topic: 데이터베이스
summary: >-
  열 단위 저장과 dictionary·run-length·bit packing 계열 인코딩이 선택적 읽기와 벡터 단위 실행에 어떤 경로로
  연결되는지 설명합니다.
questionIds: []
prerequisites:
  - cacheline-layout
  - query-plan-evidence
related:
  - external-sort
reviewedAt: '2026-09-19'
---
# 컬럼 저장 압축·벡터화 실행

컬럼형 저장은 한 행의 모든 필드를 인접하게 두는 대신 같은 열의 값을 모읍니다. 분석 query가 30개 열 중 3개만 읽거나 낮은 선택률의 조건을 적용하면 불필요한 payload 이동과 decode를 줄일 기회가 생깁니다. 다만 Parquet 같은 format이 column-oriented라는 사실과, 특정 reader가 selection vector·late materialization·SIMD operator를 지원한다는 사실은 별개입니다. 이 장은 format-level encoding과 engine-level execution을 분리해 설명합니다.

## 파일 계층

Parquet format specification의 파일 구조는 row group 안에 column chunk가 있고, column chunk가 page들로 나뉘는 단위를 사용합니다. 파일 metadata와 page header에는 위치와 크기 정보가 있어 reader가 필요한 열과 page를 찾는 출발점이 됩니다. 이 메타데이터가 존재한다고 해서 모든 reader가 page index나 predicate statistics로 skip한다는 뜻은 아닙니다. 실제 skip은 writer가 통계를 기록했는지, reader가 해당 기능을 켰는지, filter가 page 경계와 맞는지 확인해야 합니다.

100만 행에서 status, country, amount만 읽는 projection이라면 reader는 다른 열의 chunk를 열지 않을 수 있습니다. 그래도 row group 단위 prefetch, page 압축 해제, definition/repetition level 처리, 결과 materialization은 남습니다. 저장 layout과 query plan을 한 문장으로 합치지 않는 것이 첫 번째 경계입니다.

## Dictionary 인코딩

Parquet Encodings specification은 dictionary page에 column의 값들을 저장하고 data page에는 각 값의 integer ID를 RLE/bit-packing hybrid로 저장하는 방식을 설명합니다. dictionary가 크기나 distinct value 수에서 커지면 plain encoding으로 fallback할 수 있으며, dictionary page는 column chunk의 data page보다 먼저 기록됩니다. 따라서 dictionary는 낮은 cardinality page에서 후보가 되지만 “모든 문자열이 자동으로 작아진다”는 보장은 아닙니다.

status 100만 행이 네 값이고 평균 문자열 8바이트, 단순 metadata 1바이트라고 가정하면 원문 모델은 `1,000,000×(8+1)=9,000,000` decimal bytes입니다. 네 ID를 2bit로만 저장하면 `1,000,000×2/8=250,000` bytes입니다. 이 계산은 dictionary entry, data-page bit-width byte, RLE run header, page header, repetition/definition level, codec을 제외한 설명용 하한입니다. 실제 파일 크기가 0.25MB라는 뜻이 아닙니다.

```diagram
{"title":"인코딩에서 실행 batch까지","caption":"format의 dictionary ID와 engine의 selection 전달을 구분한 흐름입니다.","rows":[[{"id":"raw","label":"원시 열","detail":["status 반복 값"]}],[{"id":"dict","label":"Dictionary page","detail":["값을 한 번 저장"]},{"id":"ids","label":"Data page IDs","detail":["RLE·bit-packing"]}],[{"id":"decode","label":"Reader decode","detail":["page 경계 확인"]}],[{"id":"sel","label":"Selection","detail":["engine 지원 시"]}],[{"id":"batch","label":"Operator batch","detail":["필요 열 조립"]}]],"edges":[{"from":"raw","to":"dict","label":"값 등록"},{"from":"raw","to":"ids","label":"ID 기록"},{"from":"dict","to":"decode","label":"dictionary read"},{"from":"ids","to":"decode","label":"ID unpack"},{"from":"decode","to":"sel","label":"조건 평가"},{"from":"sel","to":"batch","label":"선택 전달"}]}
```

## RLE와 bit packing

RLE는 같은 값이 연속할 때 값과 run 길이를 줄이는 방식입니다. `pending`이 100,000행 연속이면 짧은 run으로 표현할 수 있지만 `pending,paid,pending,paid`처럼 번갈아 나오면 run이 길어지지 않습니다. Encodings 문서는 dictionary index, boolean, repetition/definition level에 RLE를 적용할 수 있다고 설명합니다. bit-packing은 작은 ID를 필요한 폭으로 묶어 2bit, 3bit 같은 정수 표현을 만듭니다. encoding과 compression codec은 단계가 다르므로 ID 변환 후 codec을 다시 적용할 수 있습니다.

## 벡터 실행

벡터화 실행은 한 행마다 함수 호출하는 대신 column array 또는 batch를 받아 여러 값을 한 번에 처리하는 engine 전략입니다. filter 열을 읽어 100,000행 중 1,000행이 통과했다고 하더라도, format은 그 filter가 전체 page를 읽어야 했는지 알려줄 뿐 selection vector가 다음 operator로 전달되거나 payload를 늦게 materialize하는지는 보장하지 않습니다. reader/operator가 지원한다면 1,000개의 row index나 bitset을 유지하고 넓은 payload를 그 위치에서만 조립하는 late materialization이 가능합니다.

선택률 1%의 sparse index는 `1,000×4=4,000` bytes라는 단순 모델을 가집니다. 100,000행 bitset은 `100,000/8=12,500` bytes이고, byte-per-row mask를 쓰면 100,000 bytes입니다. 선택률 99%면 sparse index가 오히려 전체 vector보다 복잡할 수 있습니다. UDF, branch-heavy expression, join이 selection을 받아들이지 못하는 경우에는 다시 payload를 조립하는 비용이 생깁니다.

## 압축 codec

encoding은 값의 표현을 바꾸고 codec은 그 결과 byte stream을 압축합니다. 원본 scan 4GB에서 codec A가 4:1이면 약 1GB를 읽고, codec B가 2:1이면 2GB를 읽습니다. network 또는 storage가 1GB/s이고 CPU 여유가 충분하면 A의 read byte 절감이 유리할 수 있습니다. 반대로 A의 decode CPU가 B의 두 배이고 worker CPU가 이미 90%라면 동시 query p99와 first-result가 악화될 수 있습니다. 이 수치는 병목 모델이지 codec benchmark가 아닙니다.

## Batch working set

batch를 1K에서 64K로 늘리면 function call, branch, iterator 경계 비용을 여러 행에 나눌 수 있고 일부 vector primitive가 긴 배열을 처리하기 쉬워집니다. 반면 사용 열 네 개가 각각 행당 8바이트라면 원시 working set은 1K에서 `1,000×8×4=32KB`, 64K에서 `64,000×8×4=2,048,000` bytes입니다. validity bitmap, dictionary ID, compressed buffer, selection vector, aggregate state가 더해지므로 2MB가 특정 cache에 맞는다고 단정하지 않습니다. 큰 batch는 전체 scan throughput을 높여도 interactive time-to-first-result를 늦출 수 있습니다.

## 검증 절차

status cardinality 4와 100,000, 긴 동일 run과 교차 분포, 선택률 1%·50%·99%, batch 1K·8K·64K를 같은 row group으로 준비합니다. 결과 row와 aggregate를 먼저 비교한 뒤 page read, decoded bytes, decode CPU, operator CPU, peak memory, cache miss, first-result, p95/p99를 기록합니다. dictionary fallback은 page별 distinct count와 실제 encoding metadata를 확인하고, vectorization은 plan 또는 engine trace로 지원 여부를 확인합니다.

## 비용 한계

columnar는 분석 projection과 scan에 강하지만 작은 point update와 한 행 조회에서는 row-oriented layout이 더 적합할 수 있습니다. dictionary를 강제하면 cardinality가 증가한 page에서 dictionary page와 fallback 판단 비용이 생깁니다. batch를 키우면 throughput만 보고 memory pressure와 p99를 놓칠 수 있습니다. format specification이 말하는 사실과 reader implementation의 동작을 구분해야 재현 가능한 결론이 됩니다.

## 참고 자료

- Apache Parquet File Format, https://github.com/apache/parquet-format/blob/master/README.md, 2026-09-19 기준 format repository 출발점. 이 batch에서 직접 읽은 raw Encodings 본문은 dictionary page, RLE/bit-packing, fallback을 뒷받침합니다.
- Apache Parquet Encodings, https://github.com/apache/parquet-format/blob/master/Encodings.md, 2026-09-19 raw 본문 읽음. dictionary page/data page 구조와 integer ID encoding을 직접 확인했습니다.
- Apache Parquet Overview, https://parquet.apache.org/docs/overview/, 2026-09-19 읽음. column-oriented format 및 encoding/compression 목적의 근거로만 사용했습니다.
- vectorized execution, selection vector, codec default, cache batch 효과는 특정 reader/operator의 구현 계약입니다. 이 batch에서는 해당 runtime을 실행하지 않았고, Parquet format source만으로 이를 보장한다고 쓰지 않았습니다.
