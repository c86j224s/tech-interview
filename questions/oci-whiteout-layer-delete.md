---
id: oci-whiteout-layer-delete
title: 상위 이미지 레이어에서 파일을 삭제했는데 최종 rootfs에서 사라지는 이유를 whiteout으로 설명하세요.
difficulty: 중하
category: 인프라
tags:
  - OCI
  - layer
  - whiteout
related:
  - container-image-reproducibility
---
# 상위 이미지 레이어에서 파일을 삭제했는데 최종 rootfs에서 사라지는 이유를 whiteout으로 설명하세요.

## 구두 답변
상위 레이어가 하위 tar에서 파일의 바이트를 지우는 것이 아니라, 병합기가 lower 항목을 결과에서 숨기라는 표식을 읽기 때문에 사라집니다. 예를 들어 L0에 `/etc/a=old`, `/etc/b=keep`, `/tmp/x=one`이 있고 L1 tar에 `/etc/.wh.a`, `/etc/c=new`이 있으면 적용 과정은 먼저 L0의 상태를 만들고 `.wh.a`를 해석해 `/etc/a`를 제거한 관찰 상태를 만든 뒤 `c`를 추가합니다. 따라서 최종 결과는 `b`, `c`, `tmp/x`이고 `.wh.a` 자체는 일반 파일로 노출되지 않습니다.

`.wh.basename`은 marker가 놓인 디렉터리 안의 동일 basename만 가립니다. 반면 `.wh..wh..opq`는 그 디렉터리의 lower children과 후손 전체를 가리는 opaque whiteout입니다. L0의 `/opt/a`, `/opt/sub/b`를 L1의 `/opt/.wh..wh..opq`와 `/opt/new`로 대체하면 `/opt/new`만 남습니다. 특정 파일 하나를 지우는 데 opaque를 쓰면 `a`뿐 아니라 `sub`까지 가려져 의도보다 넓은 결과가 됩니다. 같은 레이어에서 만들어진 항목과 parent 항목에 대한 whiteout의 적용 범위도 구분해야 합니다.

이 표식은 삭제된 원본을 안전하게 소거했다는 의미가 아닙니다. L0 blob은 registry에 남고 L1은 그 경로를 merged view에서 숨깁니다. 그래서 rootfs에서 `a`가 보이지 않는 사실은 layer 보존·secret 폐기·cache 접근권한과 별개입니다. 실제 runtime을 실행하지 않은 이 답변의 상태 추적은 설명용이며, 구현 검증은 각 layer를 parent 순서로 적용해 marker가 최종 트리에 노출되지 않는지와 원본 blob의 잔류를 각각 검사해야 합니다.

## 득점 포인트
- `L0 → L1 marker 해석 → merged tree`의 중간 상태를 `/etc/a`와 `/etc/c`로 추적합니다.
- 일반 whiteout과 opaque whiteout의 범위를 basename 하나와 디렉터리 전체로 구별합니다.
- 이미지 병합 계약과 실행 중 upper copy-up, 보안상 blob 폐기를 서로 다른 문제로 설명합니다.

## 감점 포인트
- whiteout 파일이 최종 rootfs에 그대로 남는다고 말하면 병합 의미를 거꾸로 설명한 것입니다.
- opaque marker를 단일 파일 삭제의 약칭으로 사용하면 다른 lower children까지 잃는 반례를 놓칩니다.
- 최종 rootfs 검사만으로 이전 layer의 secret 바이트가 회수됐다고 결론내리면 안 됩니다.

## 더 파고들 거리
- 같은 layer의 추가·수정·whiteout을 적용할 때 parent 항목과 same-layer 항목을 어떤 순서 계약으로 분리할지 확인합니다.
- layer tar의 whiteout과 overlayfs 실행 중 copy-up을 동일한 삭제·쓰기 작업으로 오해하지 않도록 각각의 저장물을 비교합니다.
