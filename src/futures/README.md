# 🚀 바이낸스 선물거래 API 모듈

## 📋 개요

바이낸스 선물거래 API를 완전히 래핑한 NestJS 모듈입니다. 안전한 선물거래를 위한 다양한 검증과 예외처리가 포함되어 있습니다.

## ⚠️ 중요한 위험 경고

```
🚨 선물거래는 매우 높은 위험을 수반합니다!
- 레버리지 사용 시 손실이 원금을 초과할 수 있습니다
- 충분한 이해 없이 사용하지 마세요
- 반드시 테스트넷에서 충분히 테스트하세요
- 소액으로 시작하여 경험을 쌓으세요
```

## 🏗️ 모듈 구조

```
src/futures/
├── dto/
│   ├── request/           # 요청 DTO
│   │   ├── OpenPositionRequest.ts
│   │   ├── ClosePositionRequest.ts
│   │   ├── SetLeverageRequest.ts
│   │   └── SetMarginTypeRequest.ts
│   ├── external/          # 바이낸스 API 응답 DTO
│   │   ├── ExternalFuturesOrderResponse.ts
│   │   ├── ExternalPositionResponse.ts
│   │   └── ExternalFuturesBalanceResponse.ts
│   └── response/          # 내부 응답 DTO
│       ├── PositionOpenResponse.ts
│       ├── PositionInfoResponse.ts
│       └── FuturesBalanceResponse.ts
├── infra/                 # 바이낸스 API 클라이언트
│   ├── BinanceFuturesClient.ts
│   └── BinanceFuturesPositionClient.ts
├── service/
│   └── FuturesService.ts  # 핵심 비즈니스 로직
├── web/
│   └── FuturesController.ts # REST API 엔드포인트
└── FuturesModule.ts       # 모듈 설정
```

## 🔧 주요 기능

### 1. 포지션 관리

- **포지션 진입**: 롱/숏 포지션 시장가 진입
- **포지션 청산**: 전체/부분 청산 지원
- **포지션 조회**: 실시간 포지션 정보 및 손익

### 2. 설정 관리

- **레버리지 설정**: 1~125배 레버리지 설정
- **마진 모드**: 격리마진/교차마진 설정

### 3. 정보 조회

- **잔고 조회**: 선물 계정 잔고 및 사용가능 금액
- **위험 관리**: 청산 위험이 높은 포지션 모니터링

## 📚 API 엔드포인트

### 포지션 관리

#### 1. 포지션 진입

```http
POST /futures/position/open
Content-Type: application/json

{
  "symbol": "BTCUSDT",
  "side": "LONG",      // LONG(상승베팅) 또는 SHORT(하락베팅)
  "quantity": 0.001,   // 포지션 수량
  "leverage": 10       // 레버리지 (1~125)
}
```

#### 2. 포지션 청산

```http
POST /futures/position/close
Content-Type: application/json

{
  "symbol": "BTCUSDT",
  "quantity": 0.0005   // 부분청산 수량 (생략 시 전체 청산)
}
```

#### 3. 포지션 조회

```http
GET /futures/positions
GET /futures/positions?symbol=BTCUSDT  # 특정 심볼만
```

### 설정 관리

#### 4. 레버리지 설정

```http
POST /futures/leverage
Content-Type: application/json

{
  "symbol": "BTCUSDT",
  "leverage": 20
}
```

#### 5. 마진 모드 설정

```http
POST /futures/margin-type
Content-Type: application/json

{
  "symbol": "BTCUSDT",
  "marginType": "ISOLATED"  // ISOLATED 또는 CROSSED
}
```

### 정보 조회

#### 6. 잔고 조회

```http
GET /futures/balances
```

#### 7. 위험 포지션 조회

```http
GET /futures/positions/high-risk
GET /futures/positions/high-risk?riskThreshold=0.8
```

## 🔒 안전 기능

### 1. 자동 검증

- ✅ 입력값 유효성 검사 (수량, 레버리지 등)
- ✅ 잔고 충분성 확인
- ✅ 최소 주문 금액 검증 (5 USDT)
- ✅ 포지션 존재 여부 확인

