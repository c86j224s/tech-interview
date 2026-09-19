---
id: elf-linking-relocation
title: ELF 정적·동적 링크와 relocation
topic: 운영체제
summary: >-
  오브젝트의 section·symbol·relocation을 정적 link editor와 실행 시 dynamic linker가 어떻게 이어
  붙이는지 구분합니다.
questionIds: []
prerequisites:
  - execution-boundaries
  - file-state
related:
  - file-state
  - execution-boundaries
reviewedAt: '2026-09-19'
---
# ELF 정적·동적 링크와 relocation

ELF를 한 덩어리의 실행 코드로 보면 컴파일, link editing, load가 섞입니다. 컴파일러가 만든 relocatable object에는 section·symbol·미완성 참조가 있고, static link editor는 여러 object와 archive에서 필요한 정의를 모아 실행 image 또는 shared object를 만듭니다. 동적 링크를 선택하면 결과 image에 shared object 의존성과 dynamic symbol·relocation 정보가 남으며, 실행 시 runtime linker가 실제 배치 주소를 반영합니다. 따라서 “정적 링크는 relocation이 없고 동적 링크는 link 단계가 없다”는 설명은 모두 틀립니다.

## Section과 실행 segment

`.text`, `.rodata`, `.data`, symbol table, relocation section은 link editing을 위한 논리적 section입니다. 실행 시 loader가 매핑할 단위는 program header의 segment이므로 section과 segment를 일대일로 보지 않습니다. `SHT_NOBITS`처럼 파일에 바이트를 갖지 않으면서 메모리 공간을 예약하는 section도 있습니다. section header의 존재만으로 어떤 bytes가 실제로 매핑되는지 결정할 수 없는 이유입니다.

relocatable object의 `call foo`는 컴파일 단위 안에서 최종 주소를 알 수 없을 수 있습니다. relocation entry는 affected location, symbol table index, relocation type을 연결합니다. section header의 `sh_link`는 관련 symbol table을, `sh_info`는 relocation이 적용되는 section을 가리키는 일반 구조를 제공합니다. 실제 field 크기와 계산식은 processor supplement 범위입니다.

## Static link editor

static link 단계에서는 unresolved reference와 정의를 대조하고, archive는 필요한 member를 선택하는 방식으로 결과에 결합합니다. `main.o`가 `parse()`를 참조하고 `libparse.a`에 정의가 있으면 link editor는 미해결 참조를 만족시키는 member를 끌어옵니다. archive 파일 전체를 무조건 복사한다는 뜻은 아닙니다. section 배치와 image 내부에서 해결할 수 있는 relocation도 이 단계에서 처리됩니다.

반대로 `libparse.so`를 사용하면 실행 파일만으로 구현이 완결되지 않습니다. 결과에는 shared object 이름, dynamic symbol, relocation 경로가 남습니다. 같은 `parse()` 호출이라도 archive를 선택한 경우와 shared object를 선택한 경우에 주소가 결정되는 시점이 다릅니다. “정적”은 모든 라이브러리와 OS 기능이 실행 파일 안에 있다는 뜻이 아니라 해당 link 경계의 구현이 image에 결합됐다는 뜻입니다.

## Dynamic linker의 실행 시 역할

프로그램 로더가 실행 image와 의존 object를 매핑한 뒤 runtime linker가 dynamic symbol을 찾아 relocation을 적용합니다. shared object마다 다른 load bias가 생길 수 있으므로 link 시점의 가상 주소만 그대로 사용할 수 없습니다. library 파일이 없거나 ABI가 맞지 않으면 link 성공 뒤에도 load 시점에 실패할 수 있습니다. runtime linker가 동작한다는 사실은 kernel syscall과 같은 사건이라는 의미가 아닙니다.

실제 symbol interposition, visibility, IFUNC, dependency 순서는 target ABI와 loader 문서를 따라야 합니다. System V gABI는 일반 section·symbol·relocation 구조를 설명하지만 processor-specific relocation과 모든 플랫폼의 lookup 우선순위를 확정하지 않습니다. 이 장은 공통 ELF 경계를 설명하며 특정 libc 정책을 보편 규칙으로 만들지 않습니다.

```diagram
{"title":"정적 결합과 실행 시 결합의 경계","caption":"link editor가 처리하는 image 내부 결합과 runtime linker가 처리하는 shared object 주소 반영을 분리합니다.","rows":[[{"id":"obj","label":"object·archive","detail":["section · symbol · 참조"]}],[{"id":"edit","label":"static link editor","detail":["archive 선택 · 배치 · relocation"]}],[{"id":"img","label":"실행 image","detail":["코드 또는 동적 의존성"]}],[{"id":"run","label":"runtime linker","detail":["load · lookup · runtime relocation"]}]],"edges":[{"from":"obj","to":"edit","label":"입력 결합"},{"from":"edit","to":"img","label":"link 결과"},{"from":"img","to":"run","label":"동적 경계가 남으면"}]}
```

## REL과 RELA

`SHT_REL`은 relocation entry에 explicit addend 필드가 없고 affected location의 기존 값에 implicit addend가 있습니다. `SHT_RELA`는 entry 안의 explicit `r_addend`를 사용합니다. 개념적으로 loader는 relocation type이 정한 식에 따라 symbol 값 `S`, addend `A`, place `P`, load bias 등을 조합합니다. 모든 relocation이 단순히 `S+A`인 것은 아니며 PC-relative 계산처럼 `P`가 참여하는 유형도 있습니다.

