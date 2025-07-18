import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * 15분봉 캔들 데이터 엔티티
 *
 * 바이낸스에서 수신한 15분봉 캔들스틱 데이터를 저장하는 엔티티입니다.
 * 선물 거래 시스템에서 기술적 분석 및 실시간 알림 기능을 위해 사용됩니다.
 *
 * 주요 특징:
 * - 선물/현물 시장 구분 저장 (market 컬럼)
 * - 고정밀 소수점 지원 (DECIMAL 20,8 - 암호화폐 가격 정확도)
 * - 중복 방지 및 성능 최적화 (복합 유니크 인덱스)
 * - 자동 타임스탬프 관리 (생성/수정 시간)
 * - 데이터 유효성 검증 (BeforeInsert/BeforeUpdate 훅)
 *
 * @example
 * ```typescript
 * const candle = new Candle15M();
 * candle.symbol = 'BTCUSDT';
 * candle.market = 'FUTURES';
 * candle.open = 42850.50;
 * candle.high = 42950.75;
 * candle.low = 42750.25;
 * candle.close = 42825.80;
 * // ... 기타 속성 설정
 * await repository.save(candle);
 * ```
 */
@Entity('candle_15m')
@Index(['symbol', 'market']) // 심볼+시장별 조회 최적화 (가장 자주 사용)
@Index(['symbol', 'market', 'openTime']) // 시간 범위 조회 최적화 (백테스팅용)
@Index(['createdAt']) // 최신 데이터 조회 최적화
export class Candle15MEntity {
  /**
   * 고유 식별자 (자동 증가)
   *
   * 각 캔들 레코드의 고유한 식별자입니다.
   * PostgreSQL의 BIGSERIAL을 사용하여 대용량 데이터 처리를 지원합니다.
   */
  @PrimaryGeneratedColumn('increment')
  id: number;

  /**
   * 거래 심볼 (Trading Symbol)
   *
   * 암호화폐 거래 쌍을 나타냅니다.
   * 바이낸스 API 형식을 따라 기본자산과 견적자산을 조합합니다.
   *
   * @length 20자 이내
   * @example 'BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'SOLUSDT'
   */
  @Column({
    type: 'varchar',
    length: 20,
    nullable: false,
    comment: '거래 심볼 (예: BTCUSDT, ETHUSDT, ADAUSDT)',
  })
  symbol: string;

  /**
   * 시장 구분 (Market Type)
   *
   * 거래가 이루어지는 시장의 종류를 구분합니다.
   * - 'FUTURES': 선물 거래 (레버리지 거래, 마진 거래)
   * - 'SPOT': 현물 거래 (일반 현금 거래)
   *
   * 현재 시스템은 선물 거래(FUTURES) 중심으로 설계되어 있으며,
   * 15분봉 데이터는 주로 선물 시장에서 수집됩니다.
   *
   * @example 'FUTURES'
   */
  @Column({
    type: 'varchar',
    length: 10,
    nullable: false,
    comment: '시장 구분 (FUTURES: 선물거래, SPOT: 현물거래)',
  })
  market: 'FUTURES' | 'SPOT';

  /**
   * 시간봉 구분 (Timeframe)
   *
   * 캔들의 시간 단위를 나타냅니다.
   * 현재 시스템은 15분봉에 특화되어 있으므로 기본값이 '15m'입니다.
   * 향후 다른 시간봉 지원을 위해 확장 가능하도록 설계되었습니다.
   *
   * @default '15m'
   * @example '15m', '1h', '4h', '1d' (향후 확장 가능)
   */
  @Column({
    type: 'varchar',
    length: 5,
    default: '15m',
    nullable: false,
    comment: '시간봉 구분 (현재는 15m 고정, 향후 확장 가능)',
  })
  timeframe: string;

  /**
   * 캔들 시작 시간 (Open Time)
   *
   * 해당 15분봉이 시작된 정확한 시간입니다.
   * UTC 기준으로 저장되며, 15분 간격으로 정렬됩니다.
   *
   * 시간 형식: YYYY-MM-DD HH:MM:SS (UTC)
   * 15분 간격: 00:00, 00:15, 00:30, 00:45, 01:00, ...
   *
   * @example 2025-01-18 15:00:00 (15시 00분부터 15시 14분 59초까지)
   */
  @Column({
    type: 'timestamp',
    nullable: false,
    comment: '캔들 시작 시간 (UTC 기준, 15분 간격)',
  })
  openTime: Date;

