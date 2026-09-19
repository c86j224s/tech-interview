---
id: oci-layer-copy-on-write
title: OCI 이미지 레이어의 whiteout과 copy-on-write
topic: 인프라
summary: >-
  OCI layer tar의 변경 집합·whiteout·opaque whiteout과 컨테이너 실행 중 copy-up을 이미지 재현성·쓰기
  비용과 분리해 설명합니다.
questionIds: []
prerequisites:
  - reproducible-image
  - file-state
related:
  - object-publication
reviewedAt: '2026-09-19'
---
# OCI 이미지 레이어의 whiteout과 copy-on-write

컨테이너 이미지의 레이어는 각 시점의 전체 파일시스템을 그대로 저장한 snapshot이 아니라 부모 레이어에 적용할 변경 집합이다. OCI image-spec의 layer 문서는 tar 안에 추가·수정 파일을 넣고, 삭제는 whiteout이라는 특수 파일명으로 표현한다고 정의한다. 이 표현은 이미지 생성·전송·병합의 계약이고, 실행 중 writable layer가 lower 파일을 복사하는 copy-up은 런타임 저장소 구현의 문제다. 둘을 섞으면 “삭제한 파일이 실제로 지워졌는가”, “한 바이트 수정이 왜 수백 MB를 쓰는가”, “digest가 같으면 같은 rootfs인가”라는 질문에 틀린 답을 하게 된다.

## 변경 집합과 부모 레이어

빈 rootfs에 `etc/app.conf`, `bin/tool`을 넣은 첫 layer는 두 경로의 내용과 속성을 담는다. 다음 layer에서 `etc/app.conf`를 삭제하고 `bin/tool`을 새 내용으로 바꾸면 tar에는 새 `bin/tool`과 `.wh.app.conf`가 들어간다. 상위 tar에서 `.wh.` 항목은 일반 파일로 추출해 보관하는 데이터가 아니라, 적용 시 부모 경로를 가리라는 지시다. 따라서 layer 파일 자체를 열어 보면 삭제 대상의 원래 바이트가 들어 있지 않지만, 부모 layer에는 여전히 그 바이트가 남아 있을 수 있다.

OCI 문서의 표현을 다음처럼 중간 상태로 읽으면 된다.

```text
L0: /etc/app.conf = old, /bin/tool = v1
L1 tar: /etc/.wh.app.conf, /bin/tool = v2
apply(L0, L1): /etc/app.conf 없음, /bin/tool = v2
```

적용 구현은 단순한 tar extract와 다르다. layer에 whiteout이 없으면 일반 tar에 가까운 추출이 가능하지만, whiteout이 있으면 먼저 lower/parent 항목을 숨기고 같은 layer의 추가·수정을 반영해야 한다. OCI 규격은 같은 layer의 디렉터리 항목이 기존 디렉터리와 겹칠 때 속성을 바꾸고, 그 밖의 충돌은 기존 경로를 제거한 뒤 새 항목을 만드는 의미적 동작을 요구한다. whiteout 파일 그 자체는 최종 merged rootfs에서 보이지 않아야 한다.

## Whiteout 삭제 표현

일반 whiteout의 파일명은 삭제할 basename 앞에 `.wh.`를 붙인다. 부모 layer에 `a/file2`가 있을 때 상위 layer의 `a/.wh.file2`는 `a/file2`를 숨긴다. 경로가 달라도 tar 안의 항목은 삭제 대상 디렉터리 안에 있는 정규 파일이며, `/a/file2`를 직접 tar에서 삭제하는 형식이 아니다. 이 차이를 모르면 layer tar를 압축 해제한 뒤 `.wh.file2`가 남아 있는 것을 “삭제 실패”로 오판하게 된다.

whiteout은 lower/parent layer의 리소스에만 적용된다. 같은 layer에서 먼저 만든 파일은 그 layer 안의 whiteout으로 숨겨지지 않고, 더 뒤의 layer가 다시 whiteout을 내야 한다. 예를 들어 L1이 `x`를 만들고 L1 안에 `.wh.x`가 함께 있어도, 그 marker가 L0의 x를 지우는 의미이지 L1의 새 x를 무효화하는 일반 순서 규칙으로 읽어서는 안 된다. 구현체가 whiteout을 같은 layer의 sibling보다 앞에 생성하도록 권장되는 이유도 이 병합 순서를 사람이 추적하기 쉽게 하기 위해서다.

