import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

/**
 * 실시간 환율 서비스
 *
 * USD-KRW 환율을 실시간으로 가져오는 서비스입니다.
 * 매번 실시간으로 조회하여 최신 환율 정보를 제공합니다.
 *
 * 🎯 주요 기능:
 * - USD-KRW 실시간 환율 조회
 * - 매번 실시간 API 호출
 * - 여러 환율 API 소스 지원 (fallback)
 * - 에러 처리 및 기본값 제공
 *
 * 💱 지원 API:
 * 1. ExchangeRate-API (무료, 1000회/월)
 * 2. Fixer.io (무료, 100회/월)
 * 3. Open Exchange Rates (무료, 1000회/월)
 *
 * 📊 실시간 전략:
 * - 매번 실시간 API 호출
 * - API 실패 시 기본값 사용
 * - 기본값: 1,330원 (한국은행 기준)
 */
@Injectable()
export class ExchangeRateService {
  private readonly logger = new Logger(ExchangeRateService.name);

  // 기본값 설정
  private readonly DEFAULT_RATE = 1330; // 기본값

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
   * 매번 실시간으로 API에서 환율을 가져옵니다.
   * API 실패 시 기본값을 반환합니다.
   *
   * @returns USD-KRW 환율 (예: 1330.5)
   */
  async getUSDKRWRate(): Promise<number> {
    this.logger.log('💱 실시간 환율 조회 시작');

    try {
      const rate = await this.fetchExchangeRate();

      if (rate > 0) {
        this.logger.log(
          `✅ 실시간 환율 조회 완료: $1 = ₩${rate.toLocaleString()}`,
        );
        return rate;
      } else {
        this.logger.warn('⚠️ 유효하지 않은 환율 응답, 기본값 사용');
        return this.DEFAULT_RATE;
      }
    } catch (error) {
      this.logger.error(`❌ 환율 조회 실패: ${error.message}`);
      this.logger.log(
        `💱 기본 환율 사용: $1 = ₩${this.DEFAULT_RATE.toLocaleString()}`,
      );
      return this.DEFAULT_RATE;
    }
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
   * 서비스 상태 조회
   *
   * @returns 서비스 정보
   */
  getServiceStatus(): {
    defaultRate: number;
    apiSources: string[];
  } {
    return {
      defaultRate: this.DEFAULT_RATE,
      apiSources: this.API_SOURCES.map((source) => source.name),
    };
  }

  /**
   * 실시간 환율 재조회
   *
   * 새로운 환율을 실시간으로 가져옵니다.
   * 주로 테스트나 긴급 업데이트 시 사용합니다.
   *
   * @returns 새로운 USD-KRW 환율
   */
  async forceRefresh(): Promise<number> {
    this.logger.log('🔄 실시간 환율 재조회 시작');
    return await this.getUSDKRWRate();
  }
}
