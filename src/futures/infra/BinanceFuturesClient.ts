import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { CryptoUtil } from 'src/common/utils/CryptoUtil';
import { handleBinanceAxiosError } from 'src/common/utils/binance/BinanceAxiosErrorHandler';

/**
 * 바이낸스 선물거래 API 클라이언트
 *
 * 바이낸스 선물거래 API와 통신하여 다음 기능들을 제공합니다:
 * - 선물 포지션 진입 (롱/숏)
 * - 선물 포지션 청산
 * - 레버리지 설정
 * - 마진 모드 설정
 * - 포지션 정보 조회
 * - 선물 잔고 조회
 *
 * ⚠️ 주의사항:
 * - 선물거래는 높은 위험을 수반합니다
 * - 레버리지 사용 시 손실이 원금을 초과할 수 있습니다
 * - 반드시 충분한 이해 후 사용하시기 바랍니다
 */
const FUTURES_BASE_URL = 'https://fapi.binance.com'; // 바이낸스 선물 API 기본 URL

@Injectable()
export class BinanceFuturesClient {
  private readonly apiKey: string;
  private readonly apiSecret: string;

  constructor(private readonly configService: ConfigService) {
    // 환경변수에서 바이낸스 API 키와 시크릿 로드
    this.apiKey = this.configService.getOrThrow<string>('BINANCE_API_KEY');
    this.apiSecret =
      this.configService.getOrThrow<string>('BINANCE_API_SECRET');
  }

