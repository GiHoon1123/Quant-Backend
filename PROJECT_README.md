# 📈 Quant Backend - 암호화폐 자동매매 시스템

**실시간 기술적 분석 기반 암호화폐 자동매매 백엔드 시스템**

---

## 🎯 프로젝트 개요

바이낸스 선물 웹소켓을 통해 실시간 15분봉 데이터를 수집하고, 20가지 기술적 분석 전략을 통해 매매 신호를 생성하여 자동 거래 및 텔레그램 알림을 제공하는 시스템입니다.

### 핵심 기능
- **실시간 데이터 수집**: 바이낸스 웹소켓을 통한 15분봉 실시간 수집
- **기술적 분석**: 20가지 전략 기반 매매 신호 생성
- **자동 거래**: 현물/선물 자동 매매 실행
- **실시간 알림**: 텔레그램을 통한 즉시 알림 발송
- **거래내역 관리**: 모든 거래 기록 및 성과 분석

---

## 🏗️ 시스템 아키텍처

### 이벤트 기반 아키텍처
```
웹소켓 데이터 수집 → DB 저장 → candle.saved 이벤트
                                      ↓
텔레그램 알림 ← analysis.completed 이벤트 ← 기술적 분석 실행
     ↓
자동 거래 실행 → trade.executed 이벤트 → 거래내역 저장
```

### 도메인 구조
```
src/
├── market-data/          # 실시간 데이터 수집 및 저장
├── technical-analysis/   # 기술적 분석 및 신호 생성
├── notification/         # 텔레그램 알림 시스템
├── order/               # 현물 거래 시스템
├── futures/             # 선물 거래 시스템
├── transaction/         # 거래내역 관리
└── common/              # 공통 유틸리티
```

---

## 🔧 기술 스택

### Backend
- **Framework**: NestJS 10.x + TypeScript
- **Database**: PostgreSQL + TypeORM
- **Real-time**: WebSocket (Binance API)
- **Event System**: EventEmitter2
- **API Documentation**: Swagger/OpenAPI
- **Testing**: Jest
- **Code Quality**: ESLint + Prettier

### External APIs
- **Binance API**: 현물/선물 거래, 실시간 데이터
- **Telegram Bot API**: 실시간 알림 발송

---

## 📊 주요 기능 상세

### 1. 실시간 데이터 처리
- **15분봉 실시간 수집**: 10개 주요 암호화폐 동시 모니터링
- **히스토리컬 데이터**: 4년치 140,000개 캔들 데이터 백필
- **메모리 캐싱**: 빠른 분석을 위한 최신 데이터 캐싱
- **자동 재연결**: 웹소켓 연결 실패 시 자동 복구

### 2. 기술적 분석 엔진
#### 20가지 분석 전략
- **이동평균선**: MA 20/50/100/150/200선 돌파, 골든크로스/데드크로스
- **모멘텀 지표**: RSI 과매수/과매도, MACD 골든크로스, RSI 다이버전스
- **변동성 지표**: 볼린저 밴드 상단 돌파, 하단 반등, 스퀴즈
- **거래량 분석**: 거래량 급증, OBV 트렌드, 거래량 이동평균 돌파
- **복합 전략**: 트리플 확인(MA+RSI+Volume), 다중 시간봉 분석

#### 실전 전략
- **데이 트레이딩**: 15분봉 기반 당일 매매 (-1.5% 손절, +2.5% 익절)
- **스윙 트레이딩**: 1시간봉 기반 중기 매매 (5-15% 목표)
- **포지션 트레이딩**: 일봉 기반 장기 매매 (20-50% 목표)

### 3. 자동 거래 시스템
#### 현물 거래
- **시장가/지정가 주문**: 즉시 체결 및 정확한 가격 체결
- **잔고 관리**: USDT 잔고 실시간 확인 및 충분성 검증
- **안전 장치**: 최소 주문 금액(10 USDT) 검증, 수수료 고려

