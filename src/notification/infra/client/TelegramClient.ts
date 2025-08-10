import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

/**
 * 텔레그램 알림 서비스 (공통 모듈)
 *
 * 다양한 유형의 알림을 텔레그램으로 전송하는 통합 서비스입니다.
 * 템플릿 기반으로 일관된 형식의 메시지를 제공하며,
 * UTC/KST 시간 표시, 이모지, HTML 포맷팅을 지원합니다.
 *
 * 주요 기능:
 * - 기술적 분석 알림 (MA 돌파, RSI, 볼린저 밴드 등)
 * - 가격 알림 (신고가, 급등/급락, 돌파/이탈)
 * - 뉴스 알림
 * - 사용자 정의 메시지
 * - UTC/KST 시간 자동 변환
 * - HTML 포맷팅 지원
 *
 * @example
 * ```typescript
 * // 기술적 분석 알림
 * await telegramService.sendTechnicalAnalysisAlert('BTCUSDT', {
 *   signal: 'BUY',
 *   indicators: { SMA5: 42850, SMA10: 42500 },
 *   price: 43000
 * });
 *
 * // 가격 돌파 알림
 * await telegramService.sendPriceBreakoutAlert('ETHUSDT', {
 *   currentPrice: 2500,
 *   previousHigh: 2450,
 *   type: 'break_previous_high'
 * });
 * ```
 */
@Injectable()
export class TelegramClient {
  private readonly botToken: string;
  private readonly chatId: string;

  /**
   * 심볼별 한글 이름 매핑
   * 사용자가 이해하기 쉬운 한글 이름으로 표시
   */
  private readonly SYMBOL_NAME_MAP: Record<string, string> = {
    BTCUSDT: '비트코인',
    ETHUSDT: '이더리움',
    ADAUSDT: '에이다',
    SOLUSDT: '솔라나',
    DOGEUSDT: '도지코인',
    XRPUSDT: '리플',
    DOTUSDT: '폴카닷',
    AVAXUSDT: '아발란체',
    MATICUSDT: '폴리곤',
    LINKUSDT: '체인링크',
  };

  /**
   * 심볼별 카테고리 매핑
   * 알림 메시지에서 카테고리 정보 표시용
   */
  private readonly SYMBOL_CATEGORY_MAP: Record<string, string> = {
    BTCUSDT: '메이저코인',
    ETHUSDT: '메이저코인',
    ADAUSDT: '알트코인',
    SOLUSDT: '알트코인',
    DOGEUSDT: '밈코인',
    XRPUSDT: '결제코인',
    DOTUSDT: '플랫폼코인',
    AVAXUSDT: '플랫폼코인',
    MATICUSDT: '레이어2',
    LINKUSDT: '오라클',
  };

  constructor(private readonly configService: ConfigService) {
    this.botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN') || '';
    this.chatId = this.configService.get<string>('TELEGRAM_CHAT_ID') || '';

    if (!this.botToken || !this.chatId) {
      console.warn('⚠️ 텔레그램 환경변수가 설정되지 않았습니다.');
      console.warn('TELEGRAM_BOT_TOKEN:', this.botToken ? '설정됨' : '누락');
      console.warn('TELEGRAM_CHAT_ID:', this.chatId ? '설정됨' : '누락');
    }
  }

  /**
   * UTC 시간을 UTC + KST 형태로 포맷팅
   *
   * @param utcTime UTC 기준 Date 객체
   * @returns "2025-01-16 14:30:15 UTC (23:30:15 KST)" 형태의 문자열
   */
  private formatTimeWithKST(utcTime: Date): string {
    const utcStr = utcTime.toISOString().slice(0, 19).replace('T', ' ');
    const kstTime = new Date(utcTime.getTime() + 9 * 60 * 60 * 1000);
    const kstStr = kstTime.toISOString().slice(0, 19).replace('T', ' ');

    return `${utcStr} UTC (${kstStr} KST)`;
  }

  /**
   * 심볼의 표시명 조회
   *
   * @param symbol 거래 심볼
   * @returns 한글 표시명
   */
  private getDisplayName(symbol: string): string {
    return this.SYMBOL_NAME_MAP[symbol] || symbol;
  }

  /**
   * 심볼의 카테고리 조회
   *
   * @param symbol 거래 심볼
   * @returns 카테고리명
   */
  private getCategory(symbol: string): string {
    return this.SYMBOL_CATEGORY_MAP[symbol] || '기타';
  }

  /**
   * 기본 메시지 전송
   *
   * @param symbol 거래 심볼
   * @param message 메시지 내용
   * @param isNews 뉴스 여부 (기본값: false)
   */
  private async sendBasic(
    symbol: string,
    message: string,
    isNews: boolean = false,
  ): Promise<void> {
    if (!this.botToken || !this.chatId) {
      console.warn('❌ 텔레그램 환경변수가 설정되지 않았습니다.');
      return;
    }

    const displayName = this.getDisplayName(symbol);
    const category = this.getCategory(symbol);
    const prefix = isNews ? '🗞️' : '📌';
    const header = `${prefix} <b>[${symbol}] ${displayName} (${category})</b>\n\n`;

    const fullMessage = header + message;

    const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
    const payload = {
      chat_id: this.chatId,
      text: fullMessage,
      parse_mode: 'HTML',
      disable_web_page_preview: false,
    };

    try {
      const response = await axios.post(url, payload);
      if (response.status !== 200) {
        console.error(
          `❌ 텔레그램 전송 실패: ${response.status} - ${response.data}`,
        );
      } else {
        console.log(`📨 텔레그램 전송 완료: ${symbol}`);
      }
    } catch (error) {
      console.error(`❌ 텔레그램 전송 중 예외 발생:`, error);
    }
  }

  /**
   * 단순 텍스트 메시지 전송
   *
   * @param message 전송할 메시지
   */
  async sendTextMessage(message: string): Promise<void> {
    if (!this.botToken || !this.chatId) {
      console.warn('❌ 텔레그램 환경변수가 설정되지 않았습니다.');
      return;
    }

    const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
    const payload = {
      chat_id: this.chatId,
      text: message,
      parse_mode: 'HTML',
      disable_web_page_preview: false,
    };

    try {
      const response = await axios.post(url, payload);
      if (response.status !== 200) {
        console.error(
          `❌ 텔레그램 전송 실패: ${response.status} - ${response.data}`,
        );
      } else {
        console.log('📨 텔레그램 텍스트 메시지 전송 완료');
      }
    } catch (error) {
      console.error('❌ 텔레그램 전송 중 예외 발생:', error);
    }
  }

  // ==========================================
  // 📈 가격 알림 메시지 함수들
  // ==========================================

  /**
   * 가격 상승 알림
   *
   * @param symbol 거래 심볼
   * @param currentPrice 현재 가격
   * @param prevClose 전일 종가
   * @param percent 변동률
   * @param timestamp 알림 시점
   */
  async sendPriceRiseAlert(
    symbol: string,
    currentPrice: number,
    prevClose: number,
    percent: number,
    timestamp: Date = new Date(),
  ): Promise<void> {
    const name = this.getDisplayName(symbol);
    const message =
      `📈 <b>${name}(${symbol}) 전일 대비 상승!</b>\n\n` +
      `💵 현재가: ${currentPrice.toFixed(2)}\n` +
      `📅 전일 종가: ${prevClose.toFixed(2)}\n` +
      `📊 변동률: <b>+${percent.toFixed(2)}%</b>\n` +
      `🕒 ${this.formatTimeWithKST(timestamp)}`;

    await this.sendBasic(symbol, message);
  }

  /**
   * 가격 하락 알림
   */
  async sendPriceDropAlert(
    symbol: string,
    currentPrice: number,
    prevClose: number,
    percent: number,
    timestamp: Date = new Date(),
  ): Promise<void> {
    const name = this.getDisplayName(symbol);
    const message =
      `📉 <b>${name}(${symbol}) 전일 대비 하락!</b>\n\n` +
      `💵 현재가: ${currentPrice.toFixed(2)}\n` +
      `📅 전일 종가: ${prevClose.toFixed(2)}\n` +
      `📊 변동률: <b>${percent.toFixed(2)}%</b>\n` +
      `🕒 ${this.formatTimeWithKST(timestamp)}`;

    await this.sendBasic(symbol, message);
  }

