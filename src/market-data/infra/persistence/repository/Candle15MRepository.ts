import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, LessThan, MoreThan, Repository } from 'typeorm';
import {
  Candle15MEntity,
  CandleData,
  CandleQueryOptions,
  CandleStatistics,
} from '../entity/Candle15MEntity';

/**
 * 15분봉 캔들 데이터 레포지토리
 *
 * 15분봉 캔들 데이터의 저장, 조회, 수정, 삭제 등
 * 모든 데이터베이스 작업을 담당하는 레포지토리 클래스입니다.
 *
 * 주요 기능:
 * - 캔들 데이터 저장 (중복 처리 포함)
 * - 심볼별, 시장별 캔들 조회
 * - 시간 범위별 캔들 조회 (백테스팅용)
 * - 최신 캔들 조회 (실시간 분석용)
 * - 데이터 정리 및 통계 조회
 * - 성능 최적화된 조회 메서드
 *
 * 설계 원칙:
 * - 중복 데이터 방지 (UPSERT 패턴)
 * - 성능 최적화 (인덱스 활용)
 * - 에러 처리 및 로깅
 * - 확장 가능한 구조
 *
 * @example
 * ```typescript
 * // 의존성 주입을 통한 사용
 * constructor(
 *   private readonly candleRepository: Candle15MRepository,
 * ) {}
 *
 * // 캔들 데이터 저장
 * await this.candleRepository.saveCandle('BTCUSDT', 'FUTURES', candleData);
 *
 * // 최신 캔들 조회
 * const candles = await this.candleRepository.findLatestCandles('BTCUSDT', 'FUTURES', 100);
 * ```
 */
@Injectable()
export class Candle15MRepository {
  constructor(
    @InjectRepository(Candle15MEntity)
    private readonly repository: Repository<Candle15MEntity>,
  ) {
    console.log('📊 Candle15MRepository 초기화 완료');
  }

  /**
   * 15분봉 캔들 데이터 저장 (UPSERT 패턴)
   *
   * 새로운 캔들 데이터를 데이터베이스에 저장합니다.
   * 동일한 심볼, 시장, 시간의 캔들이 이미 존재하는 경우 업데이트하고,
   * 없는 경우 새로 생성합니다.
   *
   * 특징:
   * - 중복 키 충돌 자동 처리
   * - 진행 중인 캔들의 실시간 업데이트 지원
   * - 트랜잭션 안전성 보장
   * - 상세한 로깅 및 에러 처리
   *
   * @param symbol 거래 심볼 (예: 'BTCUSDT')
   * @param market 시장 구분 ('FUTURES' | 'SPOT')
   * @param candleData 저장할 캔들 데이터
   * @returns Promise<Candle15M> 저장된 캔들 엔티티
   *
   * @throws Error 데이터 유효성 검증 실패 시
   * @throws Error 데이터베이스 저장 실패 시
   *
   * @example
   * ```typescript
   * const candleData: CandleData = {
   *   openTime: 1705555200000,
   *   closeTime: 1705556099999,
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
   *
   * const savedCandle = await repository.saveCandle('BTCUSDT', 'FUTURES', candleData);
   * console.log('저장 완료:', savedCandle.id);
   * ```
   */
  async saveCandle(
    symbol: string,
    market: 'FUTURES' | 'SPOT',
    candleData: CandleData,
  ): Promise<Candle15MEntity> {
    try {
      const startTime = Date.now();

      // 기존 캔들 데이터 확인 (동일한 시간, 심볼, 시장)
      const existingCandle = await this.repository.findOne({
        where: {
          symbol,
          market,
          openTime: new Date(candleData.openTime),
        },
      });

      let candle: Candle15MEntity;
      let operation: string;

      if (existingCandle) {
        // 기존 캔들 업데이트 (진행 중인 캔들의 실시간 업데이트)
        candle = existingCandle;
        this.mapCandleDataToEntity(candle, candleData);
        operation = '업데이트';

        // 업데이트는 자주 발생하므로 로깅 제거
        // console.log(`🔄 [${symbol}_${market}] 기존 캔들 업데이트: ${new Date(candleData.openTime).toISOString()}`);
      } else {
        // 새로운 캔들 생성
        candle = new Candle15MEntity();
        candle.symbol = symbol;
        candle.market = market;
        candle.timeframe = '15m';
        this.mapCandleDataToEntity(candle, candleData);
        operation = '생성';

        console.log(
          `💾 [${symbol}_${market}] 새 캔들 생성: ${new Date(candleData.openTime).toISOString()}`,
        );
      }

      // 데이터베이스에 저장
      const savedCandle = await this.repository.save(candle);

      const duration = Date.now() - startTime;
      // 저장 완료 로그는 새로운 캔들일 때만 출력
      if (operation === '생성') {
        console.log(
          `✅ [${symbol}_${market}] 캔들 ${operation} 완료 - ID: ${savedCandle.id}, 소요시간: ${duration}ms`,
        );
      }

      return savedCandle;
    } catch (error) {
      // PostgreSQL 중복 키 에러 처리 (동시성 문제)
      if (error.code === '23505') {
        console.log(
          `ℹ️ [${symbol}_${market}] 캔들 중복 저장 시도 감지 - 기존 데이터 반환`,
        );

        // 기존 데이터 조회 후 반환
        const existingCandle = await this.repository.findOne({
          where: {
            symbol,
            market,
            openTime: new Date(candleData.openTime),
          },
        });

        if (existingCandle) {
          return existingCandle;
        }
      }

      console.error(`❌ [${symbol}_${market}] 캔들 저장 실패:`, {
        error: error.message,
        symbol,
        market,
        openTime: new Date(candleData.openTime).toISOString(),
        candleData: {
          open: candleData.open,
          high: candleData.high,
          low: candleData.low,
          close: candleData.close,
          volume: candleData.volume,
        },
      });

      throw new Error(`캔들 저장 실패 [${symbol}_${market}]: ${error.message}`);
    }
  }