  /**
   * 선물 포지션 진입 (시장가 주문)
   *
   * @param symbol 거래 심볼 (예: BTCUSDT)
   * @param side 포지션 방향 (BUY: 롱, SELL: 숏)
   * @param quantity 포지션 수량
   * @param positionSide 포지션 사이드 (LONG 또는 SHORT)
   * @returns 바이낸스 API 응답 데이터
   *
   * ⚠️ 주의: 시장가 주문은 즉시 체결되므로 슬리피지가 발생할 수 있습니다
   */
  async openPosition(
    symbol: string,
    side: 'BUY' | 'SELL',
    quantity: number,
    positionSide: 'LONG' | 'SHORT',
  ) {
    try {
      const endpoint = '/fapi/v1/order';
      const timestamp = Date.now();

      // 주문 파라미터 구성
      const params = new URLSearchParams({
        symbol,
        side, // BUY (롱 진입) 또는 SELL (숏 진입)
        type: 'MARKET', // 시장가 주문
        quantity: quantity.toString(),
        positionSide, // LONG 또는 SHORT
        timestamp: timestamp.toString(),
      });

      // 바이낸스 API 서명 생성
      const signature = CryptoUtil.generateBinanceSignature(
        params.toString(),
        this.apiSecret,
      );
      params.append('signature', signature);

      const response = await axios.post(
        `${FUTURES_BASE_URL}${endpoint}`,
        params,
        {
          headers: {
            'X-MBX-APIKEY': this.apiKey,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      return response.data;
    } catch (error) {
      // 바이낸스 API 에러를 애플리케이션 에러로 변환
      handleBinanceAxiosError(error, '선물 포지션 진입');
    }
  }

  /**
   * 선물 포지션 청산 (시장가 주문)
   *
   * @param symbol 거래 심볼
   * @param positionSide 청산할 포지션 사이드
   * @param quantity 청산할 수량 (undefined면 전체 청산)
   * @returns 바이낸스 API 응답 데이터
   *
   * 💡 팁: quantity를 지정하지 않으면 해당 포지션을 전체 청산합니다
   */
  async closePosition(
    symbol: string,
    positionSide: 'LONG' | 'SHORT',
    quantity?: number,
  ) {
    try {
      const endpoint = '/fapi/v1/order';
      const timestamp = Date.now();

      // 청산은 포지션 방향과 반대로 주문
      const side = positionSide === 'LONG' ? 'SELL' : 'BUY';

      const params = new URLSearchParams({
        symbol,
        side,
        type: 'MARKET',
        positionSide,
        timestamp: timestamp.toString(),
      });

      // 수량이 지정되지 않으면 전체 청산 (reduceOnly=true)
      if (quantity) {
        params.append('quantity', quantity.toString());
      } else {
        params.append('reduceOnly', 'true'); // 포지션 감소만 허용
      }

      const signature = CryptoUtil.generateBinanceSignature(
        params.toString(),
        this.apiSecret,
      );
      params.append('signature', signature);

      const response = await axios.post(
        `${FUTURES_BASE_URL}${endpoint}`,
        params,
        {
          headers: {
            'X-MBX-APIKEY': this.apiKey,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      return response.data;
    } catch (error) {
      handleBinanceAxiosError(error, '선물 포지션 청산');
    }
  }

  /**
   * 레버리지 설정
   *
   * @param symbol 거래 심볼
   * @param leverage 설정할 레버리지 (1~125)
   * @returns 바이낸스 API 응답 데이터
   *
   * ⚠️ 주의: 포지션이 열려있는 상태에서는 레버리지 변경이 제한될 수 있습니다
   */
  async setLeverage(symbol: string, leverage: number) {
    try {
      const endpoint = '/fapi/v1/leverage';
      const timestamp = Date.now();

      const params = new URLSearchParams({
        symbol,
        leverage: leverage.toString(),
        timestamp: timestamp.toString(),
      });

      const signature = CryptoUtil.generateBinanceSignature(
        params.toString(),
        this.apiSecret,
      );
      params.append('signature', signature);

      const response = await axios.post(
        `${FUTURES_BASE_URL}${endpoint}`,
        params,
        {
          headers: {
            'X-MBX-APIKEY': this.apiKey,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      return response.data;
    } catch (error) {
      handleBinanceAxiosError(error, '레버리지 설정');
    }
  }

  /**
   * 마진 모드 설정
   *
   * @param symbol 거래 심볼
   * @param marginType 마진 타입 (ISOLATED: 격리마진, CROSSED: 교차마진)
   * @returns 바이낸스 API 응답 데이터
   *
   * 📝 설명:
   * - ISOLATED (격리마진): 포지션별로 마진이 분리됨, 리스크 제한적
   * - CROSSED (교차마진): 전체 잔고를 마진으로 사용, 청산 위험 낮지만 리스크 높음
   *
   * ⚠️ 주의: 포지션이 열려있는 상태에서는 마진 모드 변경이 불가능합니다
   */
  async setMarginType(symbol: string, marginType: 'ISOLATED' | 'CROSSED') {
    try {
      const endpoint = '/fapi/v1/marginType';
      const timestamp = Date.now();

      const params = new URLSearchParams({
        symbol,
        marginType,
        timestamp: timestamp.toString(),
      });

      const signature = CryptoUtil.generateBinanceSignature(
        params.toString(),
        this.apiSecret,
      );
      params.append('signature', signature);

      const response = await axios.post(
        `${FUTURES_BASE_URL}${endpoint}`,
        params,
        {
          headers: {
            'X-MBX-APIKEY': this.apiKey,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      return response.data;
    } catch (error) {
      handleBinanceAxiosError(error, '마진 모드 설정');
    }
  }

  /**
   * 현재 포지션 정보 조회
   *
   * @param symbol 조회할 심볼 (선택사항, 없으면 모든 포지션 조회)
   * @returns 포지션 정보 배열
   *
   * 💡 팁: symbol을 지정하지 않으면 모든 심볼의 포지션 정보를 가져옵니다
   */
  async getPositions(symbol?: string) {
    try {
      const endpoint = '/fapi/v2/positionRisk';
      const timestamp = Date.now();

      const params = new URLSearchParams({
        timestamp: timestamp.toString(),
      });

      if (symbol) {
        params.append('symbol', symbol);
      }

      const signature = CryptoUtil.generateBinanceSignature(
        params.toString(),
        this.apiSecret,
      );
      params.append('signature', signature);

      const response = await axios.get(`${FUTURES_BASE_URL}${endpoint}`, {
        params,
        headers: {
          'X-MBX-APIKEY': this.apiKey,
        },
      });

      return response.data;
    } catch (error) {
      handleBinanceAxiosError(error, '포지션 정보 조회');
    }
  }

  /**
   * 선물 계정 잔고 조회
   *
   * @returns 선물 계정의 모든 자산 잔고 정보
   *
   * 📊 반환 정보:
   * - 총 잔고 (포지션 마진 포함)
   * - 사용 가능한 잔고
   * - 최대 출금 가능 금액
   * - 미실현 손익 등
   */
  async getFuturesBalance() {
    try {
      const endpoint = '/fapi/v2/balance';
      const timestamp = Date.now();

      const params = new URLSearchParams({
        timestamp: timestamp.toString(),
      });

      const signature = CryptoUtil.generateBinanceSignature(
        params.toString(),
        this.apiSecret,
      );
      params.append('signature', signature);

      const response = await axios.get(`${FUTURES_BASE_URL}${endpoint}`, {
        params,
        headers: {
          'X-MBX-APIKEY': this.apiKey,
        },
      });

      return response.data;
    } catch (error) {
      handleBinanceAxiosError(error, '선물 잔고 조회');
    }
  }

  /**
   * 현물 계좌와 선물 계좌 간 자금 이체
   *
   * @param asset 이체할 자산 (예: USDT, BTC)
   * @param amount 이체할 금액
   * @param fromAccountType 출발 계좌 유형 (SPOT, FUTURES)
   * @param toAccountType 도착 계좌 유형 (SPOT, FUTURES)
   * @returns 이체 결과
   *
   * 📝 이체 방향:
   * - SPOT → FUTURES: 선물 거래를 위한 자금 이체 (type=1)
   * - FUTURES → SPOT: 선물 계좌에서 현물 계좌로 자금 회수 (type=2)
   */
  async transferFunds(
    asset: string,
    amount: number,
    fromAccountType: 'SPOT' | 'FUTURES',
    toAccountType: 'SPOT' | 'FUTURES',
  ) {
    try {
      // 바이낸스 API에서는 type 파라미터로 이체 방향을 지정
      // type=1: SPOT → FUTURES
      // type=2: FUTURES → SPOT
      const type = fromAccountType === 'SPOT' ? 1 : 2;

      // 현물 API 엔드포인트 사용 (선물 API가 아님)
      const endpoint = '/sapi/v1/futures/transfer';
      const timestamp = Date.now();

      const params = new URLSearchParams({
        asset,
        amount: amount.toString(),
        type: type.toString(),
        timestamp: timestamp.toString(),
      });

      const signature = CryptoUtil.generateBinanceSignature(
        params.toString(),
        this.apiSecret,
      );
      params.append('signature', signature);

      // 현물 API 기본 URL 사용
      const response = await axios.post(
        `https://api.binance.com${endpoint}`,
        null,
        {
          params,
          headers: {
            'X-MBX-APIKEY': this.apiKey,
          },
        },
      );

      return response.data;
    } catch (error) {
      handleBinanceAxiosError(
        error,
        `자금 이체 (${fromAccountType} → ${toAccountType})`,
        `${asset} ${amount}`,
      );
    }
  }
}
