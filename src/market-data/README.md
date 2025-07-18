# 15분봉 실시간 캔들 데이터 시스템

이 시스템은 바이낸스 선물 거래소에서 15분봉 캔들 데이터를 실시간으로 수신하여 저장하고, 기술적 분석을 수행하여 텔레그램으로 알림을 발송하는 기능을 제공합니다.

## 🚀 주요 기능

### 1. 실시간 데이터 수신

- **바이낸스 웹소켓 연결**: 선물 거래소 15분봉 스트림 구독
- **다중 심볼 지원**: 여러 암호화폐 쌍 동시 처리
- **자동 재연결**: 연결 실패 시 자동 복구
- **에러 처리**: 안정적인 데이터 수신 보장

### 2. 데이터 저장 및 관리

- **데이터베이스 저장**: TypeORM을 통한 MySQL/PostgreSQL 저장
- **메모리 캐시**: 빠른 접근을 위한 최신 데이터 캐싱
- **중복 방지**: UPSERT 패턴으로 데이터 무결성 보장
- **통계 기능**: 캔들 데이터 통계 정보 제공

### 3. 기술적 분석 및 알림

- **실시간 기술적 분석**: 캔들 완성 시 자동 분석 수행
- **텔레그램 알림**: 매매 시그널 발생 시 즉시 알림
- **다양한 지표**: SMA, 볼륨 분석 등
- **스마트 필터링**: HOLD 시그널은 알림 안함

### 4. REST API

- **히스토리 데이터 조회**: 과거 캔들 데이터 검색
- **최신 데이터 조회**: 현재 진행 중인 캔들 정보
- **통계 조회**: 전체 시스템 통계 정보
- **구독 관리**: 심볼 구독/해제 제어

## 📁 파일 구조

```
src/market-data/
├── dto/candle/
│   └── Candle15MEntity.ts          # 15분봉 엔티티 및 인터페이스
├── infra/candle/
│   ├── BinanceCandle15MStream.ts   # 웹소켓 스트림 클래스
│   ├── BinanceCandle15MManager.ts  # 스트림 매니저
│   └── Candle15MRepository.ts      # 데이터베이스 레포지토리
├── service/candle/
│   └── Candle15MService.ts         # 비즈니스 로직 서비스
├── web/candle/
│   ├── Candle15MController.ts      # REST API 컨트롤러
│   └── Candle15MGateway.ts         # 웹소켓 게이트웨이
└── MarketDataModule.ts             # NestJS 모듈 설정
```

## 🔧 설정 및 사용법

### 1. 모듈 등록

MarketDataModule이 자동으로 15분봉 관련 서비스들을 등록합니다:

```typescript
@Module({
  imports: [TypeOrmModule.forFeature([Candle15M])],
  providers: [Candle15MService, Candle15MRepository, Candle15MGateway],
  controllers: [Candle15MController],
  exports: [Candle15MService, Candle15MRepository],
})
export class MarketDataModule {}
```

### 2. 자동 시작

애플리케이션 시작 시 자동으로 기본 심볼들(DEFAULT_SYMBOLS)을 구독합니다:

```typescript
// 기본 구독 심볼들이 자동으로 시작됨
onModuleInit() {
  DEFAULT_SYMBOLS.forEach((symbol) => {
    this.manager.subscribe(symbol);
  });
}
```

## 📡 API 사용법

### REST API 엔드포인트

#### 1. 최신 캔들 데이터 조회

```bash
# 특정 심볼의 최신 캔들
GET /api/candle15m/latest/BTCUSDT

# 모든 심볼의 최신 캔들
GET /api/candle15m/latest
```

#### 2. 히스토리 데이터 조회

```bash
# 최근 100개 캔들 조회
GET /api/candle15m/history/BTCUSDT?limit=100

# 시간 범위 지정 조회
GET /api/candle15m/history/BTCUSDT?startTime=1705555200000&endTime=1705641600000
```

#### 3. 통계 정보 조회

```bash
# 전체 캔들 통계
GET /api/candle15m/statistics
```

#### 4. 구독 관리

```bash
# 심볼 구독 추가
POST /api/candle15m/subscription/add/ETHUSDT

# 심볼 구독 해제
POST /api/candle15m/subscription/remove/ETHUSDT

# 구독 상태 조회
GET /api/candle15m/subscription/status
```

### 웹소켓 API 사용법

#### 1. 연결

```javascript
const socket = io('ws://localhost:3000/candle15m');

socket.on('connected', (data) => {
  console.log('연결됨:', data.message);
});
```

#### 2. 심볼 구독

```javascript
// 단일 심볼 구독
socket.emit('subscribe', 'BTCUSDT');

// 다중 심볼 구독
socket.emit('subscribe', ['BTCUSDT', 'ETHUSDT', 'ADAUSDT']);

// 구독 완료 응답
socket.on('subscribed', (data) => {
  console.log('구독 완료:', data.symbols);
});
```