  /**
   * 전일 고점 돌파 알림
   */
  async sendBreakPreviousHighAlert(
    symbol: string,
    currentPrice: number,
    previousHigh: number,
    timestamp: Date = new Date(),
  ): Promise<void> {
    const name = this.getDisplayName(symbol);
    const percentGain = ((currentPrice - previousHigh) / previousHigh) * 100;
    const message =
      `🚨 <b>${name}(${symbol}) 전일 고점 돌파!</b>\n\n` +
      `💵 현재가: ${currentPrice.toFixed(2)}\n` +
      `🔺 전일 고점: ${previousHigh.toFixed(2)}\n` +
      `📊 돌파폭: <b>+${percentGain.toFixed(2)}%</b>\n` +
      `🕒 돌파 시점: ${this.formatTimeWithKST(timestamp)}`;

    await this.sendBasic(symbol, message);
  }

  /**
   * 전일 저점 하회 알림
   */
  async sendBreakPreviousLowAlert(
    symbol: string,
    currentPrice: number,
    previousLow: number,
    timestamp: Date = new Date(),
  ): Promise<void> {
    const name = this.getDisplayName(symbol);
    const percentDrop = ((currentPrice - previousLow) / previousLow) * 100;
    const message =
      `⚠️ <b>${name}(${symbol}) 전일 저점 하회!</b>\n\n` +
      `💵 현재가: ${currentPrice.toFixed(2)}\n` +
      `🔻 전일 저점: ${previousLow.toFixed(2)}\n` +
      `📊 하회폭: <b>${percentDrop.toFixed(2)}%</b>\n` +
      `🕒 하회 시점: ${this.formatTimeWithKST(timestamp)}`;

    await this.sendBasic(symbol, message);
  }

  /**
   * 신고가 갱신 알림
   */
  async sendNewHighAlert(
    symbol: string,
    currentPrice: number,
    timestamp: Date = new Date(),
  ): Promise<void> {
    const name = this.getDisplayName(symbol);
    const message =
      `🚀 <b>${name}(${symbol}) 최고가 갱신!</b>\n\n` +
      `📈 새로운 최고가: <b>${currentPrice.toFixed(2)}</b>\n` +
      `🕒 갱신 시점: ${this.formatTimeWithKST(timestamp)}`;

    await this.sendBasic(symbol, message);
  }

  /**
   * 최고가 대비 하락 알림
   */
  async sendDropFromHighAlert(
    symbol: string,
    currentPrice: number,
    highPrice: number,
    percent: number,
    timestamp: Date = new Date(),
    highRecordedAt: Date = new Date(),
  ): Promise<void> {
    const name = this.getDisplayName(symbol);
    const message =
      `🔻 <b>${name}(${symbol}) 최고가 대비 하락</b>\n\n` +
      `📉 현재가: ${currentPrice.toFixed(2)}\n` +
      `📈 최고가: ${highPrice.toFixed(2)} (${this.formatTimeWithKST(highRecordedAt)})\n` +
      `📊 낙폭: <b>${percent.toFixed(2)}%</b>\n` +
      `🕒 하락 시점: ${this.formatTimeWithKST(timestamp)}`;

    await this.sendBasic(symbol, message);
  }

  // ==========================================
  // 📊 기술적 지표 알림 메시지 함수들
  // ==========================================

  /**
   * 이동평균선 돌파/이탈 알림
   */
  async sendMABreakoutAlert(
    symbol: string,
    timeframe: string,
    maPeriod: number,
    currentPrice: number,
    maValue: number,
    signalType: 'breakout_up' | 'breakout_down',
    timestamp: Date = new Date(),
  ): Promise<void> {
    const name = this.getDisplayName(symbol);

    // 시간대별 표시명
    const timeframeName: Record<string, string> = {
      '1m': '1분봉',
      '15m': '15분봉',
      '1h': '1시간봉',
      '1d': '일봉',
    };

    const timeframeDisplay = timeframeName[timeframe] || timeframe;

    // 신호 타입별 이모지와 메시지
    let emoji: string;
    let action: string;
    let percent: number;
    let percentText: string;

    if (signalType === 'breakout_up') {
      emoji = '🚀';
      action = '상향 돌파';
      percent = ((currentPrice - maValue) / maValue) * 100;
      percentText = `+${percent.toFixed(2)}%`;
    } else {
      emoji = '📉';
      action = '하향 이탈';
      percent = ((currentPrice - maValue) / maValue) * 100;
      percentText = `${percent.toFixed(2)}%`;
    }

    const message =
      `${emoji} <b>${name}(${symbol}) ${maPeriod}선 ${action}!</b>\n\n` +
      `📊 시간대: ${timeframeDisplay}\n` +
      `💵 현재가: ${currentPrice.toFixed(2)}\n` +
      `📈 ${maPeriod}일선: ${maValue.toFixed(2)}\n` +
      `📊 돌파폭: <b>${percentText}</b>\n` +
      `🕒 돌파 시점: ${this.formatTimeWithKST(timestamp)}`;

    await this.sendBasic(symbol, message);
  }

  /**
   * RSI 과매수/과매도 알림
   */
  async sendRSIAlert(
    symbol: string,
    timeframe: string,
    currentRSI: number,
    signalType: 'overbought' | 'oversold' | 'bullish' | 'bearish',
    timestamp: Date = new Date(),
  ): Promise<void> {
    const name = this.getDisplayName(symbol);

    const timeframeName: Record<string, string> = {
      '1m': '1분봉',
      '15m': '15분봉',
      '1h': '1시간봉',
      '1d': '일봉',
    };

    const timeframeDisplay = timeframeName[timeframe] || timeframe;

    // 신호 타입별 메시지
    const signalInfo: Record<
      string,
      {
        emoji: string;
        title: string;
        description: string;
        action: string;
      }
    > = {
      overbought: {
        emoji: '🔴',
        title: '과매수 진입',
        description: 'RSI 70 돌파 → 조정 가능성',
        action: '매도 고려',
      },
      oversold: {
        emoji: '🟢',
        title: '과매도 진입',
        description: 'RSI 30 이탈 → 반등 가능성',
        action: '매수 고려',
      },
      bullish: {
        emoji: '📈',
        title: '상승 모멘텀',
        description: 'RSI 50 돌파 → 상승 추세',
        action: '상승 추세 확인',
      },
      bearish: {
        emoji: '📉',
        title: '하락 모멘텀',
        description: 'RSI 50 이탈 → 하락 추세',
        action: '하락 추세 확인',
      },
    };

    const info = signalInfo[signalType] || signalInfo.overbought;

    const message =
      `${info.emoji} <b>${name}(${symbol}) RSI ${info.title}!</b>\n\n` +
      `📊 시간대: ${timeframeDisplay}\n` +
      `📈 현재 RSI: <b>${currentRSI.toFixed(1)}</b>\n` +
      `💡 의미: ${info.description}\n` +
      `🎯 전략: ${info.action}\n` +
      `🕒 신호 시점: ${this.formatTimeWithKST(timestamp)}`;

    await this.sendBasic(symbol, message);
  }

  /**
   * 볼린저 밴드 터치/돌파 알림
   */
  async sendBollingerAlert(
    symbol: string,
    timeframe: string,
    currentPrice: number,
    upperBand: number,
    lowerBand: number,
    signalType: 'touch_upper' | 'touch_lower' | 'break_upper' | 'break_lower',
    timestamp: Date = new Date(),
  ): Promise<void> {
    const name = this.getDisplayName(symbol);

    const timeframeName: Record<string, string> = {
      '1m': '1분봉',
      '15m': '15분봉',
      '1h': '1시간봉',
      '1d': '일봉',
    };

    const timeframeDisplay = timeframeName[timeframe] || timeframe;

    // 신호 타입별 메시지
    const signalInfo: Record<
      string,
      {
        emoji: string;
        title: string;
        description: string;
        bandPrice: number;
        bandName: string;
      }
    > = {
      touch_upper: {
        emoji: '🔴',
        title: '상단 밴드 터치',
        description: '과매수 신호 → 조정 가능성',
        bandPrice: upperBand,
        bandName: '상단 밴드',
      },
      touch_lower: {
        emoji: '🟢',
        title: '하단 밴드 터치',
        description: '과매도 신호 → 반등 가능성',
        bandPrice: lowerBand,
        bandName: '하단 밴드',
      },
      break_upper: {
        emoji: '🚀',
        title: '상단 밴드 돌파',
        description: '강한 상승 신호 → 추가 상승 기대',
        bandPrice: upperBand,
        bandName: '상단 밴드',
      },
      break_lower: {
        emoji: '💥',
        title: '하단 밴드 이탈',
        description: '강한 하락 신호 → 추가 하락 우려',
        bandPrice: lowerBand,
        bandName: '하단 밴드',
      },
    };

    const info = signalInfo[signalType] || signalInfo.touch_upper;

    const message =
      `${info.emoji} <b>${name}(${symbol}) 볼린저 ${info.title}!</b>\n\n` +
      `📊 시간대: ${timeframeDisplay}\n` +
      `💵 현재가: ${currentPrice.toFixed(2)}\n` +
      `📈 ${info.bandName}: ${info.bandPrice.toFixed(2)}\n` +
      `💡 의미: ${info.description}\n` +
      `🕒 신호 시점: ${this.formatTimeWithKST(timestamp)}`;

    await this.sendBasic(symbol, message);
  }

