import { Injectable } from '@nestjs/common';
import {
  MultiStrategyResult,
  StrategyResult,
  StrategyType,
} from '../../../types/StrategyTypes';
import { TimeFrame } from '../../../types/TechnicalAnalysisTypes';

/**
 * 전략 실행 결과 저장소
 *
 * 기술적 분석 전략의 실행 결과를 저장하고 관리하는 리포지토리입니다.
 * 실제 운영 환경에서는 데이터베이스와 연동하여 결과를 영구 저장할 수 있습니다.
 *
 * 🎯 주요 기능:
 * - 전략 실행 결과 저장 및 조회
 * - 백테스팅 데이터 관리
 * - 성과 분석을 위한 이력 관리
 * - 전략별 통계 데이터 생성
 *
 * 💡 확장 가능성:
 * - PostgreSQL/MongoDB 연동 (TypeORM/Mongoose)
 * - Redis 캐싱 레이어 추가
 * - 시계열 데이터베이스 (InfluxDB) 연동
 * - 데이터 압축 및 아카이빙
 *
 * 🚀 현재는 메모리 저장소로 구현되어 있으며,
 *    향후 프로덕션 환경에서는 영구 저장소로 교체 예정입니다.
 */
@Injectable()
export class StrategyRepository {
  // 메모리 저장소 (개발/테스트용)
  private readonly strategyResults = new Map<string, StrategyResult[]>();
  private readonly multiStrategyResults = new Map<
    string,
    MultiStrategyResult[]
  >();

  /**
   * 단일 전략 실행 결과 저장
   *
   * @param result 저장할 전략 실행 결과
   *
   * 💡 키 형식: `${symbol}_${strategy}_${timeframe}`
   * 예시: "BTCUSDT_MA_20_BREAKOUT_1h"
   */
  async saveStrategyResult(result: StrategyResult): Promise<void> {
    const key = `${result.symbol}_${result.strategy}_${result.timeframe}`;

    if (!this.strategyResults.has(key)) {
      this.strategyResults.set(key, []);
    }

    const results = this.strategyResults.get(key)!;
    results.push({
      ...result,
      timestamp: result.timestamp || Date.now(),
    });

    // 최근 100개 결과만 유지 (메모리 관리)
    if (results.length > 100) {
      results.splice(0, results.length - 100);
    }

    console.log(`💾 전략 결과 저장: ${key} (총 ${results.length}개)`);
  }

  /**
   * 다중 전략 실행 결과 저장
   *
   * @param result 저장할 다중 전략 실행 결과
   *
   * 💡 키 형식: `${symbol}_multi`
   * 예시: "BTCUSDT_multi"
   */
  async saveMultiStrategyResult(result: MultiStrategyResult): Promise<void> {
    const key = `${result.symbol}_multi`;

    if (!this.multiStrategyResults.has(key)) {
      this.multiStrategyResults.set(key, []);
    }

    const results = this.multiStrategyResults.get(key)!;
    results.push({
      ...result,
      timestamp: result.timestamp || Date.now(),
    });

    // 최근 50개 결과만 유지
    if (results.length > 50) {
      results.splice(0, results.length - 50);
    }

    console.log(`💾 다중 전략 결과 저장: ${key} (총 ${results.length}개)`);
  }

  /**
   * 단일 전략 실행 결과 조회
   *
   * @param symbol 조회할 심볼
   * @param strategy 조회할 전략
   * @param timeframe 조회할 시간봉
   * @param limit 최대 조회 개수 (선택사항, 기본값: 10)
   * @returns 전략 실행 결과 배열 (최신순)
   */
  async getStrategyResults(
    symbol: string,
    strategy: StrategyType,
    timeframe: TimeFrame,
    limit: number = 10,
  ): Promise<StrategyResult[]> {
    const key = `${symbol}_${strategy}_${timeframe}`;
    const results = this.strategyResults.get(key) || [];

    // 최신순으로 정렬하여 반환
    return results
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      .slice(0, limit);
  }

  /**
   * 다중 전략 실행 결과 조회
   *
   * @param symbol 조회할 심볼
   * @param limit 최대 조회 개수 (선택사항, 기본값: 10)
   * @returns 다중 전략 실행 결과 배열 (최신순)
   */
  async getMultiStrategyResults(
    symbol: string,
    limit: number = 10,
  ): Promise<MultiStrategyResult[]> {
    const key = `${symbol}_multi`;
    const results = this.multiStrategyResults.get(key) || [];

    return results
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      .slice(0, limit);
  }

