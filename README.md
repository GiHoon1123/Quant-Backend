# 📈 Quant Backend

**Binance 선물 15분봉 실시간 수집 및 기술적 분석 시스템**

바이낸스 선물 웹소켓을 통해 실시간 15분봉 데이터를 수집하고, 기술적 분석을 수행하여 텔레그램으로 알림을 보내는 시스템입니다.

---

## 🎯 핵심 기능

### 📊 실시간 데이터 처리

- **15분봉 실시간 수집**: 바이낸스 선물 웹소켓을 통한 실시간 캔들 데이터 수집
- **메모리 캐시**: 빠른 조회를 위한 인메모리 캔들 데이터 저장
- **DB 영구 저장**: PostgreSQL을 이용한 캔들 데이터 영구 보관

### 🔍 기술적 분석

- **이동평균선 분석**: SMA 5, 10, 20 기반 트렌드 분석
- **거래량 분석**: 평균 거래량 대비 급등/급락 감지
- **시그널 생성**: BUY/SELL/HOLD 시그널 자동 생성

### 📱 텔레그램 알림 시스템

- **실시간 분석 결과 알림**: 기술적 분석 완료 시 자동 알림
- **다양한 알림 템플릿**: 가격 변동, 기술적 지표, 뉴스 등
- **UTC/KST 시간 표시**: 글로벌 시간대 지원
- **상세한 설명**: 각 시그널의 의미와 투자 전략 제안

---

## 🛠️ 기술 스택

- **Backend**: Node.js (NestJS 10.x) + TypeScript
- **Database**: PostgreSQL + TypeORM
- **WebSocket**: Binance Futures WebSocket API
- **Notification**: Telegram Bot API
- **Caching**: In-Memory Cache
- **API Documentation**: Swagger

---

## � 환경 설정

### 환경변수 설정 (.env)

```bash
# 바이낸스 API 설정
BINANCE_API_KEY=your_binance_api_key_here
BINANCE_API_SECRET=your_binance_api_secret_here

# 텔레그램 알림 설정
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
TELEGRAM_CHAT_ID=your_telegram_chat_id_here

# 데이터베이스 설정
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=password
DATABASE_NAME=quant_db
```

### 텔레그램 봇 설정 방법

1. **BotFather에서 봇 생성**:

   - Telegram에서 `@BotFather` 검색
   - `/newbot` 명령어로 새 봇 생성
   - 봇 이름과 username 설정
   - 생성된 `BOT_TOKEN` 복사

2. **Chat ID 확인**:
   - 봇과 대화 시작 (메시지 1개 전송)
   - `https://api.telegram.org/bot<BOT_TOKEN>/getUpdates` 접속
   - 응답에서 `chat.id` 값 확인

---

## 🏁 실행 방법

```bash
# 의존성 설치
npm install

# 데이터베이스 마이그레이션
npm run migration:run

# 개발 서버 실행
npm run start:dev
```

---

## 📡 API 엔드포인트

### 캔들 데이터 조회

- `GET /api/candles/15m/latest` - 최신 캔들 데이터 조회
- `GET /api/candles/15m/history` - 과거 캔들 데이터 조회
- `GET /api/candles/15m/status` - 구독 상태 조회

### 히스토리컬 데이터 백필 (Backfill)

**4년치 과거 데이터 수집 API** - 데이터 복구 및 백테스팅용

- `POST /api/market-data/history/collect/{symbol}` - 4년치 전체 데이터 수집
- `POST /api/market-data/history/collect/{symbol}/period?startTime={timestamp}&endTime={timestamp}` - 특정 기간 데이터 수집
- `POST /api/market-data/history/collect/batch` - 전체 심볼 배치 수집
- `GET /api/market-data/history/statistics/{symbol}` - 심볼별 데이터 통계 조회
- `GET /api/market-data/history/symbols` - 지원 심볼 목록 조회