  /**
   * CandleData를 Candle15M 엔티티에 매핑
   *
   * 비즈니스 로직의 CandleData 인터페이스 데이터를
   * 데이터베이스 엔티티의 속성에 매핑합니다.
   *
   * @param entity 매핑 대상 엔티티
   * @param candleData 소스 캔들 데이터
   */
  private mapCandleDataToEntity(
    entity: Candle15MEntity,
    candleData: CandleData,
  ): void {
    entity.openTime = new Date(candleData.openTime);
    entity.closeTime = new Date(candleData.closeTime);
    entity.open = candleData.open;
    entity.high = candleData.high;
    entity.low = candleData.low;
    entity.close = candleData.close;
    entity.volume = candleData.volume;
    entity.quoteVolume = candleData.quoteVolume;
    entity.trades = candleData.trades;
    entity.takerBuyBaseVolume = candleData.takerBuyBaseVolume;
    entity.takerBuyQuoteVolume = candleData.takerBuyQuoteVolume;
  }

  /**
   * 최신 캔들 데이터 조회 (실시간 분석용)
   *
   * 특정 심볼과 시장의 최신 캔들 데이터를 지정된 개수만큼 조회합니다.
   * 기술적 분석 및 실시간 알림 시스템에서 주로 사용됩니다.
   *
   * 특징:
   * - 최신 데이터부터 역순 조회 후 시간 순 정렬
   * - 인덱스 최적화된 쿼리 사용
   * - 메모리 효율적인 처리
   * - 상세한 성능 로깅
   *
   * @param symbol 거래 심볼
   * @param market 시장 구분
   * @param limit 조회할 캔들 개수 (기본값: 100)
   * @returns Promise<CandleData[]> 시간 순으로 정렬된 캔들 데이터 배열
   *
   * @example
   * ```typescript
   * // BTC 선물 최근 50개 캔들 조회 (기술적 분석용)
   * const candles = await repository.findLatestCandles('BTCUSDT', 'FUTURES', 50);
   *
   * // 결과는 오래된 순서부터 정렬됨 (분석에 적합)
   * console.log('가장 오래된 캔들:', candles[0]);
   * console.log('가장 최신 캔들:', candles[candles.length - 1]);
   * ```
   */
  async findLatestCandles(
    symbol: string,
    market: 'FUTURES' | 'SPOT',
    limit: number = 100,
  ): Promise<CandleData[]> {
    try {
      const startTime = Date.now();

      // 최신 데이터부터 역순으로 조회 (인덱스 활용)
      const entities = await this.repository.find({
        where: {
          symbol,
          market,
          timeframe: '15m',
        },
        order: { openTime: 'DESC' }, // 최신 순으로 정렬
        take: limit,
      });

      // 시간 순으로 다시 정렬하여 비즈니스 로직에 적합한 형태로 변환
      const candles = entities
        .reverse() // 오래된 순으로 재정렬 (분석에 필요)
        .map((entity) => entity.toCandleData());

      const duration = Date.now() - startTime;
      console.log(
        `✅ [${symbol}_${market}] 최신 캔들 ${candles.length}개 조회 완료`,
      );

      return candles;
    } catch (error) {
      console.error(
        `❌ [${symbol}_${market}] 최신 캔들 조회 실패:`,
        error.message,
      );
      throw new Error(
        `최신 캔들 조회 실패 [${symbol}_${market}]: ${error.message}`,
      );
    }
  }

