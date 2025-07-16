import { Injectable } from '@nestjs/common';
import axios, { AxiosResponse } from 'axios';

/**
 * 바이낸스 REST API 클라이언트 (공통 모듈)
 *
 * 바이낸스의 REST API를 호출하는 공통 클라이언트입니다.
 * 현물, 선물, 기술적 분석 등 모든 도메인에서 재사용할 수 있습니다.
 *
 * 🎯 주요 기능:
 * - 캔들스틱 데이터 조회
 * - 가격 정보 조회
 * - 거래량 정보 조회
 * - 에러 처리 및 재시도 로직
 * - 레이트 리밋 관리
 *
 * 🚀 지원 엔드포인트:
 * - /api/v3/klines - 캔들스틱 데이터
 * - /api/v3/ticker/price - 현재 가격
 * - /api/v3/ticker/24hr - 24시간 통계
 * - /api/v3/depth - 오더북
 * - /api/v3/trades - 최근 거래
 *
 * 💡 사용 예시:
 * ```typescript
 * const candles = await binanceClient.getKlines('BTCUSDT', '1h', 100);
 * const price = await binanceClient.getCurrentPrice('BTCUSDT');
 * const stats = await binanceClient.get24hrStats('BTCUSDT');
 * ```
 */
@Injectable()
export class BinanceRestClient {
  private readonly SPOT_BASE_URL = 'https://api.binance.com/api/v3';
  private readonly FUTURES_BASE_URL = 'https://fapi.binance.com/fapi/v1';

  // 레이트 리밋 관리
  private requestCount = 0;
  private lastResetTime = Date.now();
  private readonly MAX_REQUESTS_PER_MINUTE = 1200;

  /**
   * 캔들스틱 데이터 조회
   *
   * @param symbol 심볼 (예: BTCUSDT)
   * @param interval 시간간격 (1m, 5m, 15m, 1h, 4h, 1d 등)
   * @param limit 조회할 개수 (최대 1000, 기본값 500)
   * @param startTime 시작 시간 (Unix timestamp, 선택사항)
   * @param endTime 종료 시간 (Unix timestamp, 선택사항)
   * @param isTestnet 테스트넷 사용 여부 (기본값: false)
   * @returns 캔들스틱 데이터 배열
   *
   * 📊 응답 형식: [시간, 시가, 고가, 저가, 종가, 거래량, 마감시간, 거래대금, 거래횟수, ...]
   */
  async getKlines(
    symbol: string,
    interval: string,
    limit: number = 500,
    startTime?: number,
    endTime?: number,
    isTestnet: boolean = false,
  ): Promise<any[]> {
    await this.checkRateLimit();

    const baseUrl = isTestnet
      ? 'https://testnet.binance.vision/api/v3'
      : this.SPOT_BASE_URL;
    const url = `${baseUrl}/klines`;

    const params: any = {
      symbol: symbol.toUpperCase(),
      interval,
      limit: Math.min(limit, 1000), // 최대 1000개 제한
    };

    if (startTime) params.startTime = startTime;
    if (endTime) params.endTime = endTime;

    try {
      console.log(`📊 캔들 데이터 요청: ${symbol} ${interval} (${limit}개)`);

      const response: AxiosResponse = await axios.get(url, {
        params,
        timeout: 10000, // 10초 타임아웃
      });

      console.log(`✅ 캔들 데이터 수신: ${symbol} (${response.data.length}개)`);
      return response.data;
    } catch (error) {
      console.error(`❌ 캔들 데이터 조회 실패: ${symbol} ${interval}`, error);

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 429) {
          throw new Error('레이트 리밋 초과: 잠시 후 다시 시도해주세요');
        }
        if (error.response?.status === 400) {
          throw new Error(
            `잘못된 요청: ${error.response.data?.msg || '파라미터를 확인해주세요'}`,
          );
        }
      }