#### 선물 거래
- **롱/숏 포지션**: 상승/하락 양방향 베팅
- **레버리지**: 1~125배 레버리지 지원
- **마진 모드**: 격리마진/교차마진 선택
- **리스크 관리**: 청산가 계산, 필요 마진 사전 검증

### 4. 알림 시스템
#### 15가지 알림 템플릿
- **가격 알림**: 신고가 갱신, 급등/급락, 전일 고점 돌파
- **기술적 지표**: MA 돌파, RSI 과매수/과매도, 볼린저 터치
- **특수 신호**: 골든크로스, MACD 골든크로스, 거래량 급증

#### 스마트 필터링
- **신뢰도 기반**: 85% 이상 신뢰도에서만 알림
- **HOLD 신호 제외**: 중요한 BUY/SELL 신호만 발송
- **중복 방지**: 동일 신호 1시간 내 재발송 방지

### 5. 거래내역 관리
#### 완전한 기록 시스템
```sql
-- 현물 거래
spot_trade_records: symbol, orderId, side, quantity, price, fee, executedAt

-- 선물 거래  
futures_trade_records: symbol, positionSide, leverage, pnl, liquidationPrice
```

#### 성과 분석
- **거래별 손익**: 개별 거래 수익률, 수수료, 보유시간
- **전략별 성과**: 기술적 분석 전략별 수익성 분석
- **시간대별 분석**: 거래 시간대별 성과 패턴

---

## ⚡ 성능 지표

### 실시간 처리
- **데이터 수집 → 분석**: 평균 200ms
- **분석 → 거래 실행**: 평균 300ms  
- **거래 → 알림 발송**: 평균 500ms
- **전체 파이프라인**: 1.5초 이내 완료

### 시스템 안정성
- **모니터링 대상**: 10개 주요 암호화폐 동시 처리
- **데이터 처리량**: 4년치 140,000개 캔들 안전 처리
- **가용성**: 24시간 무중단 운영, 자동 장애 복구
- **정확성**: 85% 이상 신뢰도 신호만 알림

---

## 🚀 설치 및 실행

### 환경 요구사항
```
Node.js 18+
PostgreSQL 14+
```

### 환경 변수 설정
```bash
# .env
BINANCE_API_KEY=your_binance_api_key
BINANCE_API_SECRET=your_binance_api_secret
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_telegram_chat_id

DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=password
DATABASE_NAME=quant_db
```

### 실행 방법
```bash
# 의존성 설치
npm install

# 데이터베이스 마이그레이션
npm run migration:run

# 개발 서버 실행
npm run start:dev
```

### API 문서
- **Swagger UI**: http://localhost:3000/api-docs

---

## 📡 주요 API 엔드포인트

### 캔들 데이터
```bash
GET /api/candles/15m/latest          # 최신 캔들 데이터
GET /api/candles/15m/history         # 과거 캔들 데이터
GET /api/candles/15m/status          # 구독 상태
```

### 히스토리컬 데이터 백필
```bash
POST /api/market-data/history/collect/{symbol}           # 4년치 데이터 수집
POST /api/market-data/history/collect/batch             # 전체 심볼 배치 수집
GET  /api/market-data/history/statistics/{symbol}       # 데이터 통계
```

### 거래 시스템
```bash
# 현물 거래
POST /api/order/market/buy           # 시장가 매수
POST /api/order/market/sell          # 시장가 매도
GET  /api/order/balances             # 잔고 조회

# 선물 거래
POST /api/futures/position/open      # 포지션 진입
POST /api/futures/position/close     # 포지션 청산
GET  /api/futures/positions          # 포지션 조회
GET  /api/futures/balances           # 선물 잔고
```

### 기술적 분석
```bash
POST /api/technical-analysis/analyze/{symbol}           # 단일 심볼 분석
POST /api/technical-analysis/batch                      # 배치 분석
GET  /api/technical-analysis/strategies                 # 지원 전략 목록
```