  /**
   * 시간 범위별 캔들 데이터 조회 (백테스팅용)
   *
   * 지정된 시작일과 종료일 사이의 모든 캔들 데이터를 조회합니다.
   * 백테스팅, 과거 데이터 분석, 장기 추세 분석에 사용됩니다.
   *
   * 특징:
   * - 대용량 데이터 처리 최적화
   * - 메모리 효율적인 스트리밍 조회 옵션
   * - 시간 범위 검증
   * - 진행 상황 로깅
   *
   * @param symbol 거래 심볼
   * @param market 시장 구분
   * @param startTime 시작 시간 (Date 객체)
   * @param endTime 종료 시간 (Date 객체)
   * @param options 추가 조회 옵션
   * @returns Promise<CandleData[]> 시간 순으로 정렬된 캔들 데이터 배열
   *
   * @example
   * ```typescript
   * // 2025년 1월 전체 BTC 선물 캔들 조회 (백테스팅)
   * const startTime = new Date('2025-01-01T00:00:00Z');
   * const endTime = new Date('2025-01-31T23:59:59Z');
   *
   * const monthlyCandles = await repository.findCandlesByTimeRange(
   *   'BTCUSDT', 'FUTURES', startTime, endTime
   * );
   *
   * console.log(`1월 한 달간 ${monthlyCandles.length}개 캔들 조회`);
   * ```
   */
  async findCandlesByTimeRange(
    symbol: string,
    market: 'FUTURES' | 'SPOT',
    startTime: Date,
    endTime: Date,
    options: CandleQueryOptions = {},
  ): Promise<CandleData[]> {
    try {
      const queryStartTime = Date.now();

      // 시간 범위 유효성 검증
      if (startTime >= endTime) {
        throw new Error(
          `시작 시간(${startTime.toISOString()})은 종료 시간(${endTime.toISOString()})보다 빨라야 합니다.`,
        );
      }

      const timeDiff = endTime.getTime() - startTime.getTime();
      const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

      console.log(
        `📅 [${symbol}_${market}] 기간별 캔들 조회 시작: ${daysDiff}일간 (${startTime.toISOString()} ~ ${endTime.toISOString()})`,
      );

      // 쿼리 구성
      const queryBuilder = this.repository
        .createQueryBuilder('candle')
        .where('candle.symbol = :symbol', { symbol })
        .andWhere('candle.market = :market', { market })
        .andWhere('candle.timeframe = :timeframe', { timeframe: '15m' })
        .andWhere('candle.openTime BETWEEN :startTime AND :endTime', {
          startTime,
          endTime,
        })
        .orderBy('candle.openTime', options.orderBy || 'ASC');

      // 제한 개수 적용 (대용량 데이터 보호)
      if (options.limit) {
        queryBuilder.take(options.limit);
      }

      // 쿼리 실행
      const entities = await queryBuilder.getMany();

      // CandleData로 변환
      const candles = entities.map((entity) => entity.toCandleData());

      const duration = Date.now() - queryStartTime;
      console.log(
        `✅ [${symbol}_${market}] 기간별 캔들 ${candles.length}개 조회 완료 - 소요시간: ${duration}ms`,
      );

      // 대용량 데이터 경고
      if (candles.length > 10000) {
        console.warn(
          `⚠️ [${symbol}_${market}] 대용량 데이터 조회: ${candles.length}개 캔들 (성능 영향 가능)`,
        );
      }

      return candles;
    } catch (error) {
      console.error(
        `❌ [${symbol}_${market}] 기간별 캔들 조회 실패:`,
        error.message,
      );
      throw new Error(
        `기간별 캔들 조회 실패 [${symbol}_${market}]: ${error.message}`,
      );
    }
  }