      throw new Error(`캔들 데이터 조회 실패: ${error.message}`);
    }
  }

  /**
   * 현재 가격 조회
   *
   * @param symbol 심볼 (예: BTCUSDT)
   * @returns 현재 가격 정보
   */
  async getCurrentPrice(
    symbol: string,
  ): Promise<{ symbol: string; price: string }> {
    await this.checkRateLimit();

    const url = `${this.SPOT_BASE_URL}/ticker/price`;

    try {
      const response: AxiosResponse = await axios.get(url, {
        params: { symbol: symbol.toUpperCase() },
        timeout: 5000,
      });

      return response.data;
    } catch (error) {
      console.error(`❌ 현재 가격 조회 실패: ${symbol}`, error);
      throw new Error(`현재 가격 조회 실패: ${error.message}`);
    }
  }

  /**
   * 24시간 통계 조회
   *
   * @param symbol 심볼 (선택사항, 없으면 전체 심볼)
   * @returns 24시간 통계 정보
   */
  async get24hrStats(symbol?: string): Promise<any> {
    await this.checkRateLimit();

    const url = `${this.SPOT_BASE_URL}/ticker/24hr`;

    try {
      const params = symbol ? { symbol: symbol.toUpperCase() } : {};

      const response: AxiosResponse = await axios.get(url, {
        params,
        timeout: 10000,
      });

      return response.data;
    } catch (error) {
      console.error(`❌ 24시간 통계 조회 실패: ${symbol || 'ALL'}`, error);
      throw new Error(`24시간 통계 조회 실패: ${error.message}`);
    }
  }

  /**
   * 오더북 조회
   *
   * @param symbol 심볼
   * @param limit 조회할 레벨 수 (5, 10, 20, 50, 100, 500, 1000, 5000)
   * @returns 오더북 정보
   */
  async getOrderBook(symbol: string, limit: number = 100): Promise<any> {
    await this.checkRateLimit();

    const url = `${this.SPOT_BASE_URL}/depth`;

    try {
      const response: AxiosResponse = await axios.get(url, {
        params: {
          symbol: symbol.toUpperCase(),
          limit,
        },
        timeout: 5000,
      });

      return response.data;
    } catch (error) {
      console.error(`❌ 오더북 조회 실패: ${symbol}`, error);
      throw new Error(`오더북 조회 실패: ${error.message}`);
    }
  }

  /**
   * 최근 거래 내역 조회
   *
   * @param symbol 심볼
   * @param limit 조회할 개수 (최대 1000, 기본값 500)
   * @returns 최근 거래 내역
   */
  async getRecentTrades(symbol: string, limit: number = 500): Promise<any[]> {
    await this.checkRateLimit();

    const url = `${this.SPOT_BASE_URL}/trades`;

    try {
      const response: AxiosResponse = await axios.get(url, {
        params: {
          symbol: symbol.toUpperCase(),
          limit: Math.min(limit, 1000),
        },
        timeout: 5000,
      });

      return response.data;
    } catch (error) {
      console.error(`❌ 최근 거래 조회 실패: ${symbol}`, error);
      throw new Error(`최근 거래 조회 실패: ${error.message}`);
    }
  }

  /**
   * 선물 캔들스틱 데이터 조회
   *
   * @param symbol 심볼
   * @param interval 시간간격
   * @param limit 조회할 개수
   * @param startTime 시작 시간 (선택사항)
   * @param endTime 종료 시간 (선택사항)
   * @returns 선물 캔들스틱 데이터
   */
  async getFuturesKlines(
    symbol: string,
    interval: string,
    limit: number = 500,
    startTime?: number,
    endTime?: number,
  ): Promise<any[]> {
    await this.checkRateLimit();

    const url = `${this.FUTURES_BASE_URL}/klines`;

    const params: any = {
      symbol: symbol.toUpperCase(),
      interval,
      limit: Math.min(limit, 1000),
    };

    if (startTime) params.startTime = startTime;
    if (endTime) params.endTime = endTime;

    try {
      console.log(
        `📊 선물 캔들 데이터 요청: ${symbol} ${interval} (${limit}개)`,
      );

      const response: AxiosResponse = await axios.get(url, {
        params,
        timeout: 10000,
      });

      console.log(
        `✅ 선물 캔들 데이터 수신: ${symbol} (${response.data.length}개)`,
      );
      return response.data;
    } catch (error) {
      console.error(
        `❌ 선물 캔들 데이터 조회 실패: ${symbol} ${interval}`,
        error,
      );
      throw new Error(`선물 캔들 데이터 조회 실패: ${error.message}`);
    }
  }

  /**
   * 서버 시간 조회
   *
   * @returns 바이낸스 서버 시간
   */
  async getServerTime(): Promise<{ serverTime: number }> {
    try {
      const response: AxiosResponse = await axios.get(
        `${this.SPOT_BASE_URL}/time`,
        {
          timeout: 3000,
        },
      );

      return response.data;
    } catch (error) {
      console.error(`❌ 서버 시간 조회 실패`, error);
      throw new Error(`서버 시간 조회 실패: ${error.message}`);
    }
  }

  /**
   * 거래 심볼 정보 조회
   *
   * @returns 모든 거래 가능한 심볼 정보
   */
  async getExchangeInfo(): Promise<any> {
    await this.checkRateLimit();

    try {
      const response: AxiosResponse = await axios.get(
        `${this.SPOT_BASE_URL}/exchangeInfo`,
        {
          timeout: 10000,
        },
      );

      return response.data;
    } catch (error) {
      console.error(`❌ 거래소 정보 조회 실패`, error);
      throw new Error(`거래소 정보 조회 실패: ${error.message}`);
    }
  }

  /**
   * 레이트 리밋 체크 (private)
   *
   * 바이낸스 API의 레이트 리밋을 준수하기 위한 내부 메서드입니다.
   * 분당 1200회 요청 제한을 관리합니다.
   */
  private async checkRateLimit(): Promise<void> {
    const now = Date.now();

    // 1분마다 카운터 리셋
    if (now - this.lastResetTime > 60000) {
      this.requestCount = 0;
      this.lastResetTime = now;
    }

    // 레이트 리밋 체크
    if (this.requestCount >= this.MAX_REQUESTS_PER_MINUTE) {
      const waitTime = 60000 - (now - this.lastResetTime);
      console.warn(`⚠️ 레이트 리밋 대기: ${waitTime}ms`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));

      // 대기 후 카운터 리셋
      this.requestCount = 0;
      this.lastResetTime = Date.now();
    }

    this.requestCount++;
  }

  /**
   * 현재 레이트 리밋 상태 조회
   *
   * @returns 레이트 리밋 상태 정보
   */
  getRateLimitStatus() {
    const now = Date.now();
    const timeUntilReset = 60000 - (now - this.lastResetTime);

    return {
      currentRequests: this.requestCount,
      maxRequests: this.MAX_REQUESTS_PER_MINUTE,
      remainingRequests: this.MAX_REQUESTS_PER_MINUTE - this.requestCount,
      timeUntilReset: Math.max(0, timeUntilReset),
      resetTime: new Date(this.lastResetTime + 60000),
    };
  }
}
