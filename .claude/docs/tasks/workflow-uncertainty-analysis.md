# Workflow System - Uncertainty Analysis

Date: 2025-01-15

## 결측 정보 목록

### 1. 데이터 구조 (HIGH)
| 항목 | 질문 |
|------|------|
| DB Schema | Workflow, Stage, Provider, Role, Skill의 테이블 구조는? |
| 관계 정의 | 각 엔티티 간의 관계 (1:N, N:M)은? |
| 저장 형태 | JSON 형태로 통째로 저장 vs 정규화된 테이블? |

### 2. Provider 정의 (HIGH)
| 항목 | 질문 |
|------|------|
| Provider란? | LLM provider (OpenAI, Anthropic 등)인지, 아니면 다른 개념? |
| 설정 항목 | Provider별 어떤 설정이 필요한가? (API key, model, temperature 등) |
| 동적 추가 | 사용자가 Provider를 추가/관리할 수 있는가? |

### 3. Role/Agent 시스템 (HIGH)
| 항목 | 질문 |
|------|------|
| Role 정의 | 시스템에 미리 정의된 역할인지, 사용자 정의 가능한가? |
| Agent 매핑 | Role과 실제 실행 Agent의 매핑 방식은? |
| 권한 관리 | Role별 권한/제약 사항이 있는가? |

### 4. Skill 시스템 (MEDIUM)
| 항목 | 질문 |
|------|------|
| Skill 정의 | Skill의 정의와 등록 방식은? |
| Skill 검색 | Workflow 등록 시 어떤 Skill 목록을 제공하는가? |
| 파라미터 전달 | Skill 실행 시 필요한 파라미터를 어떻게 전달하는가? |

### 5. 프롬프트 구성 (HIGH)
| 항목 | 질문 |
|------|------|
| 템플릿화 | Provider, Role, Skill을 프롬프트에 어떻게 조립하는가? |
| 변수 치환 | 프롬프트 내 동적 변수 처리 방식은? |
| 검증 | 프롬프트 유효성 검증 규칙은? |

### 6. 실행 순서 및 데이터 흐름 (HIGH)
| 항목 | 질문 |
|------|------|
| 순차적 실행 | Stage 간 출력이 어떻게 다음 Stage의 입력으로 전달되는가? |
| 병렬 실행 | 일부 Stage를 병렬 실행할 수 있는가? |
| 조건부 실행 | 조건에 따라 Stage를 건너뛰거나 분기할 수 있는가? |

### 7. 에러 처리 (HIGH)
| 항목 | 질문 |
|------|------|
| Stage 실패 | 특정 Stage 실패 시 정책 (중단 vs 계속 vs 재시도)? |
| 재시도 정책 | 재시도 횟수, 백오프 전략은? |
| 롤백 | 실행 중 실패 시 이전 단계의 롤백이 필요한가? |

### 8. Order와의 연계 (HIGH)
| 항목 | 질문 |
|------|------|
| Workflow 선택 | Order 생성 시 어떤 기준으로 Workflow를 선택하는가? |
| 파라미터 전달 | Order의 어떤 데이터를 Workflow의 첫 Stage로 전달하는가? |
| 실행 결과 저장 | Workflow 실행 결과를 Order의 어디에/how 저장하는가? |

### 9. 버전 관리 (MEDIUM)
| 항목 | 질문 |
|------|------|
| Workflow 버전 | Workflow 수정 시 이력 관리가 필요한가? |
| 실행 시 버전 | Order 실행 시점의 Workflow 버전을 고정하는가? |

### 10. UI/UX (MEDIUM)
| 항목 | 질문 |
|------|------|
| Workflow 편집기 | 시각적 편집기 vs 텍스트/폼 기반? |
| Stage 순서 변경 | Drag & drop 등 순서 변경 UX는? |
| 실행 상태 모니터링 | 실행 중인 Stage의 진행 상태를 어떻게 표시하는가? |

---

## 우선순위별 정리

### HIGH (기획/구현 전 필수)
1. DB Schema 및 엔티티 관계
2. Provider 정의 및 설정 방식
3. Role/Agent 시스템 정의
4. 프롬프트 템플릿 구성 방식
5. Stage 간 데이터 흐름
6. 에러 처리 및 재시도 정책
7. Order와 Workflow 연계 방식

### MEDIUM (구현 중 결정)
8. Skill 시스템 상세
9. 버전 관리 정책
10. UI/UX 상세

---

## 추후 액션

위 HIGH 우선순위 항목들에 대한 답변이 필요합니다. 설계/구현을 진행하기 전에 이러한 불확실성을 해소해주세요.