  /**
   * 캔들 종료 시간 (Close Time)
   *
   * 해당 15분봉이 종료된 정확한 시간입니다.
   * 일반적으로 openTime + 14분 59초 999밀리초입니다.
   *
   * @example 2025-01-18 15:14:59.999
   */
  @Column({
    type: 'timestamp',
    nullable: false,
    comment: '캔들 종료 시간 (UTC 기준)',
  })
  closeTime: Date;

  /**
   * 시가 (Opening Price)
   *
   * 해당 15분봉 기간 동안의 첫 번째 거래 가격입니다.
   * 고정밀 소수점(DECIMAL 20,8)을 사용하여 암호화폐의
   * 정확한 가격을 소수점 8자리까지 저장합니다.
   *
   * @precision 20자리 (정수부 12자리 + 소수부 8자리)
   * @scale 8자리 (소수점 이하 8자리)
   * @example 42850.50000000
   */
  @Column({
    type: 'decimal',
    precision: 20,
    scale: 8,
    nullable: false,
    comment: '시가 - 15분봉 시작 시점의 첫 거래 가격',
  })
  open: number;

  /**
   * 고가 (Highest Price)
   *
   * 해당 15분봉 기간 동안 거래된 최고 가격입니다.
   * 기술적 분석에서 저항선 분석 등에 중요한 데이터입니다.
   *
   * @precision 20자리 (정수부 12자리 + 소수부 8자리)
   * @scale 8자리 (소수점 이하 8자리)
   * @example 42950.75000000
   */
  @Column({
    type: 'decimal',
    precision: 20,
    scale: 8,
    nullable: false,
    comment: '고가 - 15분봉 기간 중 최고 거래 가격',
  })
  high: number;

  /**
   * 저가 (Lowest Price)
   *
   * 해당 15분봉 기간 동안 거래된 최저 가격입니다.
   * 기술적 분석에서 지지선 분석 등에 중요한 데이터입니다.
   *
   * @precision 20자리 (정수부 12자리 + 소수부 8자리)
   * @scale 8자리 (소수점 이하 8자리)
   * @example 42750.25000000
   */
  @Column({
    type: 'decimal',
    precision: 20,
    scale: 8,
    nullable: false,
    comment: '저가 - 15분봉 기간 중 최저 거래 가격',
  })
  low: number;

  /**
   * 종가 (Closing Price)
   *
   * 해당 15분봉 기간 동안의 마지막 거래 가격입니다.
   * 기술적 분석에서 가장 중요한 가격 데이터이며,
   * 대부분의 기술적 지표 계산에 사용됩니다.
   *
   * @precision 20자리 (정수부 12자리 + 소수부 8자리)
   * @scale 8자리 (소수점 이하 8자리)
   * @example 42825.80000000
   */
  @Column({
    type: 'decimal',
    precision: 20,
    scale: 8,
    nullable: false,
    comment: '종가 - 15분봉 종료 시점의 마지막 거래 가격',
  })
  close: number;

  /**
   * 거래량 (Base Asset Volume)
   *
   * 해당 15분봉 기간 동안 거래된 기본 자산의 총량입니다.
   * 예: BTCUSDT의 경우 BTC의 총 거래량
   *
   * 거래량은 시장의 활성도와 유동성을 나타내는 중요한 지표이며,
   * 기술적 분석에서 가격 움직임의 신뢰도를 판단하는 데 사용됩니다.
   *
   * @precision 20자리 (정수부 12자리 + 소수부 8자리)
   * @scale 8자리 (소수점 이하 8자리)
   * @example 125.45600000 (125.456 BTC)
   */
  @Column({
    type: 'decimal',
    precision: 20,
    scale: 8,
    nullable: false,
    comment: '거래량 - 기본 자산 기준 총 거래량 (예: BTC 수량)',
  })
  volume: number;

