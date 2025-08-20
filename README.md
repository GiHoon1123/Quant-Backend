# 📈 Quant Backend

**바이낸스 선물 자동매매 시스템**

실시간 15분봉 데이터 수집 → 기술적 분석 → 자동매매 → 텔레그램 알림을 통합한 퀀트 트레이딩 백엔드입니다.

---

## 🎯 핵심 기능

### 📊 실시간 데이터 처리

- 바이낸스 선물 웹소켓을 통한 실시간 15분봉 수집
- PostgreSQL 영구 저장 + 인메모리 캐시

### 🔍 기술적 분석

- RSI, MACD, 볼린저 밴드, 이동평균선 분석
- 거래량 분석 및 패턴 인식
- BUY/SELL/HOLD 시그널 자동 생성

### 🤖 자동매매

- 기술적 분석 결과 기반 자동 주문 실행
- 리스크 관리 및 포지션 관리
- 실시간 손익 모니터링

### 📱 텔레그램 알림

- 매매 신호 및 실행 결과 실시간 알림
- 개별 전략별 상세 알림
- 포지션 현황 및 수익률 보고

## 🛠️ 기술 스택

- **Backend**: NestJS + TypeScript
- **Database**: PostgreSQL + TypeORM
- **API**: Binance Futures API & WebSocket
- **Notification**: Telegram Bot API

---

## 🚀 실행 방법

```bash
# 의존성 설치
npm install

# 테이블 마이그레이션
npm run migration:run

# 실행
npm run start:dev
```

**환경변수 설정** (`.env` 파일)

```bash
# Database Configuration
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=root
DATABASE_PASSWORD=1234
DATABASE_NAME=quant_engine

# Binance API Configuration
BINANCE_API_KEY=your_key
BINANCE_API_SECRET=your_secret

# Telegram Configuration
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# Market Data Configuration
MONITORED_SYMBOLS=BTCUSDT,ETHUSDT,SOLUSDT,ADAUSDT,DOGEUSDT,XRPUSDT,DOTUSDT,AVAXUSDT,MATICUSDT,LINKUSDT
MAX_MEMORY_CANDLES=20000

# Cache Configuration
CACHE_DEFAULT_TTL=3600000
CACHE_CLEANUP_INTERVAL=600000

# ATR Configuration (API로 조정 가능)
ATR_STOP_LOSS_MULTIPLIER=0.028
ATR_TAKE_PROFIT_MULTIPLIER=0.04
ATR_RISK_REWARD_RATIO=2.0

# Emergency Configuration
EMERGENCY_STOP_LOSS_PERCENT=0.03
EMERGENCY_TAKE_PROFIT_PERCENT=0.06
EMERGENCY_ENABLED=true
EMERGENCY_CHECK_INTERVAL=1000
```

---

## 📡 주요 API

### 실시간 데이터

- `GET /api/candle15m/latest` - 최신 캔들 조회
- `POST /api/candle15m/subscription/add/:symbol` - 심볼 구독 추가

### 자동매매

- `POST /order/market/buy` - 시장가 매수
- `POST /order/market/sell` - 시장가 매도
- `GET /futures/positions` - 포지션 조회

### 기술적 분석

- `GET /technical-analysis/analyze/:symbol` - 분석 실행
- `GET /technical-analysis/buy-signals` - 매수 신호 조회

### 테스트

- `POST /test/candle15m` - 캔들 데이터 직접 입력 테스트
- `POST /test/telegram/:symbol` - 텔레그램 알림 테스트

**API 문서**: `http://localhost:3000/api` (Swagger)

---

## 📊 모니터링 심볼

BTCUSDT, ETHUSDT, SOLUSDT, ADAUSDT, DOGEUSDT, XRPUSDT, DOTUSDT, AVAXUSDT, MATICUSDT, LINKUSDT