설명용 숫자를 보겠습니다. runtime symbol 주소가 `0x70002000`, addend가 `0x18`, 유형이 `S+A`라면 결과는 `0x70002018`입니다. REL은 location에서 `0x18`을 읽고 RELA는 entry의 `r_addend=0x18`을 읽습니다. RELA에서 location의 예전 값을 다시 더하면 이중 가산입니다. 이 수치는 실제 아키텍처 실행 결과가 아닌 계산 위치를 보여 주는 예입니다.

## Symbol table과 resolution 범위

`SHT_SYMTAB`은 일반 link editing에 쓰이는 넓은 symbol 표이고 `SHT_DYNSYM`은 dynamic linking에 필요한 symbol 집합입니다. entry에는 이름, binding, type, visibility, section index, value가 있고 이름은 string table에서 찾습니다. 배포용 image에서 일반 symbol table을 제거해도 runtime linker에 필요한 dynamic symbol이 같은 의미로 사라지는 것은 아닙니다.

archive의 정의를 선택하는 일과 로드된 object들의 dynamic symbol을 조회하는 일은 모두 “이름을 주소로 바꾸는” 과정이지만 입력과 시점이 다릅니다. 여러 shared library가 같은 이름을 제공할 때 어느 정의가 우선인지 gABI 목차만으로 단정하지 않고 target ABI·loader 설정을 확인합니다.

## GOT·PLT와 binding 시점

PIC는 실행 때 모르는 절대 주소를 명령어마다 고정하지 않고 간접 참조를 사용할 수 있습니다. GOT에 데이터나 함수 주소를 둘 수 있고, PLT stub가 GOT slot을 이용해 외부 함수로 분기하는 방식이 대표적입니다. 구체적인 layout과 relocation type은 아키텍처 ABI에 따라 달라집니다.

lazy binding에서는 첫 호출이 PLT에서 resolver 경로로 들어가 symbol을 찾고 GOT slot을 갱신한 뒤 target으로 갈 수 있습니다. 다음 호출은 갱신된 slot을 사용해 resolver 비용을 피합니다. eager binding은 관련 relocation을 시작 시 처리하므로 첫 호출 지연과 실행 중 변경 창을 줄이는 대신 startup 비용을 앞당깁니다. RELRO·toolchain·보안 설정에 따라 실제 정책은 다를 수 있습니다.

## 실패·선택·검증

정의가 전혀 없으면 link editor 오류이고, shared object가 배포되지 않았거나 ABI가 맞지 않으면 load 오류입니다. 동적 링크는 공통 library 업데이트와 image 크기 측면에서 유리할 수 있지만 검색 경로·시작 지연·배포 호환성을 관리해야 합니다. 정적 결합은 배포 단순성을 높일 수 있는 대신 각 image에 보안 수정과 library 업데이트를 다시 반영해야 합니다.

진단할 때 `readelf -S`, `readelf -s`, `readelf -r`, `readelf -d`를 section·symbol·relocation·dynamic dependency 질문에 나눠 사용합니다. 이 문서에서는 명령을 실행하지 않았으므로 특정 출력이나 성공을 주장하지 않습니다. 근거는 System V ABI gABI의 section-header·symbol-table 본문과 relocation 본문(ch4.reloc)입니다. contents 페이지는 범위 안내일 뿐 GOT/PLT 정책의 증거로 세지 않습니다. gABI가 1997–2001 문맥의 일반 구조를 설명하고 processor supplement에 계산식과 플랫폼 정책을 위임한다는 범위를 보존합니다.


## 실행 시 상태 추적

설명용 상태를 하나 고정하면 단계가 선명해집니다. `main.o`의 `call parse`가 relocation offset `0x20`을 갖고, `libparse.so`의 link-time symbol value가 `0x1800`이라고 하겠습니다. 실행 파일과 라이브러리가 각각 다른 위치에 매핑되어 load bias가 `0x70000000`이면 runtime symbol 위치는 단순화해 `0x70001800`이 됩니다. loader는 relocation type이 요구하는 `S`, `A`, `P`를 읽어 호출 위치에 쓸 값을 계산하고, PC-relative 형식이면 `P`도 들어갑니다. static archive 경로에서는 link editor가 이 결합을 image 작성 시 처리하므로 실행 시 같은 archive member를 다시 검색하지 않습니다. 이 숫자는 실제 특정 CPU의 출력이 아니라 상태 전이와 산술 위치를 검증하는 설명용 계산입니다.

## 구현 경계와 비용

정적 결합은 배포 파일 수와 시작 시 resolver 의존성을 줄일 수 있지만, 각 실행 파일에 라이브러리 코드가 복제되고 보안 수정이 image마다 다시 필요합니다. 동적 결합은 공통 object와 page sharing을 활용할 수 있지만 검색 경로, ABI 호환성, startup relocation, symbol interposition을 관리해야 합니다. `readelf -S`는 section, `readelf -r`는 relocation entry, `readelf -d`는 `NEEDED`와 dynamic tag를 따로 확인하는 식으로 질문을 분리합니다. 이 환경에는 Linux ELF `readelf`가 없어 실행 출력은 만들지 않았습니다. 따라서 특정 relocation 번호나 GOT 주소를 성공한 측정처럼 제시하지 않고, 대상 ABI supplement를 읽은 뒤에만 숫자와 명령어 형식을 확정합니다.

### 참고 경로

- [https://refspecs.linuxfoundation.org/elf/gabi4+/ch4.sheader.html](https://refspecs.linuxfoundation.org/elf/gabi4+/ch4.sheader.html)
- [https://refspecs.linuxfoundation.org/elf/gabi4+/contents.html](https://refspecs.linuxfoundation.org/elf/gabi4+/contents.html)

위 링크는 개념별 참고 경로이며, 본문에서 명시한 확인 범위와 미확인 구현 조건을 함께 적용합니다.