  /**
   * 전략별 성과 통계 조회
   *
   * @param symbol 조회할 심볼
   * @param strategy 조회할 전략
   * @param timeframe 조회할 시간봉
   * @param days 조회 기간 (일) (선택사항, 기본값: 7)
   * @returns 전략 성과 통계
   */
  async getStrategyPerformance(
    symbol: string,
    strategy: StrategyType,
    timeframe: TimeFrame,
    days: number = 7,
  ) {
    const results = await this.getStrategyResults(
      symbol,
      strategy,
      timeframe,
      1000,
    );
    const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;

    const recentResults = results.filter(
      (r) => (r.timestamp || 0) >= cutoffTime,
    );

    if (recentResults.length === 0) {
      return {
        symbol,
        strategy,
        timeframe,
        period: `${days}일`,
        totalSignals: 0,

        signalDistribution: {},
        lastUpdated: null,
      };
    }

    // 신호 분포 계산
    const signalCounts = recentResults.reduce(
      (acc, result) => {
        acc[result.signal] = (acc[result.signal] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      symbol,
      strategy,
      timeframe,
      period: `${days}일`,
      totalSignals: recentResults.length,

      signalDistribution: signalCounts,
      lastUpdated: Math.max(...recentResults.map((r) => r.timestamp || 0)),
    };
  }

  /**
   * 전체 전략 성과 요약
   *
   * @param symbol 조회할 심볼
   * @param days 조회 기간 (일) (선택사항, 기본값: 7)
   * @returns 모든 전략의 성과 요약
   */
  async getAllStrategyPerformance(symbol: string, days: number = 7) {
    const performances: any[] = [];

    // 저장된 모든 전략 키 조회
    const keys = Array.from(this.strategyResults.keys()).filter((key) =>
      key.startsWith(symbol),
    );

    for (const key of keys) {
      const [, strategy, timeframe] = key.split('_');
      try {
        const performance = await this.getStrategyPerformance(
          symbol,
          strategy as StrategyType,
          timeframe as TimeFrame,
          days,
        );
        performances.push(performance);
      } catch (error) {
        console.warn(`⚠️ 전략 성과 조회 실패: ${key}`, error);
      }
    }

    return {
      symbol,
      period: `${days}일`,
      totalStrategies: performances.length,
      performances: performances.sort(
        (a, b) => b.totalSignals - a.totalSignals,
      ),
      summary: {
        totalSignals: performances.reduce((sum, p) => sum + p.totalSignals, 0),
      },
    };
  }

  /**
   * 데이터 정리
   *
   * 오래된 데이터를 정리하여 메모리 사용량을 관리합니다.
   *
   * @param olderThanDays 며칠 이전 데이터를 삭제할지 (기본값: 30일)
   * @returns 정리된 레코드 수
   */
  async cleanup(
    olderThanDays: number = 30,
  ): Promise<{ strategy: number; multiStrategy: number }> {
    const cutoffTime = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
    let strategyCleanedCount = 0;
    let multiStrategyCleanedCount = 0;

    // 단일 전략 결과 정리
    for (const [key, results] of this.strategyResults.entries()) {
      const originalLength = results.length;
      const filteredResults = results.filter(
        (r) => (r.timestamp || 0) >= cutoffTime,
      );

      if (filteredResults.length < originalLength) {
        this.strategyResults.set(key, filteredResults);
        strategyCleanedCount += originalLength - filteredResults.length;
      }
    }

    // 다중 전략 결과 정리
    for (const [key, results] of this.multiStrategyResults.entries()) {
      const originalLength = results.length;
      const filteredResults = results.filter(
        (r) => (r.timestamp || 0) >= cutoffTime,
      );

      if (filteredResults.length < originalLength) {
        this.multiStrategyResults.set(key, filteredResults);
        multiStrategyCleanedCount += originalLength - filteredResults.length;
      }
    }

    console.log(
      `🧹 데이터 정리 완료: 전략 ${strategyCleanedCount}개, 다중전략 ${multiStrategyCleanedCount}개 제거`,
    );

    return {
      strategy: strategyCleanedCount,
      multiStrategy: multiStrategyCleanedCount,
    };
  }

  /**
   * 저장소 통계 조회
   *
   * @returns 현재 저장소 상태 통계
   */
  getRepositoryStats() {
    const strategyKeys = this.strategyResults.size;
    const totalStrategyResults = Array.from(
      this.strategyResults.values(),
    ).reduce((sum, results) => sum + results.length, 0);

    const multiStrategyKeys = this.multiStrategyResults.size;
    const totalMultiStrategyResults = Array.from(
      this.multiStrategyResults.values(),
    ).reduce((sum, results) => sum + results.length, 0);

    return {
      strategy: {
        keys: strategyKeys,
        totalResults: totalStrategyResults,
        averageResultsPerKey:
          strategyKeys > 0
            ? Math.round(totalStrategyResults / strategyKeys)
            : 0,
      },
      multiStrategy: {
        keys: multiStrategyKeys,
        totalResults: totalMultiStrategyResults,
        averageResultsPerKey:
          multiStrategyKeys > 0
            ? Math.round(totalMultiStrategyResults / multiStrategyKeys)
            : 0,
      },
      totalMemoryUsage: `${strategyKeys + multiStrategyKeys} keys, ${totalStrategyResults + totalMultiStrategyResults} results`,
    };
  }
}