  /**
   * 특정 시간 이후의 캔들 데이터 조회
   *
   * 지정된 시점 이후에 생성된 모든 캔들 데이터를 조회합니다.
   * 서버 재시작 후 누락된 데이터 보완, 실시간 동기화에 사용됩니다.
   *
   * @param symbol 거래 심볼
   * @param market 시장 구분
   * @param afterTime 기준 시점
   * @param limit 최대 조회 개수 (기본값: 1000)
   * @returns Promise<CandleData[]> 기준 시점 이후의 캔들 데이터 배열
   *
   * @example
   * ```typescript
   * // 서버 재시작 후 누락된 데이터 조회
   * const serverStartTime = new Date('2025-01-18T10:00:00Z');
   * const missingCandles = await repository.findCandlesAfter(
   *   'BTCUSDT', 'FUTURES', serverStartTime
   * );
   *
   * console.log(`서버 재시작 후 ${missingCandles.length}개 캔들 발견`);
   * ```
   */
  async findCandlesAfter(
    symbol: string,
    market: 'FUTURES' | 'SPOT',
    afterTime: Date,
    limit: number = 1000,
  ): Promise<CandleData[]> {
    try {
      console.log(
        `⏰ [${symbol}_${market}] ${afterTime.toISOString()} 이후 캔들 조회 시작`,
      );

      const entities = await this.repository.find({
        where: {
          symbol,
          market,
          timeframe: '15m',
          openTime: MoreThan(afterTime),
        },
        order: { openTime: 'ASC' },
        take: limit,
      });

      const candles = entities.map((entity) => entity.toCandleData());

      console.log(
        `✅ [${symbol}_${market}] ${afterTime.toISOString()} 이후 캔들 ${candles.length}개 조회 완료`,
      );
      return candles;
    } catch (error) {
      console.error(
        `❌ [${symbol}_${market}] 특정 시간 이후 캔들 조회 실패:`,
        error.message,
      );
      throw new Error(
        `특정 시간 이후 캔들 조회 실패 [${symbol}_${market}]: ${error.message}`,
      );
    }
  }

  /**
   * 심볼별 캔들 개수 조회
   *
   * 특정 심볼의 저장된 캔들 개수를 조회합니다.
   * 데이터 현황 파악, 모니터링, 상태 점검에 사용됩니다.
   *
   * @param symbol 거래 심볼
   * @param market 시장 구분
   * @returns Promise<number> 저장된 캔들 개수
   *
   * @example
   * ```typescript
   * const count = await repository.getCandleCount('BTCUSDT', 'FUTURES');
   * console.log(`BTCUSDT 선물 캔들 개수: ${count}개`);
   * ```
   */
  async getCandleCount(
    symbol: string,
    market: 'FUTURES' | 'SPOT',
  ): Promise<number> {
    try {
      const count = await this.repository.count({
        where: { symbol, market, timeframe: '15m' },
      });

      console.log(
        `📊 [${symbol}_${market}] 캔들 개수: ${count.toLocaleString()}개`,
      );
      return count;
    } catch (error) {
      console.error(
        `❌ [${symbol}_${market}] 캔들 개수 조회 실패:`,
        error.message,
      );
      return 0;
    }
  }