  /**
   * 골든크로스 알림 (50일선이 200일선 상향돌파)
   */
  async sendGoldenCrossAlert(
    symbol: string,
    ma50: number,
    ma200: number,
    timestamp: Date = new Date(),
  ): Promise<void> {
    const name = this.getDisplayName(symbol);

    // 50일선이 200일선보다 얼마나 위에 있는지 계산
    const percentDiff = ((ma50 - ma200) / ma200) * 100;

    const message =
      `🚀 <b>${name}(${symbol}) 골든크로스 발생!</b>\n\n` +
      `📊 시간대: 일봉\n` +
      `📈 50일선: ${ma50.toFixed(2)}\n` +
      `📈 200일선: ${ma200.toFixed(2)}\n` +
      `📊 차이: <b>+${percentDiff.toFixed(2)}%</b>\n` +
      `💡 의미: 강력한 상승 신호! 장기 상승 추세 시작 가능성\n` +
      `🎯 전략: 매수 포지션 고려\n` +
      `🕒 발생 시점: ${this.formatTimeWithKST(timestamp)}`;

    await this.sendBasic(symbol, message);
  }

  /**
   * 데드크로스 알림 (50일선이 200일선 하향이탈)
   */
  async sendDeadCrossAlert(
    symbol: string,
    ma50: number,
    ma200: number,
    timestamp: Date = new Date(),
  ): Promise<void> {
    const name = this.getDisplayName(symbol);

    // 50일선이 200일선보다 얼마나 아래에 있는지 계산
    const percentDiff = ((ma50 - ma200) / ma200) * 100;

    const message =
      `💀 <b>${name}(${symbol}) 데드크로스 발생!</b>\n\n` +
      `📊 시간대: 일봉\n` +
      `📉 50일선: ${ma50.toFixed(2)}\n` +
      `📈 200일선: ${ma200.toFixed(2)}\n` +
      `📊 차이: <b>${percentDiff.toFixed(2)}%</b>\n` +
      `💡 의미: 강력한 하락 신호! 장기 하락 추세 시작 가능성\n` +
      `🎯 전략: 매도 포지션 고려\n` +
      `🕒 발생 시점: ${this.formatTimeWithKST(timestamp)}`;

    await this.sendBasic(symbol, message);
  }

