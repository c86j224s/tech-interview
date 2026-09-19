---
id: oci-digest-diffid-compression
title: >-
  같은 tar 내용인데 압축 방식이 달라 layer digest가 달라질 수 있습니다. compressed digest와
  uncompressed diffID의 역할을 구분하세요.
difficulty: 중하
category: 인프라
tags:
  - OCI
  - layer
  - whiteout
related:
  - container-image-reproducibility
---
# 같은 tar 내용인데 압축 방식이 달라 layer digest가 달라질 수 있습니다. compressed digest와 uncompressed diffID의 역할을 구분하세요.

## 구두 답변
manifest descriptor의 digest와 config의 DiffID는 해시 대상이 다릅니다. 압축되지 않은 tar 바이트를 `U`, gzip 결과를 `G1`, 다른 gzip 설정 결과를 `G2`라 하면 `sha256(U)=D`, `sha256(G1)=A`, `sha256(G2)=B`에서 A와 B는 달라도 D는 같을 수 있습니다. descriptor digest는 registry로 전달되는 blob 바이트를 가리키므로 A 또는 B가 되고, `rootfs.diff_ids`의 D는 압축을 풀기 전 tar의 digest입니다. 압축 timestamp·level이 달라진 예에서만 이런 분리가 일어나는 것이 아니라 mediaType과 descriptor size까지 함께 달라질 수 있습니다.

다만 “같은 tar 내용”을 파일 목록이 같다는 뜻으로 느슨하게 말하면 안 됩니다. tar entry 순서, header의 mtime·uid·mode, pax 메타데이터, whiteout 이름이 바뀌면 압축을 풀어 얻는 tar 바이트 U가 달라져 DiffID도 달라질 수 있습니다. 반대로 U가 정말 byte-for-byte 같고 압축만 바뀐 경우에는 DiffID가 유지됩니다. 따라서 압축을 다시 만들 때 descriptor와 size를 갱신하고, config의 diff_ids와 layer 순서가 새 tar의 의미와 맞는지 따로 확인합니다.

`diff_ids`의 순서는 parent부터의 순서를 보존하며, 그 배열로 OCI 문서가 설명하는 누적 ChainID를 계산할 수 있습니다. 그러나 이것을 모든 OCI runtime이 반드시 계산하거나 저장 계층에서 사용한다는 뜻으로 확대하면 안 됩니다. 일부 image store나 snapshotter가 캐시·계보 키로 사용할 수 있고, 다른 구현은 자체 식별을 쓸 수 있습니다. config digest, manifest digest, layer descriptor digest, runtime snapshotter의 chain 사용은 각각 확인 대상입니다. 이 답변의 A/B/D는 설명용 기호 계산이지 실제 registry blob 생성 결과가 아닙니다.

## 득점 포인트
- compressed descriptor digest와 uncompressed tar DiffID의 해시 입력을 식으로 분리합니다.
- gzip만 달라지는 경우와 tar metadata까지 달라지는 경우를 나누어 DiffID 변화 조건을 설명합니다.
- ordered `diff_ids`와 계산 가능한 ChainID를 말하되 모든 runtime의 의무로 과장하지 않습니다.

## 감점 포인트
- 파일 목록이 같으면 tar 바이트와 DiffID도 반드시 같다고 단정하면 재현성 조건을 놓칩니다.
- descriptor digest와 config digest를 같은 layer 식별자로 취급하면 참조 구조를 혼동합니다.
- ChainID를 모든 OCI runtime이 반드시 저장·사용한다고 일반화합니다.

## 더 파고들 거리
- gzip header의 timestamp를 고정한 뒤 tar mtime과 entry 순서를 바꾸어 어느 digest가 변하는지 분리 측정합니다.
- descriptor만 교체하는 재압축이 가능한지 mediaType, config diff_ids, manifest 참조를 함께 검증합니다.
