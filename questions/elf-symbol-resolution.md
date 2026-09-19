---
id: elf-symbol-resolution
title: >-
  실행 파일과 여러 shared library가 같은 symbol 이름을 제공합니다. symbol table 종류와 link/load 단계의
  resolution 범위를 어떻게 구분하나요?
difficulty: 중하
category: 운영체제
tags:
  - ELF
  - symbol resolution
  - SHT_SYMTAB
  - SHT_DYNSYM
related: []
---
# 실행 파일과 여러 shared library가 같은 symbol 이름을 제공합니다. symbol table 종류와 link/load 단계의 resolution 범위를 어떻게 구분하나요?

## 구두 답변

symbol 이름이 같다는 사실과 어느 단계에서 어떤 정의가 선택되는지는 분리해서 설명해야 합니다. `SHT_SYMTAB`은 일반 link editing에 쓰이는 비교적 넓은 symbol 표이고, `SHT_DYNSYM`은 실행 시 shared object와의 dynamic linking에 필요한 집합입니다. 정적 경로에서는 `main.o`의 미해결 `f` 참조와 archive member의 정의를 link editor가 대조해 필요한 member를 결합하고 image 내부 relocation을 처리합니다. 동적 경로에서는 실행 파일과 이미 로드된 shared object의 dynamic symbol, visibility, relocation 정보가 lookup 입력이 됩니다. 예를 들어 실행 파일이 `f`를 export하고 `libA.so`, `libB.so`도 같은 이름을 제공한다면, 단순히 문자열이 세 번 있다는 사실만으로 결과를 정할 수 없습니다. 실행 파일의 exported definition, dependency 순서, visibility와 interposition, loader 및 target ABI 정책을 확인해야 합니다. 이때 `SHT_SYMTAB`을 제거한 배포 파일도 runtime linker가 필요로 하는 `SHT_DYNSYM`까지 같은 의미로 제거했다는 뜻은 아닙니다. 상태 추적은 `main.o:f unresolved → archive 선택 또는 dynamic reference 기록 → load 시 dynamic lookup → relocation 대상 주소 기록`의 네 단계입니다. `readelf -s`에서 binding·type·visibility·section index를 보고, `readelf -d`에서 의존 object를 확인한 다음 `readelf -r`로 그 symbol을 소비하는 relocation을 연결합니다. gABI는 section과 table의 공통 구조를 제공하지만 모든 플랫폼의 lookup precedence를 확정하지 않으므로, 특정 libc 정책을 ELF 보편 규칙처럼 말하면 안 됩니다.

## 득점 포인트

- SYMTAB은 일반 link editing, DYNSYM은 runtime dynamic linking이라는 소비자와 시점을 분리합니다.
- archive 선택과 shared object lookup을 `f unresolved` 상태가 변하는 두 경로로 추적합니다.
- 동일 symbol의 우선순위는 visibility·dependency·interposition과 target loader 정책에 의존한다고 범위를 제한합니다.

## 감점 포인트

- DYNSYM을 SYMTAB의 단순 복사라고 하거나 모든 local symbol을 포함한다고 말하면 table 역할을 잘못 이해한 것입니다.
- 이름이 같다는 이유만으로 link editor와 runtime loader가 같은 정의를 고른다고 단정하면 안 됩니다.
- gABI 구조만으로 특정 libc의 lookup precedence를 확정하지 않습니다.

## 더 파고들 거리

- `readelf -s`의 binding·visibility와 `readelf -d/-r`의 의존성·소비 relocation을 함께 읽습니다.
- 배포 image에서 SYMTAB 제거와 DYNSYM 유지가 양립할 수 있다는 점을 확인합니다.
- 실제 platform을 말할 때는 대상 ABI와 loader 문서의 범위를 답변에 명시합니다.
