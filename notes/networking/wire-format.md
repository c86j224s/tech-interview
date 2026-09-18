---
id: wire-format
title: 메모리 객체와 전송 바이트의 분리
topic: 네트워크
summary: 정수 엔디언·padding·길이·문자열·버전의 전송 계약을 정하고 객체 캐스팅과 안전한 디코딩의 차이를 설명합니다.
questionIds: [serialization-endianness, serialization-json-numbers]
---

# 메모리 객체와 전송 바이트의 분리

이 노트는 프로세스 내부 객체의 배치와 네트워크에서 합의한 바이트 계약을 분리합니다. 필드의 폭·엔디언·길이·문자 인코딩을 고정한 뒤, 수신 입력을 검증하고 값으로 구성하는 흐름을 golden bytes와 상호운용 시험으로 확인합니다.

## 필드의 전송 표현과 메모리 배치 차이

서버 구조체를 통째로 memcpy해 전송하면 수신 언어가 같은 값을 읽을 것 같지만 타입 크기·정렬·padding·엔디언·ABI가 다를 수 있습니다. 포인터 값은 상대 프로세스에서 의미가 없고 padding에는 초기화하지 않은 바이트가 들어갈 수도 있습니다. 따라서 같은 언어·같은 컴파일러의 현재 빌드에서 `sizeof(struct)`가 일치해도 다른 ABI·버전·언어의 계약이 된 것은 아닙니다. 송신자는 논리 필드를 명시적으로 쓰고 수신자는 허용된 범위만 읽어야 합니다.

직렬화는 객체 복사가 아니라 **명시한 데이터 계약을 바이트로 바꾸는 과정**입니다. 필드 순서·폭·부호·인코딩·길이·버전과 오류 처리까지 정해야 합니다. packed 구조체도 이 모든 문제를 해결하지 않습니다.

## 작은 정수와 golden bytes 대조

16비트 값 0x1234는 big-endian에서 `[0x12,0x34]`, little-endian에서 `[0x34,0x12]`입니다. 수신자가 반대로 해석하면 0x3412가 됩니다. 여기서는 version 1바이트, 길이 4바이트 big-endian, UTF-8 본문이라는 예를 사용합니다.

| 필드 | 전송 규칙 | 검사 |
| --- | --- | --- |
| version | unsigned 8비트 | 지원 버전 또는 명시적 거절 |
| length | unsigned 32비트 big-endian | 본문 바이트 수·최대값 |
| body | 지정된 UTF-8 바이트 | 실제 수신 길이·유효 인코딩 |

```diagram
{"title":"전송 계약을 거쳐 값으로 복원합니다","caption":"화살표는 인코딩·검증 순서입니다. 수신 바이트를 곧바로 구조체 포인터로 읽지 않고 길이와 표현을 검사한 뒤 값을 구성합니다.","rows":[[{"id":"object","label":"애플리케이션 값"}],[{"id":"bytes","label":"정의된 wire bytes","detail":["버전 · 길이 · UTF-8"]}],[{"id":"validate","label":"수신 길이·범위 검사"}],[{"id":"decode","label":"명시적 값 디코딩"}]],"edges":[{"from":"object","to":"bytes","label":"필드별 인코딩"},{"from":"bytes","to":"validate","label":"바이트 수신"},{"from":"validate","to":"decode","label":"유효 표현"}]}
```

## 프레임 길이 필드와 본문 바이트·버퍼 크기 검증

```text
decodeFrame(buffer):
    if available(buffer) < 5: return need_more
    version = read_u8(buffer,0)
    length = read_u32_big_endian(buffer,1)
    if version not supported or length > MAX_BODY: return invalid
    if available(buffer)-5 < length: return need_more
    body = decode_utf8_checked(buffer[5:5+length])
    return message(body), consumed=5+length
```

헤더가 충분한지 먼저 확인한 뒤 뺄셈으로 남은 길이를 비교하면 큰 길이 덧셈의 overflow를 피하기 쉽습니다. 실제 타입 변환·전체 buffer 상한도 필요합니다. TCP read 한 번이 프레임 하나라는 가정은 하지 않고 미완성·복수 프레임을 처리합니다. 상태 추적은 `header 일부 수신 → need_more`, `header 완성·body 일부 → need_more`, `body 완성 → 한 프레임 소비`, `남은 bytes → 다음 프레임`으로 나누면 TCP read 경계와 protocol frame 경계를 혼동하는 버그를 찾기 쉽습니다.

문자열 길이는 글자 수가 아니라 인코딩한 바이트 수입니다. 잘못된 UTF-8을 거절할지 대체 문자를 사용할지 정하고, 식별자라면 정규화·대소문자 규칙도 저장과 비교에 맞춥니다.

## 객체 캐스팅과 명시적 디코딩의 차이

C++에서 바이트 주소를 구조체 포인터로 바꿨다고 객체 수명·정렬·유효 표현·aliasing 규칙을 만족하지는 않습니다. 같은 크기라는 사실만으로 안전하지 않습니다. 검증된 직렬화 라이브러리나 필드별 디코딩을 사용하고, 네트워크 입력으로 임의 언어 객체·생성자·실행 훅을 복원하지 않습니다.

enum의 새 값, 빠진 필드, 알 수 없는 필드의 처리도 버전 계약입니다. 새 필드를 무시할 수 있어도 단위·뜻을 바꾸면 구버전이 조용히 잘못 해석할 수 있습니다. 파일 offset·주소 같은 로컬 식별자는 전송용 안정 ID와 분리합니다.

## JSON 숫자와 언어별 정밀도 차이

JSON에 정수 문법으로 큰 ID를 적어도 JavaScript Number로 파싱하면 안전한 정수 범위 밖에서 다른 ID와 같아질 수 있습니다. 예를 들어 2^53과 2^53+1을 이 타입이 모두 구별하지 못합니다. 큰 ID는 십진 문자열 등 명시적인 표현과 수신 측 범위 검사를 사용할 수 있습니다.

금액은 통화·최소 단위 정수 또는 고정 소수 문자열의 규칙을 정합니다. `0.1+0.2` 같은 이진 부동소수점 오차를 허용하지 않는 계약에 근사 double을 무심코 사용하지 않습니다. BigInt 자체의 기본 JSON 직렬화 지원 여부도 언어별로 확인해야 합니다.

## 구현 간 바이트·값 상호운용 검증

0·최소·최대·음수·다국어·빈 본문·과대 길이·잘린 헤더·알 수 없는 버전의 golden vector를 둡니다. 서로 다른 언어가 인코딩한 바이트와 디코딩한 값을 같은 기준으로 대조하고, 역직렬화 실패가 부분 상태 변경을 남기지 않는지 확인합니다. 실패 진단에서는 원본 buffer offset, 선언 length, 실제 available bytes, UTF-8 검증 결과, 소비한 바이트 수를 남기되 입력 payload 자체를 무제한 로그에 복사하지 않습니다. 길이 검사를 통과한 뒤에도 enum·단위·버전 의미를 검증해야 값 오염을 막을 수 있습니다.

이 노트의 바이트 모형은 일반 원리를 설명하며 실제 ABI나 모든 언어 실행을 검증한 것은 아닙니다. 명시적인 포맷 계약과 그에 대한 상호운용 시험이 구조체 크기 비교보다 신뢰할 수 있는 기준입니다.