#### 백필 API 사용 예시

```bash
# BTCUSDT 4년치 전체 데이터 수집 (약 1-2분 소요)
curl -X POST http://localhost:3000/api/market-data/history/collect/BTCUSDT

# 특정 기간 데이터 수집 (2023년 1월~12월)
curl -X POST "http://localhost:3000/api/market-data/history/collect/BTCUSDT/period?startTime=1672531200000&endTime=1704067200000"

# BTCUSDT 데이터 통계 조회
curl http://localhost:3000/api/market-data/history/statistics/BTCUSDT

# 지원 심볼 목록 조회
curl http://localhost:3000/api/market-data/history/symbols

# 전체 주요 심볼 배치 수집 (매우 오래 걸림, 30분 이상)
curl -X POST http://localhost:3000/api/market-data/history/collect/batch
```

#### 백필 API 특징

- **안전한 순차 처리**: 바이낸스 API Rate Limit 준수 (500ms 간격)
- **중복 방지**: 기존 데이터 자동 스킵으로 안전한 재실행
- **재시작 지원**: 중단된 지점부터 재개 가능
- **실시간 모니터링**: 진행 상황 로깅 및 텔레그램 알림
- **대용량 처리**: 최대 4년치 약 140,000개 캔들 수집
- **에러 복구**: 개별 요청 실패 시 자동 재시도

### 텔레그램 알림 테스트

- `POST /api/candles/15m/test/telegram/analysis` - 기술적 분석 알림 테스트
- `POST /api/candles/15m/test/telegram/price-rise` - 가격 상승 알림 테스트
- `POST /api/candles/15m/test/telegram/ma-breakout` - 이동평균 돌파 알림 테스트
- `POST /api/candles/15m/test/telegram/rsi` - RSI 알림 테스트
- `POST /api/candles/15m/test/telegram/bollinger` - 볼린저 밴드 알림 테스트

### API 문서

- **Swagger UI**: `http://localhost:3000/api` (서버 실행 후 접속)

---

## 📊 알림 템플릿 예시

### 기술적 분석 알림

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

### 이동평균 돌파 알림

```
📌 [BTCUSDT] 비트코인 (메이저코인)

🚀 비트코인(BTCUSDT) 20선 상향 돌파!

📊 시간대: 15분봉
💵 현재가: 43200.50
📈 20일선: 43000.25
📊 돌파폭: +0.47%
🕒 돌파 시점: 2025-01-18 14:30:15 UTC (23:30:15 KST)
```

---

## 🔮 모니터링 대상 심볼

현재 다음 10개 주요 선물 심볼을 모니터링합니다:

- **BTCUSDT** (비트코인) - 메이저코인
- **ETHUSDT** (이더리움) - 메이저코인
- **ADAUSDT** (에이다) - 알트코인
- **SOLUSDT** (솔라나) - 알트코인
- **DOGEUSDT** (도지코인) - 밈코인
- **XRPUSDT** (리플) - 결제코인
- **DOTUSDT** (폴카닷) - 플랫폼코인
- **AVAXUSDT** (아발란체) - 플랫폼코인
- **MATICUSDT** (폴리곤) - 레이어2
- **LINKUSDT** (체인링크) - 오라클

---

## 📊 히스토리컬 데이터 백필 시나리오

### 1. 새로운 프로젝트 시작 시

```bash
# 1단계: 주요 심볼들의 4년치 데이터 수집
curl -X POST http://localhost:3000/api/market-data/history/collect/BTCUSDT
curl -X POST http://localhost:3000/api/market-data/history/collect/ETHUSDT

# 2단계: 수집 결과 확인
curl http://localhost:3000/api/market-data/history/statistics/BTCUSDT

# 예상 결과: 약 140,000개 캔들 (4년 × 365일 × 24시간 × 4개/시간)
```

### 2. 데이터 손실 복구 시