  /**
   * 거래대금 (Quote Asset Volume)
   *
   * 해당 15분봉 기간 동안 거래된 견적 자산의 총 금액입니다.
   * 예: BTCUSDT의 경우 USDT로 표시된 총 거래대금
   *
   * 거래대금은 실제 자금의 흐름을 나타내며,
   * 시장 규모와 참여도를 측정하는 데 중요한 지표입니다.
   *
   * @precision 20자리 (정수부 12자리 + 소수부 8자리)
   * @scale 8자리 (소수점 이하 8자리)
   * @example 5375248.75000000 (5,375,248.75 USDT)
   */
  @Column({
    type: 'decimal',
    precision: 20,
    scale: 8,
    nullable: false,
    comment: '거래대금 - 견적 자산 기준 총 거래 금액 (예: USDT 금액)',
  })
  quoteVolume: number;

  /**
   * 거래 횟수 (Number of Trades)
   *
   * 해당 15분봉 기간 동안 발생한 총 거래 건수입니다.
   * 시장 활성도와 참여자 수를 간접적으로 나타내는 지표이며,
   * 고빈도 거래 vs 대량 거래를 구분하는 데 도움이 됩니다.
   *
   * @example 1250 (1,250번의 개별 거래)
   */
  @Column({
    type: 'int',
    nullable: false,
    comment: '거래 횟수 - 15분봉 기간 중 총 개별 거래 건수',
  })
  trades: number;

  /**
   * 능동 매수 거래량 (Taker Buy Base Asset Volume)
   *
   * 시장가 매수 주문(Taker Buy)으로 체결된 기본 자산의 거래량입니다.
   * 매수 압력의 강도를 측정하는 중요한 지표로,
   * 상승 모멘텀을 분석하는 데 사용됩니다.
   *
   * Taker Buy: 기존 매도 호가를 받아서 즉시 체결하는 적극적인 매수
   *
   * @precision 20자리 (정수부 12자리 + 소수부 8자리)
   * @scale 8자리 (소수점 이하 8자리)
   * @example 65.78900000 (65.789 BTC의 적극적 매수)
   */
  @Column({
    type: 'decimal',
    precision: 20,
    scale: 8,
    nullable: false,
    comment: '능동 매수 거래량 - 시장가 매수로 체결된 기본 자산량',
  })
  takerBuyBaseVolume: number;

  /**
   * 능동 매수 거래대금 (Taker Buy Quote Asset Volume)
   *
   * 시장가 매수 주문으로 체결된 견적 자산의 거래대금입니다.
   * 매수 압력의 금액 규모를 나타내며,
   * 대형 자금의 유입을 감지하는 데 중요한 지표입니다.
   *
   * @precision 20자리 (정수부 12자리 + 소수부 8자리)
   * @scale 8자리 (소수점 이하 8자리)
   * @example 2817456.25000000 (2,817,456.25 USDT의 적극적 매수)
   */
  @Column({
    type: 'decimal',
    precision: 20,
    scale: 8,
    nullable: false,
    comment: '능동 매수 거래대금 - 시장가 매수로 체결된 견적 자산 금액',
  })
  takerBuyQuoteVolume: number;

  /**
   * 레코드 생성 시간 (Created At)
   *
   * 이 캔들 데이터가 데이터베이스에 처음 저장된 시간입니다.
   * TypeORM의 @CreateDateColumn 데코레이터에 의해 자동으로 설정되며,
   * 한 번 설정된 후에는 수정되지 않습니다.
   *
   * 데이터 수집 시점을 추적하고, 시스템 모니터링에 활용됩니다.
   */
  @CreateDateColumn({
    comment: '레코드 생성 시간 - 데이터베이스 최초 저장 시점',
  })
  createdAt: Date;

  /**
   * 레코드 수정 시간 (Updated At)
   *
   * 이 캔들 데이터가 마지막으로 수정된 시간입니다.
   * TypeORM의 @UpdateDateColumn 데코레이터에 의해 자동으로 관리되며,
   * 데이터 수정 시마다 현재 시간으로 업데이트됩니다.
   *
   * 진행 중인 캔들의 실시간 업데이트를 추적하는 데 사용됩니다.
   */
  @UpdateDateColumn({
    comment: '레코드 수정 시간 - 마지막 업데이트 시점',
  })
  updatedAt: Date;