### 2. 위험 관리

- ⚠️ 기존 포지션 존재 시 경고
- 🚨 청산 위험 포지션 모니터링
- 📊 실시간 손익 및 위험도 계산

### 3. 에러 처리

- 🛡️ 바이낸스 API 에러 변환
- 📝 상세한 에러 메시지 제공
- 🔄 재시도 로직 (필요 시)

## 💡 사용 예시

### 기본적인 롱 포지션 진입

```typescript
// 1. 레버리지 설정 (자동으로 처리됨)
// 2. BTC 0.001개 롱 포지션, 10배 레버리지
const position = await futuresService.openPosition(
  'BTCUSDT',
  PositionSide.LONG,
  0.001,
  10,
);
```

### 안전한 포지션 관리 플로우

```typescript
// 1. 잔고 확인
const balances = await futuresService.getFuturesBalances();

// 2. 위험 포지션 확인
const riskPositions = await futuresService.getHighRiskPositions();

// 3. 포지션 진입
if (balances.find((b) => b.asset === 'USDT')?.availableBalance > 100) {
  const position = await futuresService.openPosition(
    'BTCUSDT',
    PositionSide.LONG,
    0.001,
    5, // 낮은 레버리지로 시작
  );
}

// 4. 정기적인 모니터링
const currentPositions = await futuresService.getPositions();
```

## 🛠️ 환경 설정

### 1. 환경 변수 설정

```env
# .env 파일에 바이낸스 API 키 설정
BINANCE_API_KEY=your_api_key_here
BINANCE_API_SECRET=your_api_secret_here
```

### 2. 바이낸스 API 권한

선물거래를 위해서는 다음 권한이 필요합니다:

- ✅ **Futures Trading**: 선물거래 권한
- ✅ **Read Info**: 계정 정보 조회
- ❌ **Withdraw**: 출금 권한 (권장하지 않음)

### 3. IP 화이트리스트

보안을 위해 바이낸스에서 IP 화이트리스트 설정을 권장합니다.

## 📊 마진 모드 가이드

### ISOLATED (격리마진) - 초보자 권장

- ✅ **장점**: 포지션별 독립적 마진, 위험 제한적
- ❌ **단점**: 자금 효율성 낮음
- 🎯 **추천**: 초보자, 리스크 관리 중시

### CROSSED (교차마진) - 숙련자용

- ✅ **장점**: 전체 잔고 활용, 청산 위험 낮음
- ❌ **단점**: 전체 계정 위험 노출
- 🎯 **추천**: 숙련자, 자금 효율성 중시

## 🎚️ 레버리지 가이드

| 레버리지 | 위험도  | 권장 대상 | 특징                 |
| -------- | ------- | --------- | -------------------- |
| 1~5배    | 🟢 낮음 | 초보자    | 안전하지만 수익 제한 |
| 5~20배   | 🟡 중간 | 중급자    | 균형잡힌 위험/수익   |
| 20~125배 | 🔴 높음 | 전문가    | 고위험 고수익        |

## 🚨 위험 관리 수칙

1. **소액으로 시작**: 처음에는 작은 금액으로 경험 쌓기
2. **낮은 레버리지**: 5배 이하로 시작 권장
3. **스탑로스 설정**: 손실 제한선 미리 정하기
4. **정기 모니터링**: 포지션 상태 주기적 확인
5. **감정 배제**: 객관적인 판단 유지
6. **자금 분산**: 한 번에 모든 자금 투입 금지

## 📖 추가 학습 자료

- [바이낸스 선물거래 가이드](https://academy.binance.com/ko/articles/what-are-cryptocurrency-futures)
- [레버리지 거래 위험성](https://academy.binance.com/ko/articles/what-is-leverage-in-crypto-trading)
- [마진 거래 기초](https://academy.binance.com/ko/articles/margin-trading-101)

---

**⚠️ 면책 조항**: 이 모듈은 기술적 구현체이며, 투자 조언이 아닙니다. 모든 거래는 본인 책임하에 진행하시기 바랍니다.
