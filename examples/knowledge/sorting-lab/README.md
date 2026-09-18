# 정렬 알고리즘 실습

이 패키지는 비교 기반 정렬 다섯 가지를 의존성 없이 실행하고, 단계 trace·비교 횟수·쓰기 횟수·정렬 계약을 함께 확인하는 실습입니다. 코드는 `examples/knowledge/sorting-lab/`에 있습니다.

## 포함 범위

- 병합 정렬, 힙 정렬, 삽입 정렬, 선택 정렬, 버블 정렬
- 오름차순 비교자와 key 기반 비교자
- strict weak ordering과 total order를 구분하는 유한 샘플 진단기
- 중복 키의 안정성 검사, 입력 다중집합 보존 검사
- 값이 작은 길이 0부터 4까지의 모든 입력에 대한 exhaustive reference 비교
- 역순 입력의 worst-case shape와 거의 정렬된 삽입 정렬 비교
- 단계별 trace, 의도적 비추이 비교자 실패 주입, 측정 가능한 benchmark harness

코드는 Python 표준 라이브러리만 사용합니다. 외부 dependency와 네트워크가 없으므로 별도 설치나 pin 파일은 필요하지 않습니다. 벤치마크 숫자는 실행할 때 얻는 값이며 문서에 미리 채우지 않습니다.

## 재현 명령

저장소 루트에서 실행합니다.

```bash
python3 examples/knowledge/sorting-lab/sorting_lab.py --test
python3 examples/knowledge/sorting-lab/sorting_lab.py --trace merge --input 5,1,4,2
python3 examples/knowledge/sorting-lab/sorting_lab.py --failure-demo
python3 examples/knowledge/sorting-lab/sorting_lab.py --benchmark merge --sizes 16,64,128 --repeats 3
python3 examples/knowledge/sorting-lab/sorting_lab.py --benchmark heap --sizes 16,64,128 --repeats 3
```

회귀 검사는 다음 명령으로 반복할 수 있습니다.

```bash
python3 examples/knowledge/sorting-lab/sorting_lab.py --test
```

`--trace`의 각 줄은 이벤트, 현재 배열, 불변식 설명을 보여 줍니다. `--failure-demo`는 `0<1<2<0`인 순환 비교자를 주입해 validator가 비추이를 진단하는지 확인합니다. `--benchmark`는 지정한 입력 크기와 반복 수에서 `mean_ns`, 비교 수, 쓰기 수를 CSV로 출력합니다. 결과 숫자는 컴퓨터·Python 빌드·부하에 따라 달라지므로 저장된 숫자를 성능 사실로 재사용하지 않습니다.

## 자원 경계

이 lab은 입력을 Python list로 복사하며, 병합 정렬은 재귀 깊이와 보조 list를 사용합니다. CLI는 trace 128개, benchmark 크기 0–2048, 크기 목록 최대 10개, 반복 1–20회로 제한합니다. trace가 없으면 단계별 배열 스냅샷을 만들지 않습니다. 소요 시간·메모리·출력 크기를 무제한으로 보장하지 않으며, 큰 입력의 운영 측정 harness가 아닙니다. 파일·소켓·프로세스·컨테이너를 열지 않으므로 별도 teardown이나 cleanup 경로는 없습니다.

## 안정성 경계

삽입 정렬과 버블 정렬은 동등한 키를 교환하거나 밀지 않도록 작성했고, 병합 정렬은 `left <= right`일 때 왼쪽 원소를 먼저 꺼냅니다. 선택 정렬과 힙 정렬은 일반 구현에서 안정성을 약속하지 않지만, 모든 입력 원소와 다중집합을 보존하는지는 검사합니다. 안정성이 아니라 입력 순서와 무관한 결정적 결과가 필요하면 `(key, stable_id)` 같은 입력 순서와 무관한 total-order key를 명시합니다.

strict weak ordering은 동등한 원소 그룹을 허용하는 비교 계약이고, total order는 서로 다른 모든 원소의 순위를 정하는 계약입니다. validator는 유한하게 주어진 표본에서만 검사하므로 전체 값 영역에 대한 수학적 증명이 아닙니다. NaN, locale collation, 사용자 정의 객체의 예외 정책은 이 lab의 정수·tuple 예제에 포함하지 않습니다.

## 결과 확인

먼저 `--test`가 PASS인지 확인하고, trace에서 병합의 동률 처리와 heap extraction 상태를 읽습니다. 그 다음 `--failure-demo`가 `EXPECTED_FAILURE`를 출력하는지 확인합니다. 마지막으로 업무 workload의 대표 입력을 작은 size와 동일한 Python 버전에서 benchmark하고, 비교자 호출 비용과 객체 복사 비용을 별도 해석합니다.

이 lab의 PASS는 다섯 알고리즘의 작은 입력 정확성, 안정성 계약의 예제, 비교자 진단기와 측정 harness를 의미합니다. 표준 라이브러리 내부 구현, 병렬 정렬, 외부 병합, 디스크 부족 복구, 실시간 SLA, 캐시 성능을 실행하거나 보장하지 않습니다.