  /**
   * 중복 방지를 위한 복합 유니크 인덱스
   *
   * 동일한 심볼, 시장, 시작시간에 대해서는 하나의 캔들만 존재할 수 있습니다.
   * 이를 통해 데이터 무결성을 보장하고 중복 저장을 방지합니다.
   *
   * 예: 'BTCUSDT' + 'FUTURES' + '2025-01-18 15:00:00' 조합은 유일해야 함
   */
  @Index(['symbol', 'market', 'openTime'], { unique: true })
  static uniqueCandle: void;

  /**
   * 데이터 삽입 전 검증 및 전처리 훅
   *
   * 엔티티가 데이터베이스에 처음 저장되기 전에 자동으로 실행됩니다.
   * 데이터 유효성 검증 및 필요한 전처리 작업을 수행합니다.
   *
   * 검증 항목:
   * - 필수 필드 존재 여부
   * - 가격 데이터 논리 검증 (OHLC 관계)
   * - 거래량 유효성 검증
   * - 시간 데이터 논리 검증
   */
  @BeforeInsert()
  validateBeforeInsert(): void {
    // 1. 필수 필드 검증
    if (!this.symbol || this.symbol.trim() === '') {
      throw new Error(`[Candle15M] 심볼은 필수 입력 항목입니다.`);
    }

    if (!this.market || !['FUTURES', 'SPOT'].includes(this.market)) {
      throw new Error(
        `[Candle15M] 시장은 FUTURES 또는 SPOT이어야 합니다. 입력값: ${this.market}`,
      );
    }

    // 2. 가격 데이터 유효성 검증
    const prices = [this.open, this.high, this.low, this.close];
    if (prices.some((price) => !price || price <= 0)) {
      throw new Error(
        `[Candle15M] 모든 가격 데이터는 0보다 커야 합니다. OHLC: [${prices.join(', ')}]`,
      );
    }

    // 3. OHLC 논리 검증
    const maxPrice = Math.max(this.open, this.close);
    const minPrice = Math.min(this.open, this.close);

    if (this.high < maxPrice) {
      throw new Error(
        `[Candle15M] 고가(${this.high})는 시가(${this.open})/종가(${this.close})보다 높거나 같아야 합니다.`,
      );
    }

    if (this.low > minPrice) {
      throw new Error(
        `[Candle15M] 저가(${this.low})는 시가(${this.open})/종가(${this.close})보다 낮거나 같아야 합니다.`,
      );
    }

    // 4. 거래량 유효성 검증
    if (this.volume < 0 || this.quoteVolume < 0) {
      throw new Error(
        `[Candle15M] 거래량은 0 이상이어야 합니다. Volume: ${this.volume}, QuoteVolume: ${this.quoteVolume}`,
      );
    }

    if (this.trades < 0) {
      throw new Error(
        `[Candle15M] 거래 횟수는 0 이상이어야 합니다. Trades: ${this.trades}`,
      );
    }

    // 5. 시간 유효성 검증
    if (!this.openTime || !this.closeTime) {
      throw new Error(`[Candle15M] 시작시간과 종료시간은 필수입니다.`);
    }

    if (this.openTime >= this.closeTime) {
      throw new Error(
        `[Candle15M] 시작시간(${this.openTime.toISOString()})은 종료시간(${this.closeTime.toISOString()})보다 빨라야 합니다.`,
      );
    }

    // 6. 타임프레임 검증
    if (!this.timeframe || this.timeframe !== '15m') {
      console.warn(
        `[Candle15M] 예상치 못한 타임프레임: ${this.timeframe}, 15m으로 설정됩니다.`,
      );
      this.timeframe = '15m';
    }

    console.log(
      `✅ [Candle15M] ${this.symbol}_${this.market} 캔들 삽입 전 검증 완료 - ${this.openTime.toISOString()}`,
    );
  }

  /**
   * 데이터 수정 전 검증 및 전처리 훅
   *
   * 엔티티가 데이터베이스에서 수정되기 전에 자동으로 실행됩니다.
   * 수정 시에도 동일한 유효성 검증을 수행합니다.
   */
  @BeforeUpdate()
  validateBeforeUpdate(): void {
    // 수정 시에도 동일한 검증 수행
    this.validateBeforeInsert();
    console.log(
      `🔄 [Candle15M] ${this.symbol}_${this.market} 캔들 수정 전 검증 완료 - ${this.openTime.toISOString()}`,
    );
  }