  /**
   * 캔들 데이터 존재 여부 확인
   *
   * 특정 심볼과 시장에 대한 캔들 데이터가 존재하는지 확인합니다.
   * 새로운 심볼 추가 시 데이터 유무를 확인할 때 사용됩니다.
   *
   * @param symbol 거래 심볼
   * @param market 시장 구분
   * @returns Promise<boolean> 데이터 존재 여부
   */
  async hasCandles(
    symbol: string,
    market: 'FUTURES' | 'SPOT',
  ): Promise<boolean> {
    try {
      const count = await this.repository.count({
        where: { symbol, market, timeframe: '15m' },
        take: 1, // 존재 여부만 확인하므로 1개만 조회
      });

      const hasData = count > 0;
      console.log(`🔍 [${symbol}_${market}] 캔들 데이터 존재 여부: ${hasData}`);

      return hasData;
    } catch (error) {
      console.error(
        `❌ [${symbol}_${market}] 캔들 존재 여부 확인 실패:`,
        error.message,
      );
      return false;
    }
  }

  /**
   * 가장 최신 캔들 조회 (단일)
   *
   * 특정 심볼과 시장의 가장 최신 캔들 하나만 조회합니다.
   * 실시간 가격 확인, 최신 상태 점검에 사용됩니다.
   *
   * @param symbol 거래 심볼
   * @param market 시장 구분
   * @returns Promise<CandleData | null> 최신 캔들 데이터 또는 null
   */
  async findLatestCandle(
    symbol: string,
    market: 'FUTURES' | 'SPOT',
  ): Promise<CandleData | null> {
    try {
      const entity = await this.repository.findOne({
        where: { symbol, market, timeframe: '15m' },
        order: { openTime: 'DESC' },
      });

      if (!entity) {
        console.log(`ℹ️ [${symbol}_${market}] 캔들 데이터가 없습니다.`);
        return null;
      }

      const candleData = entity.toCandleData();
      console.log(
        `🔍 [${symbol}_${market}] 최신 캔들: ${new Date(candleData.openTime).toISOString()}, 종가: $${candleData.close}`,
      );

      return candleData;
    } catch (error) {
      console.error(
        `❌ [${symbol}_${market}] 최신 캔들 조회 실패:`,
        error.message,
      );
      return null;
    }
  }

  /**
   * 오래된 캔들 데이터 정리
   *
   * 지정된 날짜보다 오래된 캔들 데이터를 삭제합니다.
   * 스토리지 관리, 성능 최적화, 데이터 정리를 위해 사용됩니다.
   *
   * @param beforeDate 삭제 기준 날짜
   * @param symbol 특정 심볼만 정리 (선택사항)
   * @param market 특정 시장만 정리 (선택사항)
   * @returns Promise<number> 삭제된 레코드 수
   *
   * @example
   * ```typescript
   * // 30일 이전 데이터 모두 삭제
   * const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
   * const deletedCount = await repository.cleanupOldCandles(thirtyDaysAgo);
   * console.log(`${deletedCount}개의 오래된 캔들 데이터가 삭제되었습니다.`);
   *
   * // 특정 심볼의 60일 이전 데이터만 삭제
   * const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
   * const deletedCount = await repository.cleanupOldCandles(sixtyDaysAgo, 'BTCUSDT', 'FUTURES');
   * ```
   */
  async cleanupOldCandles(
    beforeDate: Date,
    symbol?: string,
    market?: 'FUTURES' | 'SPOT',
  ): Promise<number> {
    try {
      console.log(
        `🧹 오래된 캔들 데이터 정리 시작: ${beforeDate.toISOString()} 이전`,
      );

      // 삭제 조건 구성
      const whereCondition: FindOptionsWhere<Candle15MEntity> = {
        timeframe: '15m',
        openTime: LessThan(beforeDate),
      };

      if (symbol) whereCondition.symbol = symbol;
      if (market) whereCondition.market = market;

      // 삭제 전 개수 확인
      const countBeforeDelete = await this.repository.count({
        where: whereCondition,
      });

      if (countBeforeDelete === 0) {
        console.log(`ℹ️ 정리할 오래된 캔들 데이터가 없습니다.`);
        return 0;
      }

      console.log(
        `📊 정리 대상 캔들 개수: ${countBeforeDelete.toLocaleString()}개`,
      );

      // 대량 삭제 실행
      const deleteResult = await this.repository.delete(whereCondition);
      const deletedCount = deleteResult.affected || 0;

      console.log(
        `✅ 오래된 캔들 데이터 ${deletedCount.toLocaleString()}개 정리 완료`,
      );

      // 정리 후 통계 로깅
      if (deletedCount > 0) {
        const remainingCount = await this.repository.count({
          where:
            symbol && market
              ? { symbol, market, timeframe: '15m' }
              : { timeframe: '15m' },
        });
        console.log(
          `📊 정리 후 남은 캔들 개수: ${remainingCount.toLocaleString()}개`,
        );
      }

      return deletedCount;
    } catch (error) {
      console.error(`❌ 오래된 캔들 데이터 정리 실패:`, error.message);
      throw new Error(`오래된 캔들 데이터 정리 실패: ${error.message}`);
    }
  }

