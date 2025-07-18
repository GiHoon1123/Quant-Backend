import { Injectable } from '@nestjs/common';

/**
 * 텔레그램 알림 서비스
 *
 * 기술적 분석 결과를 텔레그램으로 전송하는 서비스입니다.
 * 캔들 완성 시 분석 결과에 따라 알림을 발송합니다.
 */
@Injectable()
export class TelegramNotificationService {
  private readonly botToken: string;
  private readonly chatId: string;

  constructor() {
    // 환경변수에서 텔레그램 설정 읽기
    this.botToken = process.env.TELEGRAM_BOT_TOKEN || '';
    this.chatId = process.env.TELEGRAM_CHAT_ID || '';

    if (!this.botToken || !this.chatId) {
      console.warn(
        '[TelegramNotificationService] 텔레그램 설정이 누락되었습니다. 알림이 비활성화됩니다.',
      );
    }
  }

  /**
   * 기술적 분석 결과 알림 발송
   *
   * @param symbol 심볼
   * @param analysisResult 분석 결과
   */
  async sendAnalysisResult(
    symbol: string,
    analysisResult: {
      signal: 'BUY' | 'SELL' | 'HOLD';
      indicators: Record<string, any>;
      price: number;
      timestamp: Date;
    },
  ): Promise<void> {
    if (!this.botToken || !this.chatId) {
      console.log(
        `[TelegramNotificationService] 텔레그램 설정 없음 - ${symbol} 분석 결과 스킵`,
      );
      return;
    }

    try {
      const message = this.formatAnalysisMessage(symbol, analysisResult);
      await this.sendMessage(message);

      console.log(
        `[TelegramNotificationService] ${symbol} 분석 결과 알림 전송 완료`,
      );
    } catch (error) {
      console.error(
        `[TelegramNotificationService] ${symbol} 알림 전송 실패:`,
        error,
      );
    }
  }

  /**
   * 시스템 상태 알림 발송
   *
   * @param message 상태 메시지
   */
  async sendSystemAlert(message: string): Promise<void> {
    if (!this.botToken || !this.chatId) {
      return;
    }

    try {
      const formattedMessage = `🤖 *시스템 알림*\n\n${message}\n\n⏰ ${new Date().toLocaleString('ko-KR')}`;
      await this.sendMessage(formattedMessage);

      console.log('[TelegramNotificationService] 시스템 알림 전송 완료');
    } catch (error) {
      console.error(
        '[TelegramNotificationService] 시스템 알림 전송 실패:',
        error,
      );
    }
  }

  /**
   * 분석 결과를 텔레그램 메시지 형태로 포맷
   */
  private formatAnalysisMessage(
    symbol: string,
    result: {
      signal: 'BUY' | 'SELL' | 'HOLD';
      indicators: Record<string, any>;
      price: number;
      timestamp: Date;
    },
  ): string {
    const signalEmoji = {
      BUY: '🟢',
      SELL: '🔴',
      HOLD: '🟡',
    };

    const emoji = signalEmoji[result.signal];

    let message = `${emoji} *${symbol}* - ${result.signal}\n\n`;
    message += `💰 현재가: $${result.price.toLocaleString()}\n`;
    message += `⏰ 시간: ${result.timestamp.toLocaleString('ko-KR')}\n\n`;

    // 기술적 지표 정보 추가
    if (result.indicators) {
      message += `📊 *기술적 지표*\n`;

      Object.entries(result.indicators).forEach(([key, value]) => {
        if (typeof value === 'number') {
          message += `• ${key}: ${value.toFixed(4)}\n`;
        } else {
          message += `• ${key}: ${value}\n`;
        }
      });
    }

    return message;
  }

  /**
   * 텔레그램 메시지 전송
   */
  private async sendMessage(message: string): Promise<void> {
    const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;

    const payload = {
      chat_id: this.chatId,
      text: message,
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`텔레그램 API 호출 실패: ${response.status} - ${error}`);
    }
  }

  /**
   * 연결 테스트
   */
  async testConnection(): Promise<boolean> {
    if (!this.botToken || !this.chatId) {
      return false;
    }

    try {
      await this.sendMessage('🧪 텔레그램 연결 테스트 성공!');
      return true;
    } catch (error) {
      console.error('[TelegramNotificationService] 연결 테스트 실패:', error);
      return false;
    }
  }
}