  /**
   * 기술적 분석 결과 알림 (기존 호환성 유지)
   */
  async sendAnalysisResult(
    symbol: string,
    result: {
      signal: 'BUY' | 'SELL' | 'HOLD';
      indicators: Record<string, any>;
      price: number;
      timestamp: Date;
    },
  ): Promise<void> {
    const name = this.getDisplayName(symbol);

    let emoji = '📊';
    let signalText = '보유';
    let signalColor = '';

    if (result.signal === 'BUY') {
      emoji = '📈';
      signalText = '매수';
      signalColor = '🟢';
    } else if (result.signal === 'SELL') {
      emoji = '📉';
      signalText = '매도';
      signalColor = '🔴';
    }

    // 안전한 숫자 포맷팅 함수
    const safeToFixed = (value: any, decimals: number = 2): string => {
      if (value === null || value === undefined) return 'N/A';
      if (typeof value === 'string') {
        const num = parseFloat(value);
        return isNaN(num) ? value : num.toFixed(decimals);
      }
      if (typeof value === 'number') {
        return isNaN(value) ? 'N/A' : value.toFixed(decimals);
      }
      return String(value);
    };

    // 가격 포맷팅 (달러 단위)
    const formatPrice = (price: any): string => {
      const num = parseFloat(safeToFixed(price));
      if (isNaN(num)) return 'N/A';
      return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    // 거래량 포맷팅
    const formatVolume = (volume: any): string => {
      const num = parseFloat(safeToFixed(volume));
      if (isNaN(num)) return 'N/A';

      if (num >= 1000000) {
        return `${(num / 1000000).toFixed(2)}M`;
      } else if (num >= 1000) {
        return `${(num / 1000).toFixed(2)}K`;
      }
      return num.toFixed(2);
    };

    // 신뢰도 표시
    const confidence = result.indicators.confidence || 50;
    const getConfidenceEmoji = (conf: number): string => {
      if (conf >= 80) return '🟢';
      if (conf >= 60) return '🟡';
      return '🔴';
    };

    // 현재가를 숫자로 변환
    const currentPrice = parseFloat(safeToFixed(result.price));
    // 환율 정보 확인
    const exchangeRate = result.indicators.exchangeRate;
    const hasExchangeRate = exchangeRate && exchangeRate > 0;
    const priceKRW = hasExchangeRate
      ? Math.round(currentPrice * exchangeRate)
      : 0;

    // 15분 변화율 계산 (이전 가격이 있다면)
    const prevPrice = result.indicators.prevPrice || currentPrice;
    const priceChange = currentPrice - prevPrice;
    const priceChangePercent = (priceChange / prevPrice) * 100;
    const changeEmoji = priceChange >= 0 ? '⬆️' : '⬇️';
    const changeSign = priceChange >= 0 ? '+' : '';

    // 이동평균선 현재가 대비 계산
    const sma5 = parseFloat(safeToFixed(result.indicators.SMA5));
    const sma20 = parseFloat(safeToFixed(result.indicators.SMA20));
    const sma50 =
      parseFloat(safeToFixed(result.indicators.SMA50)) || currentPrice;
    const sma200 =
      parseFloat(safeToFixed(result.indicators.SMA200)) || currentPrice;
    const ema12 =
      parseFloat(safeToFixed(result.indicators.EMA12)) || currentPrice;
    const ema26 =
      parseFloat(safeToFixed(result.indicators.EMA26)) || currentPrice;
    const vwap =
      parseFloat(safeToFixed(result.indicators.VWAP)) || currentPrice;

    // 현재가 대비 퍼센트 계산
    const calcPercent = (value: number) => {
      if (isNaN(value) || value === 0) return 'N/A';
      const percent = ((value - currentPrice) / currentPrice) * 100;
      const sign = percent >= 0 ? '+' : '';
      const emoji = percent >= 0 ? '⬆️' : '⬇️';
      return `${sign}${percent.toFixed(2)}% ${emoji}`;
    };

    // RSI 분석
    const rsi = parseFloat(safeToFixed(result.indicators.RSI)) || 50;
    let rsiStatus = '';
    let rsiWarning = '';
    if (rsi >= 70) {
      rsiStatus = '⚠️ 과매수 근접';
      rsiWarning = `, 70까지 ${(70 - rsi).toFixed(1)}`;
    } else if (rsi <= 30) {
      rsiStatus = '🟢 과매도 구간';
      rsiWarning = `, 30까지 ${(rsi - 30).toFixed(1)}`;
    } else if (rsi >= 60) {
      rsiStatus = '📈 강세 구간';
    } else if (rsi <= 40) {
      rsiStatus = '📉 약세 구간';
    } else {
      rsiStatus = '📊 중립 구간';
    }

    // MACD 분석
    const macdLine = parseFloat(safeToFixed(result.indicators.MACD)) || 0;
    const macdSignal =
      parseFloat(safeToFixed(result.indicators.MACDSignal)) || 0;
    const macdHist = parseFloat(safeToFixed(result.indicators.MACDHist)) || 0;
    const macdTrend =
      macdLine > macdSignal
        ? '📈 골든크로스 유지 (강세)'
        : '📉 데드크로스 (약세)';

    // 볼린저 밴드 분석
    const bbUpper =
      parseFloat(safeToFixed(result.indicators.BBUpper)) || currentPrice * 1.02;
    const bbMiddle =
      parseFloat(safeToFixed(result.indicators.BBMiddle)) || currentPrice;
    const bbLower =
      parseFloat(safeToFixed(result.indicators.BBLower)) || currentPrice * 0.98;
    const bbPosition = ((currentPrice - bbLower) / (bbUpper - bbLower)) * 100;
    let bbStatus = '';
    if (bbPosition >= 80) {
      bbStatus = '상단 근접';
    } else if (bbPosition <= 20) {
      bbStatus = '하단 근접';
    } else {
      bbStatus = '중간 위치';
    }

    // 거래량 분석
    const currentVolume =
      parseFloat(safeToFixed(result.indicators.Volume)) || 0;
    const avgVolume = parseFloat(safeToFixed(result.indicators.AvgVolume)) || 1;
    const volumeRatio = currentVolume / avgVolume;
    const volumeEmoji =
      volumeRatio >= 2 ? '🔥' : volumeRatio >= 1.5 ? '📈' : '📊';
    const obv = parseFloat(safeToFixed(result.indicators.OBV)) || 0;
    const obvTrend = obv > 0 ? '상승 지속' : '하락 지속';

    // 종합 판단
    let shortTerm = '중립';
    let mediumTerm = '중립';
    let longTerm = '중립';

    if (rsi >= 70) shortTerm = '중립 (RSI 과매수 주의)';
    else if (result.signal === 'BUY') shortTerm = '강세';
    else if (result.signal === 'SELL') shortTerm = '약세';

    if (macdLine > macdSignal) mediumTerm = '강세 (MACD 골든크로스)';
    else mediumTerm = '약세 (MACD 데드크로스)';

    if (currentPrice > sma200) longTerm = '상승 (200일선 상회)';
    else longTerm = '하락 (200일선 하회)';

    const message =
      `🔔 <b>${name} 15분 분석 리포트</b> (${result.timestamp.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })})\n\n` +
      `💰 <b>가격 정보</b>\n` +
      `BTC/USD: ${formatPrice(result.price)}\n` +
      `${
        hasExchangeRate
          ? `원화: ₩${priceKRW.toLocaleString()} (환율: $1 = ₩${exchangeRate.toLocaleString()})\n`
          : `원화: 환율 조회 불가로 표시할 수 없습니다\n`
      }` +
      `15분 변화: ${changeSign}${priceChangePercent.toFixed(2)}% (${changeSign}$${Math.abs(priceChange).toFixed(2)}) ${changeEmoji}\n\n` +
      `📈 <b>이동평균선 (현재가 대비)</b>\n` +
      `• SMA5: $${formatPrice(sma5)} (${calcPercent(sma5)})\n` +
      `• SMA20: $${formatPrice(sma20)} (${calcPercent(sma20)})\n` +
      `• SMA50: $${formatPrice(sma50)} (${calcPercent(sma50)})\n` +
      `• SMA200: $${formatPrice(sma200)} (${calcPercent(sma200)})\n` +
      `• EMA12: $${formatPrice(ema12)} (${calcPercent(ema12)})\n` +
      `• EMA26: $${formatPrice(ema26)} (${calcPercent(ema26)})\n` +
      `• VWAP: $${formatPrice(vwap)} (${calcPercent(vwap)})\n\n` +
      `📊 <b>기술 지표</b>\n` +
      `• RSI(14): ${rsi.toFixed(1)} (${rsiStatus}${rsiWarning})\n` +
      `• MACD: ${changeSign}${macdLine.toFixed(1)} / Signal: ${changeSign}${macdSignal.toFixed(1)} / Hist: ${changeSign}${macdHist.toFixed(1)}\n` +
      `→ ${macdTrend}\n\n` +
      `🎯 <b>볼린저 밴드</b>\n` +
      `• 상단: $${formatPrice(bbUpper)} (${calcPercent(bbUpper)})\n` +
      `• 중심: $${formatPrice(bbMiddle)} (${calcPercent(bbMiddle)})\n` +
      `• 하단: $${formatPrice(bbLower)} (${calcPercent(bbLower)})\n` +
      `• 현재 위치: ${bbPosition.toFixed(0)}% (${bbStatus})\n\n` +
      `📊 <b>거래량 분석</b>\n` +
      `• 현재: ${formatVolume(currentVolume)} BTC\n` +
      `• 평균 대비: +${((volumeRatio - 1) * 100).toFixed(0)}% ${volumeEmoji}\n` +
      `• OBV: ${changeSign}${Math.abs(obv).toLocaleString()} (${obvTrend})\n\n` +
      `💡 <b>종합 판단</b>\n` +
      `단기: ${shortTerm}\n` +
      `중기: ${mediumTerm}\n` +
      `장기: ${longTerm}\n\n` +
      `🕒 분석 시점: ${this.formatTimeWithKST(result.timestamp)}`;

    await this.sendBasic(symbol, message);
  }

  // ==========================================
  // 📰 뉴스 알림
  // ==========================================

  /**
   * 뉴스 알림
   */
  async sendNewsAlert(
    title: string,
    summary: string,
    url: string,
    publishedAt: Date,
    symbol: string,
  ): Promise<void> {
    const publishedStr = publishedAt
      ? this.formatTimeWithKST(publishedAt)
      : '날짜 없음';

    const message =
      `📰 <b>${title}</b>\n\n` +
      `${summary || '요약 없음'}\n\n` +
      `📅 <i>${publishedStr}</i>\n` +
      `🔗 <a href="${url}">기사 보러가기</a>`;

    await this.sendBasic(symbol, message, true);
  }

  // ==========================================
  // 🎯 개별 전략/지표 임계값 돌파 알림
  // ==========================================

  /**
   * 이동평균선 돌파 개별 알림
   */
  async sendMABreakoutIndividualAlert(
    symbol: string,
    timeframe: string,
    maPeriod: number,
    currentPrice: number,
    maValue: number,
    signalType: 'breakout_up' | 'breakout_down',
    confidence: number,
    timestamp: Date = new Date(),
  ): Promise<void> {
    const name = this.getDisplayName(symbol);

    // 시간대별 표시명
    const timeframeName: Record<string, string> = {
      '1m': '1분봉',
      '15m': '15분봉',
      '1h': '1시간봉',
      '1d': '일봉',
    };

    const timeframeDisplay = timeframeName[timeframe] || timeframe;

    // 신호 타입별 이모지와 메시지
    let emoji: string;
    let action: string;
    let percent: number;
    let percentText: string;

    if (signalType === 'breakout_up') {
      emoji = '🚀';
      action = '상향 돌파';
      percent = ((currentPrice - maValue) / maValue) * 100;
      percentText = `+${percent.toFixed(2)}%`;
    } else {
      emoji = '📉';
      action = '하향 이탈';
      percent = ((currentPrice - maValue) / maValue) * 100;
      percentText = `${percent.toFixed(2)}%`;
    }

    // 신호별 의미 설명
    let signalMeaning = '';
    if (signalType === 'breakout_up') {
      signalMeaning =
        '💡 <b>이 신호는 강한 추가상승을 기대할 수 있습니다.</b> 이동평균선 상향돌파는 상승모멘텀이 확보되었음을 의미하며, 추세 전환 가능성이 높습니다.';
    } else {
      signalMeaning =
        '⚠️ <b>이 신호는 추가하락 위험을 경고합니다.</b> 이동평균선 하향이탈은 하락모멘텀이 강해지고 있음을 의미하며, 손절매를 고려해야 합니다.';
    }

    const message =
      `${emoji} <b>${name}(${symbol}) MA${maPeriod} ${action}!</b>\n\n` +
      `📊 시간대: ${timeframeDisplay}\n` +
      `💵 현재가: $${currentPrice.toLocaleString()}\n` +
      `📈 MA${maPeriod}: $${maValue.toLocaleString()}\n` +
      `📊 돌파폭: <b>${percentText}</b>\n` +
      `🎯 신뢰도: <b>${confidence}%</b>\n\n` +
      `${signalMeaning}\n\n` +
      `🕒 돌파 시점: ${this.formatTimeWithKST(timestamp)}`;

    await this.sendBasic(symbol, message);
  }

  /**
   * RSI 임계값 돌파 개별 알림
   */
  async sendRSIThresholdAlert(
    symbol: string,
    timeframe: string,
    currentRSI: number,
    signalType: 'overbought' | 'oversold' | 'bullish_50' | 'bearish_50',
    confidence: number,
    timestamp: Date = new Date(),
  ): Promise<void> {
    const name = this.getDisplayName(symbol);

    const timeframeName: Record<string, string> = {
      '1m': '1분봉',
      '15m': '15분봉',
      '1h': '1시간봉',
      '1d': '일봉',
    };

    const timeframeDisplay = timeframeName[timeframe] || timeframe;

    // 신호 타입별 메시지
    const signalInfo: Record<
      string,
      {
        emoji: string;
        title: string;
        description: string;
        action: string;
        threshold: number;
      }
    > = {
      overbought: {
        emoji: '🔴',
        title: 'RSI 과매수 진입',
        description: 'RSI 70 돌파 → 조정 가능성',
        action: '매도 고려',
        threshold: 70,
      },
      oversold: {
        emoji: '🟢',
        title: 'RSI 과매도 진입',
        description: 'RSI 30 이탈 → 반등 가능성',
        action: '매수 고려',
        threshold: 30,
      },
      bullish_50: {
        emoji: '📈',
        title: 'RSI 상승 모멘텀',
        description: 'RSI 50 상향 돌파 → 상승 추세',
        action: '상승 추세 확인',
        threshold: 50,
      },
      bearish_50: {
        emoji: '📉',
        title: 'RSI 하락 모멘텀',
        description: 'RSI 50 하향 이탈 → 하락 추세',
        action: '하락 추세 확인',
        threshold: 50,
      },
    };

    const info = signalInfo[signalType] || signalInfo.overbought;

    // 신호별 상세 의미 해설
    let detailedMeaning = '';
    if (signalType === 'overbought') {
      detailedMeaning =
        '💡 <b>RSI 과매수 구간 진입으로 단기 조정 가능성이 높습니다.</b> 70 이상은 매수세가 과열된 상태로, 수익 실현 차익거래가 나타날 수 있어 매도를 고려해야 합니다.';
    } else if (signalType === 'oversold') {
      detailedMeaning =
        '💡 <b>RSI 과매도 구간 진입으로 반등 기회가 나타났습니다.</b> 30 이하는 매도세가 과도한 상태로, 단기 바닥권에서 반등 매수 기회를 제공할 수 있습니다.';
    } else if (signalType === 'bullish_50') {
      detailedMeaning =
        '💡 <b>RSI 50선 상향돌파로 상승 모멘텀이 확인되었습니다.</b> 중립선 돌파는 매수세 우위를 의미하며, 상승 추세 초기 단계로 판단됩니다.';
    } else {
      detailedMeaning =
        '⚠️ <b>RSI 50선 하향이탈로 하락 모멘텀이 강화되었습니다.</b> 중립선 이탈은 매도세 우위를 의미하며, 하락 추세 진입 가능성이 높습니다.';
    }

    const message =
      `${info.emoji} <b>${name}(${symbol}) ${info.title}!</b>\n\n` +
      `📊 시간대: ${timeframeDisplay}\n` +
      `📈 현재 RSI: <b>${currentRSI.toFixed(1)}</b>\n` +
      `🎯 임계값: ${info.threshold}\n` +
      `💡 기본 의미: ${info.description}\n` +
      `📊 투자 전략: ${info.action}\n` +
      `🎯 신뢰도: <b>${confidence}%</b>\n\n` +
      `${detailedMeaning}\n\n` +
      `🕒 신호 시점: ${this.formatTimeWithKST(timestamp)}`;

    await this.sendBasic(symbol, message);
  }

  /**
   * MACD 시그널 개별 알림
   */
  async sendMACDSignalAlert(
    symbol: string,
    timeframe: string,
    macdLine: number,
    signalLine: number,
    histogram: number,
    signalType:
      | 'golden_cross'
      | 'dead_cross'
      | 'bullish_divergence'
      | 'bearish_divergence',
    confidence: number,
    timestamp: Date = new Date(),
  ): Promise<void> {
    const name = this.getDisplayName(symbol);

    const timeframeName: Record<string, string> = {
      '1m': '1분봉',
      '15m': '15분봉',
      '1h': '1시간봉',
      '1d': '일봉',
    };

    const timeframeDisplay = timeframeName[timeframe] || timeframe;

    const signalInfo: Record<
      string,
      {
        emoji: string;
        title: string;
        description: string;
        action: string;
      }
    > = {
      golden_cross: {
        emoji: '🌟',
        title: 'MACD 골든크로스',
        description: 'MACD 라인이 시그널 라인 상향 돌파',
        action: '매수 신호',
      },
      dead_cross: {
        emoji: '💀',
        title: 'MACD 데드크로스',
        description: 'MACD 라인이 시그널 라인 하향 이탈',
        action: '매도 신호',
      },
      bullish_divergence: {
        emoji: '📈',
        title: 'MACD 강세 다이버전스',
        description: '가격 하락 중 MACD 상승 → 반전 신호',
        action: '매수 타이밍',
      },
      bearish_divergence: {
        emoji: '📉',
        title: 'MACD 약세 다이버전스',
        description: '가격 상승 중 MACD 하락 → 조정 신호',
        action: '매도 타이밍',
      },
    };

    const info = signalInfo[signalType] || signalInfo.golden_cross;

    // 신호별 상세 의미 해설
    let detailedMeaning = '';
    if (signalType === 'golden_cross') {
      detailedMeaning =
        '💡 <b>MACD 골든크로스는 강력한 상승신호입니다.</b> 단기 이동평균이 장기 이동평균을 상향돌파하여 상승 모멘텀이 강화되고 있음을 의미합니다. 매수 포지션 진입을 적극 고려해야 합니다.';
    } else if (signalType === 'dead_cross') {
      detailedMeaning =
        '⚠️ <b>MACD 데드크로스는 강력한 하락신호입니다.</b> 단기 이동평균이 장기 이동평균을 하향이탈하여 하락 모멘텀이 강화되고 있음을 의미합니다. 매도 포지션 진입을 적극 고려해야 합니다.';
    } else if (signalType === 'bullish_divergence') {
      detailedMeaning =
        '💡 <b>강세 다이버전스는 추세 반전 가능성을 시사합니다.</b> 가격은 하락하지만 MACD는 상승하는 패턴으로, 매도 압력이 약해지고 있어 반등 매수 기회가 될 수 있습니다.';
    } else {
      detailedMeaning =
        '⚠️ <b>약세 다이버전스는 상승 추세 약화를 경고합니다.</b> 가격은 상승하지만 MACD는 하락하는 패턴으로, 매수 압력이 약해지고 있어 조정 가능성이 높습니다.';
    }

    const message =
      `${info.emoji} <b>${name}(${symbol}) ${info.title}!</b>\n\n` +
      `📊 시간대: ${timeframeDisplay}\n` +
      `📈 MACD 라인: ${macdLine.toFixed(4)}\n` +
      `📊 시그널 라인: ${signalLine.toFixed(4)}\n` +
      `📊 히스토그램: ${histogram.toFixed(4)}\n` +
      `💡 기본 의미: ${info.description}\n` +
      `🎯 투자 전략: ${info.action}\n` +
      `🎯 신뢰도: <b>${confidence}%</b>\n\n` +
      `${detailedMeaning}\n\n` +
      `🕒 신호 시점: ${this.formatTimeWithKST(timestamp)}`;

    await this.sendBasic(symbol, message);
  }

  /**
   * 볼린저 밴드 임계값 터치/돌파 개별 알림
   */
  async sendBollingerIndividualAlert(
    symbol: string,
    timeframe: string,
    currentPrice: number,
    upperBand: number,
    lowerBand: number,
    middleBand: number,
    signalType:
      | 'touch_upper'
      | 'touch_lower'
      | 'break_upper'
      | 'break_lower'
      | 'squeeze',
    confidence: number,
    timestamp: Date = new Date(),
  ): Promise<void> {
    const name = this.getDisplayName(symbol);

    const timeframeName: Record<string, string> = {
      '1m': '1분봉',
      '15m': '15분봉',
      '1h': '1시간봉',
      '1d': '일봉',
    };

    const timeframeDisplay = timeframeName[timeframe] || timeframe;

    // 신호 타입별 메시지
    const signalInfo: Record<
      string,
      {
        emoji: string;
        title: string;
        description: string;
        bandPrice?: number;
        bandName?: string;
      }
    > = {
      touch_upper: {
        emoji: '🔴',
        title: '볼린저 상단 터치',
        description: '과매수 신호 → 조정 가능성',
        bandPrice: upperBand,
        bandName: '상단 밴드',
      },
      touch_lower: {
        emoji: '🟢',
        title: '볼린저 하단 터치',
        description: '과매도 신호 → 반등 가능성',
        bandPrice: lowerBand,
        bandName: '하단 밴드',
      },
      break_upper: {
        emoji: '🚀',
        title: '볼린저 상단 돌파',
        description: '강한 상승 신호 → 추가 상승 기대',
        bandPrice: upperBand,
        bandName: '상단 밴드',
      },
      break_lower: {
        emoji: '💥',
        title: '볼린저 하단 이탈',
        description: '강한 하락 신호 → 추가 하락 우려',
        bandPrice: lowerBand,
        bandName: '하단 밴드',
      },
      squeeze: {
        emoji: '⚡',
        title: '볼린저 밴드 스퀴즈',
        description: '변동성 축소 → 큰 움직임 임박',
      },
    };

    const info = signalInfo[signalType] || signalInfo.touch_upper;

    // 신호별 상세 의미 해설
    let detailedMeaning = '';
    if (signalType === 'touch_upper') {
      detailedMeaning =
        '💡 <b>볼린저 상단 터치는 과매수 구간 진입을 의미합니다.</b> 가격이 통계적 상한선에 도달하여 단기 조정 압력이 증가하고 있습니다. 수익 실현 매물 출현 가능성이 높습니다.';
    } else if (signalType === 'touch_lower') {
      detailedMeaning =
        '💡 <b>볼린저 하단 터치는 과매도 구간 진입을 의미합니다.</b> 가격이 통계적 하한선에 도달하여 단기 반등 가능성이 높아졌습니다. 저점 매수 기회로 활용할 수 있습니다.';
    } else if (signalType === 'break_upper') {
      detailedMeaning =
        '💡 <b>볼린저 상단 돌파는 강력한 상승 돌파를 의미합니다.</b> 통계적 저항선을 뚫고 상승하여 추가 상승 모멘텀이 확보되었습니다. 추세 가속화 가능성이 높습니다.';
    } else if (signalType === 'break_lower') {
      detailedMeaning =
        '⚠️ <b>볼린저 하단 이탈은 강력한 하락 신호입니다.</b> 통계적 지지선을 하향 이탈하여 추가 하락 압력이 강화되었습니다. 손절매를 적극 고려해야 합니다.';
    } else {
      detailedMeaning =
        '💡 <b>볼린저 밴드 스퀴즈는 큰 변동성 움직임을 예고합니다.</b> 밴드 폭이 축소되어 변동성이 낮아진 상태로, 곧 방향성 있는 큰 움직임이 나타날 가능성이 높습니다.';
    }

    let bandInfo = '';
    if (info.bandPrice && info.bandName) {
      bandInfo = `📈 ${info.bandName}: $${info.bandPrice.toLocaleString()}\n`;
    }

    const message =
      `${info.emoji} <b>${name}(${symbol}) ${info.title}!</b>\n\n` +
      `📊 시간대: ${timeframeDisplay}\n` +
      `💵 현재가: $${currentPrice.toLocaleString()}\n` +
      bandInfo +
      `📊 중간선: $${middleBand.toLocaleString()}\n` +
      `💡 기본 의미: ${info.description}\n` +
      `🎯 신뢰도: <b>${confidence}%</b>\n\n` +
      `${detailedMeaning}\n\n` +
      `🕒 신호 시점: ${this.formatTimeWithKST(timestamp)}`;

    await this.sendBasic(symbol, message);
  }

  /**
   * 거래량 급증 개별 알림
   */
  async sendVolumeSpikeAlert(
    symbol: string,
    timeframe: string,
    currentVolume: number,
    avgVolume: number,
    volumeRatio: number,
    signalType: 'volume_surge' | 'volume_dry_up',
    confidence: number,
    timestamp: Date = new Date(),
  ): Promise<void> {
    const name = this.getDisplayName(symbol);

    const timeframeName: Record<string, string> = {
      '1m': '1분봉',
      '15m': '15분봉',
      '1h': '1시간봉',
      '1d': '일봉',
    };

    const timeframeDisplay = timeframeName[timeframe] || timeframe;

    const signalInfo: Record<
      string,
      {
        emoji: string;
        title: string;
        description: string;
        action: string;
      }
    > = {
      volume_surge: {
        emoji: '📊',
        title: '거래량 급증',
        description: '평균 대비 급격한 거래량 증가',
        action: '관심 증가 → 추세 강화 가능성',
      },
      volume_dry_up: {
        emoji: '📉',
        title: '거래량 감소',
        description: '평균 대비 거래량 현저히 감소',
        action: '관심 감소 → 추세 약화 가능성',
      },
    };

    const info = signalInfo[signalType] || signalInfo.volume_surge;

    // 신호별 상세 의미 해설
    let detailedMeaning = '';
    if (signalType === 'volume_surge') {
      detailedMeaning =
        '💡 <b>거래량 급증은 강력한 관심도 증가를 의미합니다.</b> 평소보다 몇 배 높은 거래량은 큰 손들의 참여나 중요한 뉴스 반영을 시사하며, 가격 움직임이 가속화될 가능성이 높습니다.';
    } else {
      detailedMeaning =
        '⚠️ <b>거래량 급감은 관심도 하락을 의미합니다.</b> 거래량 부족은 유동성 부족과 가격 안정성 저하를 의미하며, 큰 움직임 시 급격한 변동 가능성이 있습니다.';
    }

    // 거래량 단위 포맷팅
    const formatVolume = (volume: number): string => {
      if (volume >= 1000000) {
        return `${(volume / 1000000).toFixed(2)}M`;
      } else if (volume >= 1000) {
        return `${(volume / 1000).toFixed(2)}K`;
      }
      return volume.toFixed(2);
    };

    const message =
      `${info.emoji} <b>${name}(${symbol}) ${info.title}!</b>\n\n` +
      `📊 시간대: ${timeframeDisplay}\n` +
      `📊 현재 거래량: ${formatVolume(currentVolume)}\n` +
      `📊 평균 거래량: ${formatVolume(avgVolume)}\n` +
      `📊 거래량 비율: <b>${volumeRatio.toFixed(2)}배</b>\n` +
      `💡 기본 의미: ${info.description}\n` +
      `🎯 투자 전망: ${info.action}\n` +
      `🎯 신뢰도: <b>${confidence}%</b>\n\n` +
      `${detailedMeaning}\n\n` +
      `🕒 신호 시점: ${this.formatTimeWithKST(timestamp)}`;

    await this.sendBasic(symbol, message);
  }

  /**
   * 가격 레벨 돌파 개별 알림 (지지선/저항선)
   */
  async sendPriceLevelBreakAlert(
    symbol: string,
    timeframe: string,
    currentPrice: number,
    levelPrice: number,
    levelType: 'support' | 'resistance',
    signalType: 'break_up' | 'break_down',
    confidence: number,
    timestamp: Date = new Date(),
  ): Promise<void> {
    const name = this.getDisplayName(symbol);

    const timeframeName: Record<string, string> = {
      '1m': '1분봉',
      '15m': '15분봉',
      '1h': '1시간봉',
      '1d': '일봉',
    };

    const timeframeDisplay = timeframeName[timeframe] || timeframe;

    const levelName = levelType === 'support' ? '지지선' : '저항선';
    const emoji = signalType === 'break_up' ? '🚀' : '💥';
    const action = signalType === 'break_up' ? '상향 돌파' : '하향 이탈';

    const percent = Math.abs(((currentPrice - levelPrice) / levelPrice) * 100);
    const percentText =
      signalType === 'break_up'
        ? `+${percent.toFixed(2)}%`
        : `-${percent.toFixed(2)}%`;

    const message =
      `${emoji} <b>${name}(${symbol}) ${levelName} ${action}!</b>\n\n` +
      `📊 시간대: ${timeframeDisplay}\n` +
      `💵 현재가: $${currentPrice.toLocaleString()}\n` +
      `📈 ${levelName}: $${levelPrice.toLocaleString()}\n` +
      `📊 돌파폭: <b>${percentText}</b>\n` +
      `💡 의미: ${levelName} ${action} → 추세 전환 가능성\n` +
      `🎯 신뢰도: <b>${confidence}%</b>\n` +
      `🕒 돌파 시점: ${this.formatTimeWithKST(timestamp)}`;

    await this.sendBasic(symbol, message);
  }

  // ==========================================
  // 🚀 고급 전략 알림 메시지 함수들
  // ==========================================

  /**
   * 스마트 머니 플로우 전략 알림
   */
  async sendSmartMoneyFlowAlert(
    symbol: string,
    timeframe: string,
    signal: string,
    confidence: number,
    indicators: any,
    timestamp: Date = new Date(),
  ): Promise<void> {
    const name = this.getDisplayName(symbol);

    const timeframeName: Record<string, string> = {
      '15m': '15분봉',
      '1h': '1시간봉',
      '4h': '4시간봉',
      '1d': '일봉',
    };

    const timeframeDisplay = timeframeName[timeframe] || timeframe;

    let emoji = '🤖';
    let signalText = '중립';
    let signalColor = '⚪';

    if (signal === 'BUY' || signal === 'STRONG_BUY') {
      emoji = '💰';
      signalText = '스마트 머니 유입';
      signalColor = '🟢';
    } else if (signal === 'SELL' || signal === 'STRONG_SELL') {
      emoji = '💸';
      signalText = '스마트 머니 유출';
      signalColor = '🔴';
    }

    const message =
      `${emoji} <b>${name}(${symbol}) 스마트 머니 플로우 감지!</b>\n\n` +
      `📊 시간대: ${timeframeDisplay}\n` +
      `${signalColor} 신호: <b>${signalText}</b>\n` +
      `🎯 신뢰도: <b>${confidence}%</b>\n` +
      `📈 기관 자금 흐름: ${indicators.institutionalFlow || 'N/A'}\n` +
      `📊 거래량 프로필: ${indicators.volumeProfile || 'N/A'}\n` +
      `💡 의미: 기관투자자들의 자금 움직임이 감지되었습니다.\n\n` +
      `🕒 감지 시점: ${this.formatTimeWithKST(timestamp)}`;

    await this.sendBasic(symbol, message);
  }

  /**
   * 다중 시간봉 트렌드 전략 알림
   */
  async sendMultiTimeframeTrendAlert(
    symbol: string,
    signal: string,
    confidence: number,
    trendAnalysis: any[],
    timestamp: Date = new Date(),
  ): Promise<void> {
    const name = this.getDisplayName(symbol);

    let emoji = '📊';
    let signalText = '중립';
    let signalColor = '⚪';

    if (signal === 'BUY' || signal === 'STRONG_BUY') {
      emoji = '📈';
      signalText = '다중 시간봉 상승';
      signalColor = '🟢';
    } else if (signal === 'SELL' || signal === 'STRONG_SELL') {
      emoji = '📉';
      signalText = '다중 시간봉 하락';
      signalColor = '🔴';
    }

    // 시간봉별 트렌드 요약
    const trendSummary = trendAnalysis
      .map(
        (t) =>
          `• ${t.timeframe}: ${t.direction === 'bullish' ? '🟢 상승' : t.direction === 'bearish' ? '🔴 하락' : '⚪ 중립'} (${t.strength}%)`,
      )
      .join('\n');

    const message =
      `${emoji} <b>${name}(${symbol}) 다중 시간봉 분석!</b>\n\n` +
      `${signalColor} 종합 신호: <b>${signalText}</b>\n` +
      `🎯 신뢰도: <b>${confidence}%</b>\n\n` +
      `📊 <b>시간봉별 트렌드:</b>\n${trendSummary}\n\n` +
      `💡 의미: 여러 시간봉에서 동일한 방향성이 확인되어 신뢰도가 높습니다.\n\n` +
      `🕒 분석 시점: ${this.formatTimeWithKST(timestamp)}`;

    await this.sendBasic(symbol, message);
  }

  /**
   * 패턴 인식 전략 알림
   */
  async sendPatternRecognitionAlert(
    symbol: string,
    timeframe: string,
    signal: string,
    confidence: number,
    patterns: any,
    timestamp: Date = new Date(),
  ): Promise<void> {
    const name = this.getDisplayName(symbol);

    const timeframeName: Record<string, string> = {
      '15m': '15분봉',
      '1h': '1시간봉',
      '4h': '4시간봉',
      '1d': '일봉',
    };

    const timeframeDisplay = timeframeName[timeframe] || timeframe;

    let emoji = '🔍';
    let signalText = '패턴 없음';
    let signalColor = '⚪';

    if (signal === 'BUY' || signal === 'STRONG_BUY') {
      emoji = '📈';
      signalText = '강세 패턴';
      signalColor = '🟢';
    } else if (signal === 'SELL' || signal === 'STRONG_SELL') {
      emoji = '📉';
      signalText = '약세 패턴';
      signalColor = '🔴';
    }

    // 감지된 패턴들
    const detectedPatterns: string[] = [];
    if (patterns.doubleBottom) detectedPatterns.push('🟢 더블 바텀');
    if (patterns.headAndShoulders) detectedPatterns.push('🔴 헤드앤숄더');
    if (patterns.triangle) detectedPatterns.push('📐 삼각형');
    if (patterns.flag) detectedPatterns.push('🚩 플래그');
    if (patterns.wedge) detectedPatterns.push('📐 웨지');

    const patternList =
      detectedPatterns.length > 0 ? detectedPatterns.join('\n• ') : '패턴 없음';

    const message =
      `${emoji} <b>${name}(${symbol}) 차트 패턴 감지!</b>\n\n` +
      `📊 시간대: ${timeframeDisplay}\n` +
      `${signalColor} 신호: <b>${signalText}</b>\n` +
      `🎯 신뢰도: <b>${confidence}%</b>\n\n` +
      `🔍 <b>감지된 패턴:</b>\n• ${patternList}\n\n` +
      `💡 의미: 기술적 차트 패턴이 감지되어 향후 가격 움직임을 예측할 수 있습니다.\n\n` +
      `🕒 감지 시점: ${this.formatTimeWithKST(timestamp)}`;

    await this.sendBasic(symbol, message);
  }

  // ==========================================
  // 💼 실전 전략 알림 메시지 함수들
  // ==========================================

  /**
   * 데이 트레이딩 전략 알림
   */
  async sendDayTradingStrategyAlert(
    symbol: string,
    timeframe: string,
    signal: string,
    confidence: number,
    indicators: any,
    timestamp: Date = new Date(),
  ): Promise<void> {
    const name = this.getDisplayName(symbol);

    let emoji = '📊';
    let signalText = '관망';
    let signalColor = '⚪';

    if (signal === 'BUY' || signal === 'STRONG_BUY') {
      emoji = '🚀';
      signalText = '데이 트레이딩 매수';
      signalColor = '🟢';
    } else if (signal === 'SELL' || signal === 'STRONG_SELL') {
      emoji = '📉';
      signalText = '데이 트레이딩 매도';
      signalColor = '🔴';
    }

    const message =
      `${emoji} <b>${name}(${symbol}) 데이 트레이딩 기회!</b>\n\n` +
      `📊 시간대: 15분봉 (당일매매)\n` +
      `${signalColor} 신호: <b>${signalText}</b>\n` +
      `🎯 신뢰도: <b>${confidence}%</b>\n` +
      `📈 SMA10: ${indicators.sma10 ? indicators.sma10.toLocaleString() : 'N/A'}\n` +
      `�  SMA20: ${indicators.sma20 ? indicators.sma20.toLocaleString() : 'N/A'}\n` +
      `� RS저I: ${indicators.rsi || 'N/A'}\n` +
      `� MACD단: ${indicators.macdLine > indicators.macdSignal ? '🟢 긍정적' : '🔴 부정적'}\n` +
      `📊 볼린저 %B: ${indicators.bbPercentB ? (indicators.bbPercentB * 100).toFixed(1) + '%' : 'N/A'}\n` +
      `� 신거래량 비율: ${indicators.volumeRatio ? indicators.volumeRatio.toFixed(2) + '배' : 'N/A'}\n\n` +
      `💡 전략: 15분봉 기반 당일 매매로 몇 시간 내 진입/청산을 목표로 합니다.\n` +
      `📅 보유기간: 몇 시간 (당일 청산)\n` +
      `🎯 목표수익: 1.5-3%\n` +
      `⚠️ 주의: 손절매를 반드시 설정하고 당일 내 청산하세요.\n\n` +
      `🕒 신호 시점: ${this.formatTimeWithKST(timestamp)}`;

    await this.sendBasic(symbol, message);
  }

  /**
   * 스윙 트레이딩 전략 알림
   */
  async sendSwingTradingAlert(
    symbol: string,
    timeframe: string,
    signal: string,
    confidence: number,
    indicators: any,
    timestamp: Date = new Date(),
  ): Promise<void> {
    const name = this.getDisplayName(symbol);

    let emoji = '🌊';
    let signalText = '관망';
    let signalColor = '⚪';

    if (signal === 'BUY' || signal === 'STRONG_BUY') {
      emoji = '📈';
      signalText = '스윙 매수';
      signalColor = '🟢';
    } else if (signal === 'SELL' || signal === 'STRONG_SELL') {
      emoji = '📉';
      signalText = '스윙 매도';
      signalColor = '🔴';
    }

    const message =
      `${emoji} <b>${name}(${symbol}) 스윙 트레이딩 신호!</b>\n\n` +
      `📊 시간대: 1시간봉 (중기매매)\n` +
      `${signalColor} 신호: <b>${signalText}</b>\n` +
      `🎯 신뢰도: <b>${confidence}%</b>\n` +
      `📈 SMA20: ${indicators.sma20 || 'N/A'}\n` +
      `📈 SMA50: ${indicators.sma50 || 'N/A'}\n` +
      `📊 RSI: ${indicators.rsi || 'N/A'}\n` +
      `📊 MACD: ${indicators.macdGolden ? '🟢 골든크로스' : '🔴 데드크로스'}\n\n` +
      `💡 전략: 중기 트렌드를 활용한 스윙 매매 기회입니다.\n` +
      `📅 보유기간: 수일~수주 예상\n\n` +
      `🕒 신호 시점: ${this.formatTimeWithKST(timestamp)}`;

    await this.sendBasic(symbol, message);
  }

  /**
   * 포지션 트레이딩 전략 알림
   */
  async sendPositionTradingAlert(
    symbol: string,
    timeframe: string,
    signal: string,
    confidence: number,
    indicators: any,
    timestamp: Date = new Date(),
  ): Promise<void> {
    const name = this.getDisplayName(symbol);

    let emoji = '🏛️';
    let signalText = '관망';
    let signalColor = '⚪';

    if (signal === 'BUY' || signal === 'STRONG_BUY') {
      emoji = '📈';
      signalText = '장기 매수';
      signalColor = '🟢';
    } else if (signal === 'SELL' || signal === 'STRONG_SELL') {
      emoji = '📉';
      signalText = '장기 매도';
      signalColor = '🔴';
    }

    const message =
      `${emoji} <b>${name}(${symbol}) 포지션 트레이딩 신호!</b>\n\n` +
      `📊 시간대: 일봉 (장기투자)\n` +
      `${signalColor} 신호: <b>${signalText}</b>\n` +
      `🎯 신뢰도: <b>${confidence}%</b>\n` +
      `📈 SMA50: ${indicators.sma50 || 'N/A'}\n` +
      `📈 SMA200: ${indicators.sma200 || 'N/A'}\n` +
      `📊 RSI: ${indicators.rsi || 'N/A'}\n` +
      `📊 골든크로스: ${indicators.isGoldenCross ? '🟢 발생' : '🔴 미발생'}\n\n` +
      `💡 전략: 장기 트렌드를 활용한 포지션 투자 기회입니다.\n` +
      `📅 보유기간: 수주~수개월 예상\n\n` +
      `🕒 신호 시점: ${this.formatTimeWithKST(timestamp)}`;

    await this.sendBasic(symbol, message);
  }

  /**
   * 평균 회귀 전략 알림
   */
  async sendMeanReversionAlert(
    symbol: string,
    timeframe: string,
    signal: string,
    confidence: number,
    indicators: any,
    timestamp: Date = new Date(),
  ): Promise<void> {
    const name = this.getDisplayName(symbol);

    let emoji = '🔄';
    let signalText = '관망';
    let signalColor = '⚪';

    if (signal === 'BUY' || signal === 'STRONG_BUY') {
      emoji = '🔄';
      signalText = '평균 회귀 매수';
      signalColor = '🟢';
    } else if (signal === 'SELL' || signal === 'STRONG_SELL') {
      emoji = '🔄';
      signalText = '평균 회귀 매도';
      signalColor = '🔴';
    }

    const message =
      `${emoji} <b>${name}(${symbol}) 평균 회귀 신호!</b>\n\n` +
      `📊 시간대: ${timeframe}\n` +
      `${signalColor} 신호: <b>${signalText}</b>\n` +
      `🎯 신뢰도: <b>${confidence}%</b>\n` +
      `📈 현재가 vs 평균: ${indicators.priceVsAverage || 'N/A'}\n` +
      `📊 RSI: ${indicators.rsi || 'N/A'}\n` +
      `📊 볼린저 위치: ${indicators.bollingerPosition || 'N/A'}\n\n` +
      `💡 전략: 과매수/과매도 구간에서 평균으로의 회귀를 노리는 전략입니다.\n` +
      `⚠️ 주의: 강한 트렌드 시장에서는 주의가 필요합니다.\n\n` +
      `🕒 신호 시점: ${this.formatTimeWithKST(timestamp)}`;

    await this.sendBasic(symbol, message);
  }

  /**
   * 고급/실전 전략 종합 알림
   */
  async sendAdvancedStrategyAlert(
    symbol: string,
    strategyType: string,
    signal: string,
    confidence: number,
    details: any,
    timestamp: Date = new Date(),
  ): Promise<void> {
    const name = this.getDisplayName(symbol);

    // 전략별 이모지와 이름 매핑
    const strategyInfo: Record<string, { emoji: string; name: string }> = {
      SMART_MONEY_FLOW: { emoji: '💰', name: '스마트 머니 플로우' },
      MULTI_TIMEFRAME_TREND: { emoji: '📊', name: '다중 시간봉 트렌드' },
      PATTERN_RECOGNITION: { emoji: '🔍', name: '패턴 인식' },
      ELLIOTT_WAVE: { emoji: '🌊', name: '엘리어트 파동' },
      AI_PREDICTION: { emoji: '🤖', name: 'AI 예측' },
      DAY_TRADING_STRATEGY: { emoji: '📊', name: '데이 트레이딩' },
      SWING_TRADING: { emoji: '🌊', name: '스윙 트레이딩' },
      POSITION_TRADING: { emoji: '🏛️', name: '포지션 트레이딩' },
      MEAN_REVERSION: { emoji: '🔄', name: '평균 회귀' },
    };

    const info = strategyInfo[strategyType] || {
      emoji: '📊',
      name: strategyType,
    };

    let signalColor = '⚪';
    let signalText = '중립';

    if (signal === 'BUY' || signal === 'STRONG_BUY') {
      signalColor = '🟢';
      signalText = '매수';
    } else if (signal === 'SELL' || signal === 'STRONG_SELL') {
      signalColor = '🔴';
      signalText = '매도';
    }

    // 신뢰도에 따른 강도 표시
    let confidenceEmoji = '🟡';
    if (confidence >= 80) confidenceEmoji = '🟢';
    else if (confidence < 60) confidenceEmoji = '🔴';

    const message =
      `${info.emoji} <b>${name}(${symbol}) ${info.name} 신호!</b>\n\n` +
      `${signalColor} 신호: <b>${signalText}</b>\n` +
      `${confidenceEmoji} 신뢰도: <b>${confidence}%</b>\n` +
      `📊 전략: ${info.name}\n` +
      `🎯 근거: ${details.reasoning || '기술적 분석 결과'}\n\n` +
      `💡 이 신호는 고급 분석 알고리즘을 통해 생성되었습니다.\n\n` +
      `🕒 신호 시점: ${this.formatTimeWithKST(timestamp)}`;

    await this.sendBasic(symbol, message);
  }
}