  /**
   * 엔티티를 비즈니스 로직용 캔들 데이터 객체로 변환
   *
   * 데이터베이스 엔티티를 애플리케이션의 비즈니스 로직에서 사용하는
   * 간단한 캔들 데이터 형태로 변환합니다.
   *
   * 주요 변환 사항:
   * - Date 객체 → Unix 타임스탬프 (밀리초)
   * - Decimal → Number 타입 변환
   * - 불필요한 메타데이터 제거
   *
   * @returns CandleData 인터페이스를 구현하는 순수 데이터 객체
   *
   * @example
   * ```typescript
   * const entity = await repository.findOne({ where: { id: 1 } });
   * const candleData = entity.toCandleData();
   *
   * // 기술적 분석 서비스에서 사용
   * const rsi = technicalAnalysis.calculateRSI([candleData, ...]);
   * ```
   */
  toCandleData(): CandleData {
    return {
      openTime: this.openTime.getTime(), // Date → Unix timestamp (ms)
      closeTime: this.closeTime.getTime(), // Date → Unix timestamp (ms)
      open: Number(this.open), // Decimal → Number
      high: Number(this.high), // Decimal → Number
      low: Number(this.low), // Decimal → Number
      close: Number(this.close), // Decimal → Number
      volume: Number(this.volume), // Decimal → Number
      quoteVolume: Number(this.quoteVolume), // Decimal → Number
      trades: this.trades, // Integer (변환 불필요)
      takerBuyBaseVolume: Number(this.takerBuyBaseVolume), // Decimal → Number
      takerBuyQuoteVolume: Number(this.takerBuyQuoteVolume), // Decimal → Number
    };
  }

  /**
   * 엔티티 정보를 사람이 읽기 쉬운 문자열로 변환
   *
   * 디버깅, 로깅, 모니터링 목적으로 엔티티의 주요 정보를
   * 간결하고 읽기 쉬운 형태로 변환합니다.
   *
   * @returns 엔티티의 핵심 정보를 담은 문자열
   *
   * @example
   * ```typescript
   * console.log(candle.toString());
   * // 출력: Candle15M[BTCUSDT_FUTURES] 2025-01-18T15:00:00.000Z O:42850.5 H:42950.75 L:42750.25 C:42825.8 V:125.456
   * ```
   */
  toString(): string {
    return (
      `Candle15M[${this.symbol}_${this.market}] ` +
      `${this.openTime.toISOString()} ` +
      `O:${this.open} H:${this.high} L:${this.low} C:${this.close} ` +
      `V:${this.volume}`
    );
  }

  /**
   * 가격 변화율 계산 (시가 대비 종가)
   *
   * 해당 캔들에서 시가 대비 종가의 변화율을 백분율로 계산합니다.
   * 양수는 상승, 음수는 하락을 의미합니다.
   *
   * @returns 변화율 (백분율, 소수점 2자리)
   *
   * @example
   * ```typescript
   * const changePercent = candle.getPriceChangePercent();
   * console.log(`가격 변화: ${changePercent}%`);
   * // 출력: 가격 변화: -0.58% (시가 42850.5, 종가 42825.8인 경우)
   * ```
   */
  getPriceChangePercent(): number {
    if (this.open === 0) {
      return 0;
    }
    return Number(
      (
        ((Number(this.close) - Number(this.open)) / Number(this.open)) *
        100
      ).toFixed(2),
    );
  }

  /**
   * 캔들의 바디 크기 계산 (절댓값)
   *
   * 시가와 종가 사이의 차이를 절댓값으로 계산합니다.
   * 캔들의 몸통 크기를 나타내며, 가격 변동성 분석에 사용됩니다.
   *
   * @returns 바디 크기 (절댓값)
   */
  getBodySize(): number {
    return Math.abs(Number(this.close) - Number(this.open));
  }

  /**
   * 캔들의 상단 꼬리 크기 계산
   *
   * 고가와 시가/종가 중 높은 값의 차이를 계산합니다.
   * 상승 저항 정도를 분석하는 데 사용됩니다.
   *
   * @returns 상단 꼬리 크기
   */
  getUpperShadowSize(): number {
    const bodyTop = Math.max(Number(this.open), Number(this.close));
    return Number(this.high) - bodyTop;
  }