```bash
# 2023년 1월~12월 데이터만 재수집
curl -X POST "http://localhost:3000/api/market-data/history/collect/BTCUSDT/period?startTime=1672531200000&endTime=1704067200000"

# 데이터 완성도 확인 (90% 이상이면 정상)
curl http://localhost:3000/api/market-data/history/statistics/BTCUSDT
```

### 3. 백테스팅 준비 시

```bash
# 모든 주요 심볼 배치 수집 (주의: 30분 이상 소요)
curl -X POST http://localhost:3000/api/market-data/history/collect/batch

# 또는 필요한 심볼만 개별 수집
curl -X POST http://localhost:3000/api/market-data/history/collect/ETHUSDT
curl -X POST http://localhost:3000/api/market-data/history/collect/SOLUSDT
```

### 4. 백필 수집 결과 예시

```json
{
  "symbol": "BTCUSDT",
  "totalCollected": 140160,
  "totalSkipped": 0,
  "totalRequests": 94,
  "errors": 0,
  "duration": 47000,
  "startTime": 1609459200000,
  "endTime": 1641081600000
}
```

### 5. 데이터 통계 예시

```json
{
  "symbol": "BTCUSDT",
  "totalCandles": 140160,
  "earliestCandle": 1609459200000,
  "latestCandle": 1641081600000,
  "coverageDays": 1461,
  "estimatedCompleteness": 99.8
}
```

---

## ⚠️ 백필 사용 시 주의사항

### Rate Limit 관련

- **바이낸스 API 제한**: 1200 requests/minute
- **안전 간격**: 500ms per request (실제로는 더 여유롭게)
- **병렬 처리 금지**: 순차 처리만 지원
- **재시도 로직**: 최대 3회 자동 재시도

### 소요 시간 예상

- **1개 심볼 4년치**: 약 1-2분
- **10개 심볼 배치**: 약 15-30분
- **20개 심볼 배치**: 약 30-60분

### 중단/재시작

- **안전한 중단**: 개별 요청 완료 후 중단 가능
- **자동 재시작**: 기존 데이터 확인 후 빠진 부분만 수집
- **중복 방지**: 동일 시간대 데이터 자동 스킵

### 모니터링

- **실시간 로그**: 서버 콘솔에서 진행 상황 확인
- **텔레그램 알림**: 시작/중간보고/완료 시 자동 알림
- **통계 API**: 수집 완료 후 데이터 품질 확인

---

## 🔜 향후 구현 예정

- [ ] 더 정교한 기술적 지표 (RSI, MACD, 볼린저 밴드)
- [ ] 골든크로스/데드크로스 감지
- [ ] 거래량 기반 알림 (급등/급락 감지)
- [ ] 지지/저항 레벨 분석
- [ ] 백테스팅 시스템
- [ ] 웹 대시보드 (실시간 차트)
- [ ] 사용자 설정 기반 알림 필터링
- [ ] 다중 시간대 분석 (1분, 5분, 1시간, 일봉)

---

## 📝 로그 예시

```bash
🚀 Realtime15MinAggregator 모듈 초기화 시작
💾 데이터베이스에서 최근 캔들 데이터 로딩 시작
📊 BTCUSDT 메모리 로딩 완료: 150개 캔들
✅ 메모리 캔들 데이터 로딩 완료: 10개 심볼, 1,500개 캔들

🚀 선물 15분봉 실시간 모니터링 시작
📊 모니터링 대상: 10개 심볼
✅ BTCUSDT 선물 15분봉 구독 완료
📊 웹소켓 구독 완료: 성공 10개, 실패 0개

🕐 [BTCUSDT] 15분봉 완성: 2025-01-18 23:30:00 (종가: $43000.80)
💾 [BTCUSDT] DB 저장 완료: 2025-01-18 23:30:00
🎯 [BTCUSDT] 캔들 완성 이벤트 발생
📨 텔레그램 전송 완료: BTCUSDT
```