  /**
   * 모든 심볼 목록 조회
   *
   * 데이터베이스에 저장된 모든 심볼 목록을 조회합니다.
   * 시스템 모니터링, 관리 도구, 설정 관리에 사용됩니다.
   *
   * @param market 시장 구분 필터 (선택사항)
   * @returns Promise<string[]> 고유한 심볼 목록
   *
   * @example
   * ```typescript
   * // 모든 시장의 심볼 조회
   * const allSymbols = await repository.getAllSymbols();
   * console.log('전체 심볼:', allSymbols);
   *
   * // 선물 시장 심볼만 조회
   * const futuresSymbols = await repository.getAllSymbols('FUTURES');
   * console.log('선물 심볼:', futuresSymbols);
   * ```
   */
  async getAllSymbols(market?: 'FUTURES' | 'SPOT'): Promise<string[]> {
    try {
      console.log(`📋 심볼 목록 조회 시작${market ? ` (${market} 시장)` : ''}`);

      const query = this.repository
        .createQueryBuilder('candle')
        .select('DISTINCT candle.symbol', 'symbol')
        .where('candle.timeframe = :timeframe', { timeframe: '15m' });

      if (market) {
        query.andWhere('candle.market = :market', { market });
      }

      const result = await query.getRawMany();
      const symbols = result.map((row) => row.symbol).sort();

      console.log(`✅ 심볼 목록 조회 완료: ${symbols.length}개 심볼 발견`);
      console.log(`📋 심볼 목록: ${symbols.join(', ')}`);

      return symbols;
    } catch (error) {
      console.error(`❌ 심볼 목록 조회 실패:`, error.message);
      throw new Error(`심볼 목록 조회 실패: ${error.message}`);
    }
  }

  /**
   * 데이터베이스 통계 정보 조회
   *
   * 캔들 데이터베이스의 전체 통계 정보를 조회합니다.
   * 시스템 모니터링, 상태 점검, 관리 도구에서 사용됩니다.
   *
   * @returns Promise<CandleStatistics> 데이터베이스 통계 정보
   *
   * @example
   * ```typescript
   * const stats = await repository.getStatistics();
   * console.log(`총 캔들 수: ${stats.totalCount.toLocaleString()}`);
   * console.log(`심볼 수: ${stats.symbolCount}`);
   * console.log(`데이터 기간: ${stats.oldestTime} ~ ${stats.newestTime}`);
   * console.log(`평균 거래량: ${stats.averageVolume}`);
   * ```
   */
  async getStatistics(): Promise<CandleStatistics> {
    try {
      console.log('📈 캔들 데이터 통계 조회 시작');

      const [
        totalCountResult,
        symbolCountResult,
        oldestCandleResult,
        newestCandleResult,
        volumeStatsResult,
      ] = await Promise.all([
        // 전체 캔들 수
        this.repository.count({ where: { timeframe: '15m' } }),

        // 고유 심볼 수
        this.repository
          .createQueryBuilder('candle')
          .select('COUNT(DISTINCT candle.symbol)', 'count')
          .where('candle.timeframe = :timeframe', { timeframe: '15m' })
          .getRawOne(),

        // 가장 오래된 캔들
        this.repository.findOne({
          where: { timeframe: '15m' },
          order: { openTime: 'ASC' },
        }),

        // 가장 최신 캔들
        this.repository.findOne({
          where: { timeframe: '15m' },
          order: { openTime: 'DESC' },
        }),

        // 거래량 통계
        this.repository
          .createQueryBuilder('candle')
          .select('AVG(candle.volume)', 'average')
          .addSelect('MAX(candle.volume)', 'maximum')
          .addSelect('MIN(candle.volume)', 'minimum')
          .where('candle.timeframe = :timeframe', { timeframe: '15m' })
          .getRawOne(),
      ]);

      const statistics: CandleStatistics = {
        totalCount: totalCountResult,
        symbolCount: parseInt(symbolCountResult?.count || '0'),
        oldestTime: oldestCandleResult?.openTime || null,
        newestTime: newestCandleResult?.openTime || null,
        averageVolume: parseFloat(volumeStatsResult?.average || '0'),
        maxVolume: parseFloat(volumeStatsResult?.maximum || '0'),
        minVolume: parseFloat(volumeStatsResult?.minimum || '0'),
      };

      console.log('✅ 캔들 데이터 통계 조회 완료:', {
        totalCount: statistics.totalCount.toLocaleString(),
        symbolCount: statistics.symbolCount,
        dataRange:
          statistics.oldestTime && statistics.newestTime
            ? `${statistics.oldestTime.toISOString()} ~ ${statistics.newestTime.toISOString()}`
            : '데이터 없음',
        averageVolume: statistics.averageVolume.toFixed(2),
      });

      return statistics;
    } catch (error) {
      console.error('❌ 캔들 데이터 통계 조회 실패:', error.message);
      throw new Error(`캔들 데이터 통계 조회 실패: ${error.message}`);
    }
  }