  /**
   * 캔들의 하단 꼬리 크기 계산
   *
   * 시가/종가 중 낮은 값과 저가의 차이를 계산합니다.
   * 하락 지지 정도를 분석하는 데 사용됩니다.
   *
   * @returns 하단 꼬리 크기
   */
  getLowerShadowSize(): number {
    const bodyBottom = Math.min(Number(this.open), Number(this.close));
    return bodyBottom - Number(this.low);
  }

  /**
   * 캔들 타입 판정 (상승/하락/도지)
   *
   * 시가와 종가의 관계에 따라 캔들의 타입을 판정합니다.
   *
   * @returns 'BULLISH' | 'BEARISH' | 'DOJI'
   */
  getCandleType(): 'BULLISH' | 'BEARISH' | 'DOJI' {
    const openPrice = Number(this.open);
    const closePrice = Number(this.close);
    const priceThreshold = openPrice * 0.001; // 0.1% 임계값

    if (Math.abs(closePrice - openPrice) <= priceThreshold) {
      return 'DOJI'; // 시가와 종가가 거의 같음
    } else if (closePrice > openPrice) {
      return 'BULLISH'; // 상승 캔들
    } else {
      return 'BEARISH'; // 하락 캔들
    }
  }
}

/**
 * 캔들 데이터 인터페이스
 *
 * 애플리케이션의 비즈니스 로직에서 사용하는 표준 캔들 데이터 형태입니다.
 * 데이터베이스 엔티티와 분리하여 순수한 데이터 전달 객체로 활용됩니다.
 *
 * 주요 용도:
 * - 기술적 분석 서비스의 입력 데이터
 * - API 응답 데이터
 * - 실시간 데이터 전송
 * - 캐시 데이터 저장
 *
 * @example
 * ```typescript
 * const candleData: CandleData = {
 *   openTime: 1705555200000,        // 2025-01-18 15:00:00 UTC
 *   closeTime: 1705556099999,       // 2025-01-18 15:14:59.999 UTC
 *   open: 42850.50,
 *   high: 42950.75,
 *   low: 42750.25,
 *   close: 42825.80,
 *   volume: 125.456,
 *   quoteVolume: 5375248.75,
 *   trades: 1250,
 *   takerBuyBaseVolume: 65.789,
 *   takerBuyQuoteVolume: 2817456.25,
 * };
 * ```
 */
export interface CandleData {
  /** 캔들 시작 시간 (Unix 타임스탬프, 밀리초) */
  openTime: number;

  /** 캔들 종료 시간 (Unix 타임스탬프, 밀리초) */
  closeTime: number;

  /** 시가 */
  open: number;

  /** 고가 */
  high: number;

  /** 저가 */
  low: number;

  /** 종가 */
  close: number;

  /** 거래량 (기본 자산) */
  volume: number;

  /** 거래대금 (견적 자산) */
  quoteVolume: number;

  /** 거래 횟수 */
  trades: number;

  /** 능동 매수 거래량 (기본 자산) */
  takerBuyBaseVolume: number;

  /** 능동 매수 거래대금 (견적 자산) */
  takerBuyQuoteVolume: number;
}

/**
 * 캔들 데이터 조회 옵션 인터페이스
 *
 * 캔들 데이터 조회 시 사용하는 옵션들을 정의합니다.
 */
export interface CandleQueryOptions {
  /** 조회할 캔들 개수 제한 */
  limit?: number;

  /** 시작 시간 (Unix 타임스탬프, 밀리초) */
  startTime?: number;

  /** 종료 시간 (Unix 타임스탬프, 밀리초) */
  endTime?: number;

  /** 정렬 방향 ('ASC' | 'DESC') */
  orderBy?: 'ASC' | 'DESC';
}

/**
 * 캔들 통계 정보 인터페이스
 *
 * 캔들 데이터의 통계 정보를 나타냅니다.
 */
export interface CandleStatistics {
  /** 총 캔들 수 */
  totalCount: number;

  /** 고유 심볼 수 */
  symbolCount: number;

  /** 가장 오래된 캔들 시간 */
  oldestTime: Date | null;

  /** 가장 최신 캔들 시간 */
  newestTime: Date | null;

  /** 평균 거래량 */
  averageVolume: number;

  /** 최고 거래량 */
  maxVolume: number;

  /** 최저 거래량 */
  minVolume: number;
}