---

## 🔍 모니터링 대상 심볼

현재 10개 주요 선물 심볼을 모니터링합니다:

| 심볼 | 이름 | 카테고리 |
|------|------|----------|
| BTCUSDT | 비트코인 | 메이저코인 |
| ETHUSDT | 이더리움 | 메이저코인 |
| ADAUSDT | 에이다 | 알트코인 |
| SOLUSDT | 솔라나 | 알트코인 |
| DOGEUSDT | 도지코인 | 밈코인 |
| XRPUSDT | 리플 | 결제코인 |
| DOTUSDT | 폴카닷 | 플랫폼코인 |
| AVAXUSDT | 아발란체 | 플랫폼코인 |
| MATICUSDT | 폴리곤 | 레이어2 |
| LINKUSDT | 체인링크 | 오라클 |

---

## 📊 알림 예시

### 기술적 분석 알림
```
📈 [BTCUSDT] 비트코인 (메이저코인)

🚀 비트코인(BTCUSDT) 20선 상향 돌파!

📊 시간대: 15분봉
💵 현재가: 43,200.50
📈 20일선: 43,000.25
📊 돌파폭: +0.47%
🕒 돌파 시점: 2025-01-18 14:30:15 UTC (23:30:15 KST)
```

### 종합 분석 알림
```
📈 [BTCUSDT] 비트코인 (메이저코인)

📈 비트코인(BTCUSDT) 기술적 분석 완료!

📊 시간대: 15분봉
💵 현재가: 43000.80
🟢 시그널: 매수

📈 기술적 지표:
• SMA5: 42850.50
• SMA10: 42500.25
• SMA20: 42200.75
• 현재거래량: 1250.45
• 평균거래량: 850.30
• 거래량비율: 1.47배

🕒 분석 시점: 2025-01-18 14:30:15 UTC (23:30:15 KST)
```

---

## 🛡️ 안전 기능

### 자동 검증
- ✅ 입력값 유효성 검사 (수량, 레버리지 등)
- ✅ 잔고 충분성 확인
- ✅ 최소 주문 금액 검증 (현물 10 USDT, 선물 5 USDT)
- ✅ 포지션 존재 여부 확인

### 위험 관리
- ⚠️ 기존 포지션 존재 시 경고
- 🚨 청산 위험 포지션 모니터링
- 📊 실시간 손익 및 위험도 계산

### 에러 처리
- 🛡️ 바이낸스 API 에러 변환
- 📝 상세한 에러 메시지 제공
- 🔄 자동 재시도 로직

---

## 📝 개발 특징

### 아키텍처 패턴
- **이벤트 기반 아키텍처**: 도메인 간 느슨한 결합
- **도메인 주도 설계**: 명확한 도메인 분리
- **Clean Architecture**: 계층별 책임 분리

### 코드 품질
- **TypeScript 100%**: 완전한 타입 안전성
- **테스트 커버리지**: Jest 기반 단위/통합 테스트
- **코드 표준화**: ESLint + Prettier 자동 포맷팅
- **API 문서화**: Swagger 자동 생성

### 성능 최적화
- **메모리 캐싱**: 최신 캔들 데이터 인메모리 저장
- **배치 처리**: Rate Limit 준수한 안전한 대용량 처리
- **비동기 처리**: 이벤트 기반 논블로킹 처리

---

## ⚠️ 주의사항

### 투자 위험
- 암호화폐 투자는 높은 위험을 수반합니다
- 선물거래 시 레버리지로 인한 큰 손실 가능성
- 충분한 이해와 위험 관리 후 사용 권장

### 시스템 제한
- 바이낸스 API Rate Limit 준수 필요
- 네트워크 상황에 따른 지연 가능성
- 시장 급변동 시 슬리피지 발생 가능

---

## 📄 라이선스

MIT License - 자세한 내용은 [LICENSE](LICENSE) 파일 참조