#### 3. 실시간 데이터 수신

```javascript
// 캔들 업데이트 수신
socket.on('candle.update', (data) => {
  console.log('캔들 업데이트:', {
    symbol: data.symbol,
    price: data.candle.close,
    time: new Date(data.candle.openTime),
    isCompleted: data.isCompleted,
  });
});

// 캔들 완성 이벤트 수신
socket.on('candle.completed', (data) => {
  console.log('캔들 완성:', {
    symbol: data.symbol,
    finalPrice: data.candle.close,
    volume: data.candle.volume,
  });
});
```

#### 4. 구독 해제

```javascript
// 특정 심볼 구독 해제
socket.emit('unsubscribe', 'BTCUSDT');

// 구독 상태 확인
socket.emit('getSubscriptions');
socket.on('subscriptions', (data) => {
  console.log('현재 구독:', data.symbols);
});
```

## 🔍 모니터링 및 디버깅

### 1. 로그 확인

시스템 동작 상태를 콘솔 로그로 확인할 수 있습니다:

```
[Candle15MService] 15분봉 서비스 초기화 시작
[BinanceCandle15MStream] 연결 시도 중: BTCUSDT (btcusdt@kline_15m)
[BinanceCandle15MStream] 연결 성공: BTCUSDT
[Candle15MService] 15분봉 데이터 수신: BTCUSDT - 2025-07-18T15:00:00.000Z (진행중)
[Candle15MGateway] 캔들 업데이트 브로드캐스트: BTCUSDT
```

### 2. 상태 조회 API

```bash
# 서비스 상태 확인
GET /api/candle15m/subscription/status

# 응답 예시
{
  "success": true,
  "data": {
    "subscribedSymbols": ["BTCUSDT", "ETHUSDT"],
    "connectionStatus": {
      "BTCUSDT": true,
      "ETHUSDT": true
    },
    "cacheSize": 2,
    "ongoingCandlesCount": 2
  }
}
```

## 🎯 이벤트 기반 확장

### 캔들 완성 이벤트 활용

```typescript
// 다른 서비스에서 캔들 완성 이벤트 수신
candle15MService.on('candle.completed', (data) => {
  // 기술적 분석 실행
  technicalAnalysisService.analyze(data.symbol, data.candleData);

  // 알림 발송
  notificationService.sendAlert(data.symbol, data.candleData);

  // 전략 실행
  tradingStrategyService.execute(data.symbol, data.candleData);
});
```

## 🔒 에러 처리 및 복구

### 1. 자동 재연결

- 웹소켓 연결 실패 시 지수 백오프로 재연결
- 최대 10회 재연결 시도
- 연결 상태 지속 모니터링

### 2. 데이터 무결성

- 중복 데이터 자동 처리 (UPSERT)
- 트랜잭션 안전성 보장
- 에러 발생 시 상세 로깅

### 3. 장애 복구

```typescript
// 수동 재연결 (필요시)
await candle15MService.subscribeSymbol('BTCUSDT');

// 연결 끊김 감지 시 자동 복구
manager.reconnectDisconnected();
```

## 📈 성능 최적화

### 1. 메모리 캐시

- 최신 캔들 데이터를 메모리에 캐싱
- 빠른 조회 성능 제공
- 자동 캐시 업데이트

### 2. 데이터베이스 최적화

- 복합 인덱스 활용
- 배치 처리 지원
- 오래된 데이터 정리 기능

### 3. 웹소켓 최적화

- 심볼별 Room 분리
- 선택적 데이터 전송
- 연결 풀 관리

## 🚨 주의사항

1. **DEFAULT_SYMBOLS 설정**: `src/common/constant/DefaultSymbols.ts`에서 기본 구독 심볼 설정
2. **데이터베이스 마이그레이션**: Candle15M 테이블 생성 필요
3. **웹소켓 연결 제한**: 바이낸스 API 제한사항 준수
4. **메모리 사용량**: 다수 심볼 구독 시 메모리 모니터링 필요

## 🔧 추가 개발 계획

1. **기술적 분석 연동**: RSI, MACD, 볼린저 밴드 등
2. **알림 시스템**: 텔레그램, 이메일, 웹훅 지원
3. **백테스팅**: 히스토리 데이터 기반 전략 테스트
4. **다중 시간봉**: 1분, 5분, 1시간, 4시간봉 확장
5. **현물 시장**: 선물 외 현물 거래 데이터 지원

---

이 시스템은 실시간 암호화폐 데이터 처리의 기반을 제공하며, 추가 기능들을 쉽게 확장할 수 있도록 설계되었습니다.
