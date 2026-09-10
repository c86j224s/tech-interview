---
id: jetstream-durable-consumer
title: "분석과 알림 서비스가 같은 JetStream 메시지를 각각 읽어야 합니다. stream과 durable consumer를 어떻게 나누고 재시작 위치를 유지하나요?"
difficulty: 하
category: 분산 시스템
tags: ["NATS","JetStream","durable consumer"]
related: ["nats-core-jetstream"]
---

# 분석과 알림 서비스가 같은 JetStream 메시지를 각각 읽어야 합니다. stream과 durable consumer를 어떻게 나누고 재시작 위치를 유지하나요?

## 구두 답변

stream은 subject에 들어온 메시지를 정책에 따라 저장하고, consumer는 그 기록을 어떤 위치부터 어떤 방식으로 전달하며 무엇이 확인됐는지 관리합니다. durable consumer는 클라이언트 연결보다 긴 수명으로 진행 상태를 유지하는 데 사용합니다. 저장 로그와 읽는 주체의 상태를 구분해야 합니다.

stream은 메시지 보관함이고 consumer는 그 보관함에서 어떤 메시지를 전달하고 확인했는지 기록하는 읽기 상태입니다. durable은 이 소비 상태에 안정된 이름을 주어 연결이 끊겼다가 다시 와도 이어 쓸 수 있게 하는 설정입니다. 두 서비스가 독립적으로 전부 읽어야 한다면 각각의 소비 상태를 두고, 저장 정책도 그 용도를 허용해야 합니다.

분석 서비스와 알림 서비스가 같은 stream을 독립적으로 읽는다면 각각 별도의 consumer 상태가 필요할 수 있습니다. 이름을 잘못 공유하면 의도한 독립 소비가 아니라 같은 진행 위치를 공유할 수 있습니다. 반대로 매번 새 consumer를 만들면 기존 진행을 잃고 과거 메시지를 다시 읽을 수 있습니다. 시작 위치와 재생 정책을 명시하겠습니다.

내구 consumer가 있어도 stream의 보관 한도를 넘어 메시지가 삭제되면 무한히 과거를 복구할 수는 없습니다. consumer의 inactivity 정리와 retention 모드도 확인해야 합니다. 저는 배포 재시작 때 진행 위치가 이어지는지, 장기간 중단 뒤 필요한 데이터가 남는지 테스트하겠습니다. durable이라는 이름은 모든 상태가 영원히 보관된다는 뜻이 아니라 설정된 상태 수명의 계약입니다.

## 득점 포인트

- 저장 로그와 전달 상태를 나눈다.
- consumer 이름과 메시지를 처리할 서비스의 책임을 연결한다.
- 보관·비활성 정책의 한계를 확인한다.

## 감점 포인트

- durable이면 메시지가 영구 보존된다고 말한다.
- 서로 독립인 서비스를 같은 consumer 이름에 연결한다.
- 재시작마다 무조건 새 consumer를 만든다.

## 더 파고들 거리

- pull consumer와 push consumer는 흐름 제어에서 어떻게 다를까요?
- WorkQueue·Interest retention은 일반 limits 보관과 무엇이 다른가요?
- consumer를 삭제하고 다시 만들 때 진행 위치를 어떻게 복구할까요?
