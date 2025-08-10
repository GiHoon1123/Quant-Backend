import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

/**
 * 실시간 환율 서비스
 *
 * USD-KRW 환율을 실시간으로 가져오는 서비스입니다.
 * 15분마다 한 번씩만 업데이트하여 API 호출을 최소화합니다.
 *
 * 🎯 주요 기능:
 * - USD-KRW 실시간 환율 조회
 * - 15분 캐싱으로 API 호출 최소화
 * - 여러 환율 API 소스 지원 (fallback)
 * - 에러 처리 및 기본값 제공
 *
 * 💱 지원 API:
 * 1. ExchangeRate-API (무료, 1000회/월)
 * 2. Fixer.io (무료, 100회/월)
 * 3. Open Exchange Rates (무료, 1000회/월)
 *
 * 📊 캐싱 전략:
 * - 15분마다 자동 업데이트
 * - API 실패 시 이전 값 유지
 * - 기본값: 1,330원 (한국은행 기준)
 */
@Injectable()
export class ExchangeRateService {
  private readonly logger = new Logger(ExchangeRateService.name);

  // 캐싱 설정
  private cachedRate: number = 1330; // 기본값
  private lastUpdateTime: number = 0;
  private readonly CACHE_DURATION = 15 * 60 * 1000; // 15분

  // API 설정
  private readonly API_SOURCES = [
    {
      name: 'ExchangeRate-API',
      url: 'https://api.exchangerate-api.com/v4/latest/USD',
      parser: (data: any) => data.rates.KRW,
    },
    {
      name: 'Fixer.io',
      url: 'http://data.fixer.io/api/latest?access_key=free&base=USD&symbols=KRW',
      parser: (data: any) => data.rates.KRW,
    },
    {
      name: 'Open Exchange Rates',
      url: 'https://open.er-api.com/v6/latest/USD',
      parser: (data: any) => data.rates.KRW,
    },
  ];

  /**
   * USD-KRW 환율 조회
   *
   * 캐시된 값이 있으면 반환하고, 없으면 API에서 새로 가져옵니다.
   * 15분마다 자동으로 업데이트됩니다.
   *
   * @returns USD-KRW 환율 (예: 1330.5)
   */
  async getUSDKRWRate(): Promise<number> {
    const now = Date.now();

    // 캐시가 유효한 경우 캐시된 값 반환
    if (now - this.lastUpdateTime < this.CACHE_DURATION) {
      this.logger.debug(
        `💱 캐시된 환율 사용: $1 = ₩${this.cachedRate.toLocaleString()} (${Math.round((this.CACHE_DURATION - (now - this.lastUpdateTime)) / 60000)}분 남음)`,
      );
      return this.cachedRate;
    }

    // 캐시가 만료된 경우 새로운 환율 가져오기
    this.logger.log('💱 실시간 환율 업데이트 시작');

    try {
      const newRate = await this.fetchExchangeRate();

      if (newRate > 0) {
        this.cachedRate = newRate;
        this.lastUpdateTime = now;

        this.logger.log(
          `✅ 환율 업데이트 완료: $1 = ₩${this.cachedRate.toLocaleString()}`,
        );
      } else {
        this.logger.warn('⚠️ 유효하지 않은 환율 응답, 이전 값 유지');
      }
    } catch (error) {
      this.logger.error(`❌ 환율 업데이트 실패: ${error.message}`);
      this.logger.log(
        `💱 이전 환율 사용: $1 = ₩${this.cachedRate.toLocaleString()}`,
      );
    }

    return this.cachedRate;
  }

  /**
   * 실시간 환율 API 호출
   *
   * 여러 API 소스를 순차적으로 시도하여 환율을 가져옵니다.
   * 하나라도 성공하면 해당 값을 반환합니다.
   *
   * @returns USD-KRW 환율
   * @throws Error 모든 API 호출이 실패한 경우
   */
  private async fetchExchangeRate(): Promise<number> {
    for (const source of this.API_SOURCES) {
      try {
        this.logger.debug(`🌐 ${source.name}에서 환율 조회 시도...`);

        const response = await axios.get(source.url, {
          timeout: 5000, // 5초 타임아웃
        });

        if (response.status === 200 && response.data) {
          const rate = source.parser(response.data);

          if (rate && typeof rate === 'number' && rate > 0) {
            this.logger.log(`✅ ${source.name}에서 환율 조회 성공: ${rate}`);
            return rate;
          } else {
            this.logger.warn(
              `⚠️ ${source.name} 응답 형식 오류: ${JSON.stringify(response.data)}`,
            );
          }
        } else {
          this.logger.warn(`⚠️ ${source.name} HTTP 오류: ${response.status}`);
        }
      } catch (error) {
        this.logger.warn(`⚠️ ${source.name} 호출 실패: ${error.message}`);
        continue; // 다음 API 소스 시도
      }
    }

    // 모든 API 호출 실패
    throw new Error('모든 환율 API 호출이 실패했습니다');
  }

  /**
   * 캐시 상태 조회
   *
   * @returns 캐시 정보
   */
  getCacheStatus(): {
    currentRate: number;
    lastUpdate: Date;
    nextUpdate: Date;
    isExpired: boolean;
  } {
    const now = Date.now();
    const isExpired = now - this.lastUpdateTime >= this.CACHE_DURATION;

    return {
      currentRate: this.cachedRate,
      lastUpdate: new Date(this.lastUpdateTime),
      nextUpdate: new Date(this.lastUpdateTime + this.CACHE_DURATION),
      isExpired,
    };
  }

  /**
   * 캐시 강제 갱신
   *
   * 캐시를 무시하고 새로운 환율을 가져옵니다.
   * 주로 테스트나 긴급 업데이트 시 사용합니다.
   *
   * @returns 새로운 USD-KRW 환율
   */
  async forceRefresh(): Promise<number> {
    this.logger.log('🔄 환율 캐시 강제 갱신 시작');
    this.lastUpdateTime = 0; // 캐시 무효화
    return await this.getUSDKRWRate();
  }
}
