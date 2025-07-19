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
export class TelegramNotificationService {
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
    // UTC 시간 포맷팅
    const utcStr = utcTime.toISOString().slice(0, 19).replace('T', ' ');

    // 한국 시간 계산 (UTC + 9시간)
    const kstTime = new Date(utcTime.getTime() + 9 * 60 * 60 * 1000);
    const kstStr = kstTime.toTimeString().slice(0, 8);

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

    // 신호별 상세 의미 해설
    let signalMeaning = '';
    if (result.signal === 'BUY') {
      signalMeaning =
        '💡 <b>매수 신호</b>: 상승 모멘텀이 감지되어 매수 타이밍입니다. 기술적 지표들이 상승 추세를 지지하고 있습니다.';
    } else if (result.signal === 'SELL') {
      signalMeaning =
        '⚠️ <b>매도 신호</b>: 하락 위험이 감지되어 매도를 고려해야 합니다. 기술적 지표들이 조정 가능성을 시사하고 있습니다.';
    } else {
      signalMeaning =
        '📊 <b>중립 신호</b>: 현재 명확한 방향성이 없는 상태입니다. 추가적인 신호를 기다리거나 관망하는 것이 좋습니다.';
    }

    const message =
      `${emoji} <b>${name}(${symbol}) 기술적 분석 완료!</b>\n\n` +
      `📊 시간대: 15분봉\n` +
      `💵 현재가: ${formatPrice(result.price)}\n` +
      `${signalColor} 시그널: <b>${signalText}</b> ${getConfidenceEmoji(confidence)} (신뢰도: ${confidence}%)\n\n` +
      `📈 <b>이동평균선 분석</b>:\n` +
      `• SMA5 (단기): ${formatPrice(result.indicators.SMA5)}\n` +
      `• SMA10 (중기): ${formatPrice(result.indicators.SMA10)}\n` +
      `• SMA20 (장기): ${formatPrice(result.indicators.SMA20)}\n\n` +
      `📊 <b>거래량 분석</b>:\n` +
      `• 현재 거래량: ${formatVolume(result.indicators.Volume)}\n` +
      `• 평균 거래량: ${formatVolume(result.indicators.AvgVolume)}\n` +
      `• 거래량 비율: <b>${safeToFixed(result.indicators.VolumeRatio)}배</b>\n\n` +
      `${signalMeaning}\n\n` +
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
}
