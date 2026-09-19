---
id: elf-relocation-addend
title: >-
  같은 relocation이라도 REL과 RELA가 addend를 저장하는 위치가 다릅니다. loader가 어떤 값으로 최종 주소를
  계산하나요?
difficulty: 중하
category: 운영체제
tags:
  - ELF
  - relocation
  - REL
  - RELA
  - addend
related:
  - file-atomic-replace
---
# 같은 relocation이라도 REL과 RELA가 addend를 저장하는 위치가 다릅니다. loader가 어떤 값으로 최종 주소를 계산하나요?

## 구두 답변

핵심은 REL과 RELA가 addend를 읽는 위치를 다르게 약속한다는 점입니다. RELA entry에는 `r_addend`라는 explicit 값이 있고, REL entry에는 그 필드가 없으므로 loader가 relocation이 적용될 affected location에 이미 저장된 implicit 값을 읽습니다. 그 다음 실제 계산식은 processor ABI가 정합니다. 일반 기호를 `S`, addend를 `A`, relocation 위치를 `P`라고 쓰면 어떤 유형은 `S+A`, PC-relative 유형은 `S+A-P`처럼 표현되며 load bias와 field 크기·signedness도 target 규칙에 들어갑니다. 설명용으로 runtime symbol 주소가 `0x70002000`, addend가 `0x18`인 `S+A` 유형을 놓으면 REL은 location에서 `0x18`을 읽고 `0x70002018`을 씁니다. RELA는 location의 기존 값이 아니라 entry의 `r_addend=0x18`을 읽고 같은 결과를 씁니다. RELA에서 location에도 우연히 `0x18`이 남아 있다고 해서 둘을 더하면 `0x70002030`이 되어 addend를 중복 반영한 잘못된 상태입니다. 반대로 REL에서 location을 0으로 초기화했다고 가정하면 필요한 implicit 정보가 사라져 다른 결과가 됩니다. `SHT_REL`·`SHT_RELA`라는 section type만으로 모든 relocation이 같은 식이라고 말할 수 없고, `sh_link`가 참조하는 symbol table과 `sh_info`가 가리키는 affected section도 확인해야 합니다. 실제 `R_*` 번호와 overflow 판정은 대상 processor supplement를 읽어야 하며, 이 환경에서는 Linux `readelf` 실행을 하지 않았으므로 특정 바이너리 출력인 것처럼 제시하지 않습니다.

## 득점 포인트

- REL은 affected location의 implicit addend, RELA는 entry의 explicit `r_addend`를 사용한다고 명확히 구분합니다.
- `S=0x70002000`, `A=0x18`에서 `S+A=0x70002018`이 되는 중간 계산을 제시합니다.
- 실제 식과 field signedness는 processor supplement 범위라는 한계를 계산 설명과 함께 밝힙니다.

## 감점 포인트

- RELA에서도 location의 기존 값을 반드시 더한다고 하거나 REL에서 entry에 addend 필드가 있다고 하면 틀립니다.
- 모든 relocation을 `S+A`로 고정해 PC-relative `P`나 overflow 조건을 삭제하면 안 됩니다.
- link-time symbol value와 load-bias가 반영된 runtime value를 한 주소로 섞으면 숫자 예시의 의미가 무너집니다.

## 더 파고들 거리

- `sh_link`로 symbol table을, `sh_info`로 affected section을 연결해 entry의 소비 대상을 확인합니다.
- 특정 `R_*` 계산은 target ABI 본문을 읽은 뒤에만 식과 범위를 확정합니다.
- 실행하지 않은 readelf 결과를 인용하지 않고 설명용 산술과 실제 바이너리 관찰을 분리합니다.