## Opaque 디렉터리 대체

디렉터리 안의 lower children을 모두 숨기려면 `.wh..wh..opq`를 사용한다. L0에 `bin/a`, `bin/tools/t`가 있고 L1의 `bin`을 새 디렉터리 내용으로 교체한다면, L1의 `bin/.wh..wh..opq`는 lower `bin`의 모든 자식과 하위 후손을 가린다. 같은 효과를 `.wh.a`, `.wh.tools`처럼 각 항목의 명시적 whiteout으로 표현할 수도 있다. OCI 문서는 구현체가 explicit whiteout을 만들도록 권장하지만 둘 다 받아들여야 한다고 규정한다.

중요한 점은 opaque marker가 디렉터리 자체를 삭제한다는 뜻이 아니라 그 디렉터리의 lower children 집합을 비운다는 뜻이라는 점이다. 이후 같은 layer에 `bin/new`를 추가하면 결과는 `bin/new`만 있는 새 관찰 상태가 된다. 더 깊은 후손을 하나씩 열거하지 않아도 되므로 children 수가 많을 때 표현 크기가 달라진다. 반대로 특정 파일 하나만 지울 때 opaque를 쓰면 의도하지 않은 lower 파일까지 가려져 데이터 손실처럼 보이는 결과가 난다.

```diagram
{"title":"레이어 적용과 실행 쓰기의 분리","caption":"whiteout은 이미지 병합 시 lower 항목을 가리고, copy-up은 실행 중 writable layer에 쓰기 위한 런타임 동작입니다.","rows":[[{"id":"lower","label":"lower layer","detail":["old file·directory"]}],[{"id":"diff","label":"OCI diff tar","detail":["add·modify·whiteout"]}],[{"id":"merged","label":"merged rootfs","detail":["가려진 항목 제외"]}],[{"id":"runtime","label":"runtime write","detail":["copy-up 또는 driver 정책"]}]],"edges":[{"from":"lower","to":"merged","label":"부모 상태"},{"from":"diff","to":"merged","label":"순서대로 적용"},{"from":"merged","to":"runtime","label":"쓰기 요청"}]}
```

## DiffID·chainID와 압축 바이트

OCI image config는 rootfs의 `diff_ids` 배열로 각 layer의 압축되지 않은 tar digest를 기록하고, manifest의 layer descriptor는 전송되는 blob의 digest·size·mediaType을 기록한다. 같은 uncompressed tar가 gzip timestamp나 압축 수준만 달리해 다른 바이트가 되면 descriptor digest는 달라질 수 있지만 diffID는 같을 수 있다. 반대로 tar entry 순서·mtime·uid·whiteout 내용이 달라지면 압축을 풀었을 때의 tar 바이트가 달라져 diffID도 달라진다.

chainID는 단일 layer 내용의 hash와 구별되는, 부모까지 포함한 누적 식별자다. `chainID(L0)=hash(diffID0)`, `chainID(L1)=hash(chainID(L0) + " " + diffID1)`처럼 누적하면 L1의 같은 diff라도 부모 chain이 바뀌었을 때 다른 rootfs 계보가 된다. 이 계산식을 구현 세부로 단정하기보다 config의 diffID 목록이 부모 순서를 보존하고, config의 목록으로 ChainID를 계산할 수 있고, 일부 image store·snapshotter가 이를 계보 또는 캐시 식별에 사용할 수 있다는 정도로 범위를 좁혀야 한다. OCI가 모든 runtime에 ChainID 계산·저장을 의무화하는 것은 아니다. “manifest digest 하나”만 보고 압축 전 내용, rootfs 조합, 실행 설정이 모두 같다고 주장하면 안 된다.

## 실행 중 copy-up과 파일 배치