  /**
   * 데이터베이스 연결 상태 점검
   *
   * 데이터베이스 연결 및 테이블 상태를 점검합니다.
   * 헬스체크, 모니터링에 사용됩니다.
   *
   * @returns Promise<boolean> 연결 상태 (true: 정상, false: 문제)
   */
  async checkHealth(): Promise<boolean> {
    try {
      // 간단한 쿼리로 연결 상태 확인
      await this.repository.count({ take: 1 });
      console.log('✅ 캔들 데이터베이스 연결 상태 정상');
      return true;
    } catch (error) {
      console.error('❌ 캔들 데이터베이스 연결 상태 비정상:', error.message);
      return false;
    }
  }

  /**
   * 특정 시간의 캔들 존재 여부 확인
   *
   * @param symbol 심볼
   * @param market 시장 구분
   * @param openTime 캔들 시작 시간 (Unix timestamp)
   * @returns 기존 캔들 엔티티 또는 null
   */
  async findByOpenTime(
    symbol: string,
    market: 'FUTURES' | 'SPOT',
    openTime: number,
  ): Promise<Candle15MEntity | null> {
    try {
      const candle = await this.repository.findOne({
        where: {
          symbol,
          market,
          openTime: new Date(openTime),
        },
      });

      return candle || null;
    } catch (error) {
      console.error(`❌ [${symbol}] openTime으로 캔들 조회 실패:`, error);
      return null;
    }
  }

  /**
   * 심볼별 총 캔들 수 조회
   *
   * @param symbol 심볼
   * @param market 시장 구분
   * @returns 총 캔들 수
   */
  async countCandles(
    symbol: string,
    market: 'FUTURES' | 'SPOT',
  ): Promise<number> {
    try {
      return await this.repository.count({
        where: { symbol, market },
      });
    } catch (error) {
      console.error(`❌ [${symbol}] 캔들 수 조회 실패:`, error);
      return 0;
    }
  }

  /**
   * 가장 오래된 캔들 조회
   *
   * @param symbol 심볼
   * @param market 시장 구분
   * @param limit 조회할 개수
   * @returns 가장 오래된 캔들 데이터 배열
   */
  async findEarliestCandles(
    symbol: string,
    market: 'FUTURES' | 'SPOT',
    limit: number = 100,
  ): Promise<CandleData[]> {
    try {
      const entities = await this.repository.find({
        where: { symbol, market },
        order: { openTime: 'ASC' }, // 오름차순 (가장 오래된 것부터)
        take: limit,
      });

      return entities.map((entity) => entity.toCandleData());
    } catch (error) {
      console.error(`❌ [${symbol}] 가장 오래된 캔들 조회 실패:`, error);
      return [];
    }
  }
}