이미지 layer가 읽기 전용 lower로 연결되고 별도 writable upper가 붙는 overlay 계열 구현에서는 lower의 `var/log/app.log`를 열어 쓰는 순간 upper에 파일을 복사한 뒤 변경을 적용할 수 있다. 파일이 512MiB이고 한 바이트만 수정해도 copy-up 단계에서 upper에 큰 파일 사본이 생길 수 있다. 이 동작은 OCI layer tar가 “한 바이트 diff만 저장한다”는 계약과 모순되지 않는다. 후자는 이미지 build 시 변경 집합이고, 전자는 컨테이너 실행의 파일시스템 드라이버 정책이다.

실제 경로는 환경에 따라 다르다. overlayfs의 copy-up 조건, metacopy·redirect 같은 옵션, rootless 구현, 다른 snapshotter는 파일 데이터 또는 메타데이터를 다르게 처리할 수 있다. 따라서 특정 runtime에서 “항상 전체 파일을 복사한다”라고 일반화하지 말고, 사용 중인 storage driver와 mount 옵션, upperdir의 실제 증가량을 확인한다. 쓰기가 많은 DB·로그·캐시를 이미지 lower에 둔 뒤 컨테이너 layer에 계속 쓰기보다 named volume이나 별도 writable filesystem을 선택하면 이미지 upper의 copy-up·commit 비용을 분리할 수 있다.

## 레이어 설계와 쓰기 증폭

레이어를 잘게 나누면 캐시 재사용과 변경 전송 단위에는 유리하지만, 삭제 marker와 메타데이터, 각 layer의 압축·검증 비용이 늘어난다. 한 RUN에서 패키지를 설치한 뒤 다음 RUN에서 캐시를 지우면 최종 merged rootfs에는 없더라도 이전 layer tar에는 남는다. 이미지 크기를 줄이려면 생성과 제거를 같은 변경 집합에서 처리하거나 multi-stage로 최종 산출물만 복사해야 한다. 그래도 registry cache와 중간 이미지 접근권한은 별도로 관리해야 한다.

파일 배치도 실행 비용을 바꾼다. 불변 실행 파일은 lower에 두고 자주 변경되는 데이터는 volume으로 보내면 copy-up 대상이 작아진다. 반대로 앱이 lower의 설정 파일을 매 요청마다 rewrite하면 첫 쓰기 지연과 upper 용량이 커지고, 컨테이너 재생성 때 사라질 ephemeral 데이터가 이미지 commit에 포함될 위험도 생긴다. “레이어 수를 줄이면 무조건 빠르다”가 아니라 pull 재사용, build cache, merged lookup, upper 쓰기량을 각각 측정해야 한다.

## 검증 절차와 한계

검증할 때는 첫째 각 layer tar의 mediaType·압축 여부·descriptor digest와 압축 해제 후 diffID를 따로 기록한다. 둘째 부모부터 layer를 적용해 whiteout을 해석한 결과를 작은 상태 표로 만든다. 셋째 실행 컨테이너에서 큰 lower 파일을 복사하고 upperdir 사용량, write latency, 재시작 후 파일 수명을 확인한다. 이 저장소에서는 OCI runtime이나 overlay mount를 실행하지 않았으므로 다음 결과는 설명용 계산과 예상 관찰이다. 실제 driver의 copy-up 여부는 해당 커널·snapshotter에서 실험해야 한다.

또한 layer tar에 secret을 만들었다가 삭제한 경우 최종 rootfs 검사만으로 안전성을 판단하지 않는다. 이전 blob, build cache, history, log, provenance에 남았는지 확인하고 secret mount나 지원되는 secret 전달 경로를 사용한다. whiteout은 기밀 삭제 기능이 아니라 merged view의 은닉 표현이다.

## 참고자료와 적용 범위

참고자료: https://raw.githubusercontent.com/opencontainers/image-spec/main/layer.md 및 https://raw.githubusercontent.com/opencontainers/image-spec/main/config.md (main branch, commit 미고정, 2026-09-19 본문 확인). layer 문서는 추가·수정·삭제, 일반/opaque whiteout, 적용 의미를 정의하고 config 문서는 image JSON·layer DiffID·rootfs 순서를 설명한다. overlay copy-up의 세부는 OCI 규격이 정하지 않으므로 Linux overlayfs, container runtime, snapshotter 버전을 함께 명시해야 한다. 이 문서는 특정 최신 runtime의 동작을 보증하지 않으며, 실제 실험 없이 성공 결과를 주장하지 않는다.
