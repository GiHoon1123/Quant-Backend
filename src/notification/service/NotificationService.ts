import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { AnalysisCompletedEvent } from '../../common/dto/event/AnalysisCompletedEvent';
import { IndividualSignalEvent } from '../../common/dto/event/IndividualSignalEvent';
import notificationConfig from '../../config/notification.config';
import {
  MARKET_DATA_EVENTS,
  TechnicalAnalysisCompletedEvent,
} from '../../market-data/types/MarketDataEvents';
import { TelegramClient } from '../infra/client/TelegramClient';
import {
  NotificationChannel,
  NotificationMessage,
  NotificationPriority,
  NotificationSettings,
  NotificationStatus,
  NotificationType,
} from '../types/NotificationTypes';

/**
 * 📢 통합 알림 서비스
 *
 * 🎯 **핵심 책임**: 다양한 채널을 통한 알림 발송 관리
 * - technical-analysis 도메인의 analysis.completed 이벤트 수신
 * - 채널별 알림 발송 (텔레그램, 웹소켓, 카카오톡 등)
 * - 알림 우선순위 및 필터링 관리
 * - 발송 상태 추적 및 에러 처리
 *
 * 🔄 **이벤트 플로우**:
 * analysis.completed 수신 → 채널 선택 → 알림 발송 → 상태 추적
 *
 * 📡 **수신 이벤트**:
 * - analysis.completed: 기술적 분석 완료 시
 *
 * 📢 **지원 채널**:
 * - 텔레그램 (현재 구현됨)
 * - 웹소켓 (추후 구현)
 * - 카카오톡 (추후 구현)
 */
@Injectable()
export class NotificationService implements OnModuleInit {
  private readonly logger = new Logger(NotificationService.name);
  private readonly eventEmitter2: EventEmitter2;
  private readonly eventEmitter: EventEmitter;
  private readonly messageQueue: NotificationMessage[] = [];
  private readonly sentMessages = new Map<string, NotificationMessage>();

  // 알림 설정을 config에서 주입
  private readonly settings: NotificationSettings;

  constructor(
    private readonly telegramService: TelegramClient,
    private readonly configService: ConfigService,
    eventEmitter2?: EventEmitter2,
  ) {
    this.eventEmitter = new EventEmitter();
    this.eventEmitter2 = eventEmitter2 || new EventEmitter2();
    this.logger.log('📢 [NotificationService] 통합 알림 서비스 초기화');
    // 환경설정 적용 (telegram만 config 기반, 나머지는 기존 default)
    this.settings = {
      channels: {
        [NotificationChannel.TELEGRAM]: {
          enabled: this.configService.get<boolean>(
            'notification.telegram.enabled',
            notificationConfig.telegram.enabled,
          ),
          priority: notificationConfig.telegram.priority,
          types: notificationConfig.telegram.types,
        },
        [NotificationChannel.WEBSOCKET]: {
          enabled: false,
          priority: [NotificationPriority.CRITICAL, NotificationPriority.HIGH],
          types: [
            NotificationType.ANALYSIS_RESULT,
            NotificationType.PRICE_ALERT,
          ],
        },
        [NotificationChannel.KAKAO]: {
          enabled: false,
          priority: [NotificationPriority.CRITICAL],
          types: [NotificationType.ANALYSIS_RESULT],
        },
        [NotificationChannel.EMAIL]: {
          enabled: false,
          priority: [NotificationPriority.MEDIUM, NotificationPriority.LOW],
          types: [NotificationType.NEWS_ALERT, NotificationType.SYSTEM_ALERT],
        },
        [NotificationChannel.DISCORD]: {
          enabled: false,
          priority: [NotificationPriority.HIGH, NotificationPriority.MEDIUM],
          types: [
            NotificationType.ANALYSIS_RESULT,
            NotificationType.BREAKOUT_ALERT,
          ],
        },
      },
      globalSettings: {
        rateLimiting: notificationConfig.rateLimiting,
        quietHours: notificationConfig.quietHours,
      },
    };
  }

  /**
   * 모듈 초기화 시 이벤트 핸들러 설정
   */
  async onModuleInit(): Promise<void> {
    // Technical-analysis 도메인의 EventEmitter와 연결은
    // AppModule에서 처리됩니다.
    this.logger.log('📢 [NotificationService] 이벤트 핸들러 준비 완료');
  }

  /**
   * 📡 Technical-analysis 도메인의 EventEmitter 연결
   *
   * AppModule에서 의존성 주입 후 호출됩니다.
   *
   * @param technicalAnalysisEventEmitter Technical-analysis 도메인의 EventEmitter
   */
  connectToTechnicalAnalysisEvents(
    technicalAnalysisEventEmitter: EventEmitter,
  ): void {
    // 기술적 분석 완료 이벤트 구독
    technicalAnalysisEventEmitter.on(
      MARKET_DATA_EVENTS.TECHNICAL_ANALYSIS_COMPLETED,
      this.handleAnalysisCompleted.bind(this),
    );

    // 연결 확인을 위한 테스트 이벤트도 구독
    technicalAnalysisEventEmitter.on(
      'analysis.completed',
      this.handleAnalysisCompleted.bind(this),
    );

    // 🎯 개별 전략 신호 이벤트 구독
    technicalAnalysisEventEmitter.on(
      'individual.signal',
      this.handleIndividualSignal.bind(this),
    );

    this.logger.log(
      '🔗 [NotificationService] Technical-analysis 이벤트 연결 완료',
    );
    this.logger.log(
      `📡 [NotificationService] 구독 중인 이벤트: ${MARKET_DATA_EVENTS.TECHNICAL_ANALYSIS_COMPLETED}, analysis.completed, individual.signal`,
    );
  }

  /**
   * 🎯 개별 전략 신호 이벤트 처리
   *
   * 각 전략이 임계값을 돌파할 때마다 개별 알림을 발송합니다.
   *
   * @param event 개별 신호 이벤트
   */
  private async handleIndividualSignal(event: any): Promise<void> {
    try {
      const { signalType, symbol, timeframe, confidence } = event;

      this.logger.log(
        `🎯 [IndividualSignal] 개별 신호 수신: ${signalType} - ${symbol} (신뢰도: ${confidence}%)`,
      );

      // 신뢰도가 너무 낮으면 알림 발송하지 않음
      if (confidence < 60) {
        this.logger.log(
          `🎯 [IndividualSignal] 신뢰도 부족으로 알림 스킵: ${signalType} - ${symbol} (${confidence}%)`,
        );
        return;
      }

      // 신호 타입별 개별 알림 발송
      await this.sendIndividualSignalNotification(signalType, event);

      // 명시적 DTO 객체 생성 및 emit
      const individualSignalEvent: IndividualSignalEvent = {
        eventId: uuidv4(),
        symbol,
        signalType,
        confidence,
        timeframe,
        currentPrice: event.currentPrice,
        service: 'NotificationService',
        timestamp: new Date(),
      };
      this.eventEmitter2.emit(
        'notification.individual.signal',
        individualSignalEvent,
      );
    } catch (error) {
      this.logger.error('❌ [IndividualSignal] 개별 신호 처리 실패:', error);
    }
  }

  /**
   * 📤 개별 신호별 알림 발송
   *
   * @param signalType 신호 타입
   * @param event 이벤트 데이터
   */
  private async sendIndividualSignalNotification(
    signalType: string,
    event: any,
  ): Promise<void> {
    try {
      const { symbol, timeframe, confidence, currentPrice } = event;

      switch (signalType) {
        case 'rsi_overbought':
        case 'rsi_oversold':
        case 'rsi_bullish_50':
        case 'rsi_bearish_50':
          await this.telegramService.sendRSIThresholdAlert(
            symbol,
            timeframe,
            event.currentRSI,
            event.signalType,
            confidence,
          );
          break;

        case 'ma_breakout_up':
        case 'ma_breakout_down':
          await this.telegramService.sendMABreakoutIndividualAlert(
            symbol,
            timeframe,
            event.maPeriod,
            event.currentPrice,
            event.maValue,
            event.signalType,
            confidence,
          );
          break;

        case 'macd_golden_cross':
        case 'macd_dead_cross':
          await this.telegramService.sendMACDSignalAlert(
            symbol,
            timeframe,
            event.macdLine,
            event.signalLine,
            event.histogram,
            event.signalType,
            confidence,
          );
          break;

        case 'bollinger_upper':
        case 'bollinger_lower':
          await this.telegramService.sendBollingerIndividualAlert(
            symbol,
            timeframe,
            event.currentPrice,
            event.upperBand,
            event.lowerBand,
            event.middleBand,
            event.signalType,
            confidence,
          );
          break;

        case 'volume_surge':
        case 'volume_dry_up':
          await this.telegramService.sendVolumeSpikeAlert(
            symbol,
            timeframe,
            event.currentVolume,
            event.avgVolume,
            event.volumeRatio,
            event.signalType,
            confidence,
          );
          break;

        default:
          this.logger.warn(
            `⚠️ [IndividualSignal] 알 수 없는 신호 타입: ${signalType}`,
          );
          break;
      }

      this.logger.log(
        `✅ [IndividualSignal] 개별 알림 발송 완료: ${signalType} - ${symbol}`,
      );
    } catch (error) {
      this.logger.error(
        `❌ [IndividualSignal] 개별 알림 발송 실패: ${signalType}`,
        error,
      );
    }
  }

  /**
   * 📊 기술적 분석 완료 이벤트 처리
   *
   * @param event 기술적 분석 완료 이벤트
   */
  private async handleAnalysisCompleted(
    event: TechnicalAnalysisCompletedEvent | any,
  ): Promise<void> {
    try {
      this.logger.log(`📢 [NotificationService] 이벤트 수신됨:`, {
        type: event.type || 'unknown',
        symbol: event.symbol,
        signal: event.analysisResult?.signal || event.signal,
        confidence: event.analysisResult?.confidence || event.confidence,
      });

      // 이벤트 구조가 다를 수 있으므로 유연하게 처리
      const symbol = event.symbol;
      const analysisResult = event.analysisResult || {
        signal: event.signal || 'UNKNOWN',
        confidence: event.confidence || 50,
        indicators: event.indicators || {},
      };

      // HOLD 신호는 알림 발송하지 않음 (스팸 방지)
      if (analysisResult.signal === 'HOLD') {
        this.logger.log(
          `📢 [NotificationService] HOLD 신호 - 알림 스킵: ${symbol}`,
        );
        return;
      }

      this.logger.log(
        `📢 [Notification] 분석 완료 이벤트 수신: ${symbol} - ${analysisResult.signal} (신뢰도: ${analysisResult.confidence}%)`,
      );

      // 📬 기본 분석 알림 메시지 생성
      const notification = this.createAnalysisNotification({
        symbol,
        analysisResult,
        analyzedAt: event.analyzedAt || new Date(),
      });

      // 📤 기본 분석 알림 발송
      await this.sendNotification(notification);

      // 🚀 고급 전략 알림 처리
      if (event.advancedStrategies && event.advancedStrategies.length > 0) {
        await this.handleAdvancedStrategiesNotification(
          symbol,
          event.advancedStrategies,
        );
      }

      // 💼 실전 전략 알림 처리
      if (event.practicalStrategies && event.practicalStrategies.length > 0) {
        await this.handlePracticalStrategiesNotification(
          symbol,
          event.practicalStrategies,
        );
      }

      this.eventEmitter2.emit('notification.analysis.completed', {
        eventId: uuidv4(),
        symbol,
        signal: analysisResult.signal,
        confidence: analysisResult.confidence,
        analyzedAt: event.analyzedAt || new Date(),
        service: 'NotificationService',
        timestamp: new Date(),
      } as AnalysisCompletedEvent);
    } catch (error) {
      this.logger.error('❌ [Notification] 분석 완료 이벤트 처리 실패:', error);
    }
  }

  /**
   * 🚀 고급 전략 알림 처리
   */
  private async handleAdvancedStrategiesNotification(
    symbol: string,
    advancedStrategies: any[],
  ): Promise<void> {
    try {
      this.logger.log(
        `🚀 [AdvancedStrategies] 고급 전략 알림 처리 시작: ${symbol} (${advancedStrategies.length}개)`,
      );

      for (const strategy of advancedStrategies) {
        // 높은 신뢰도의 신호만 알림 발송 (스팸 방지)
        if (strategy.confidence < 70 || strategy.signal === 'NEUTRAL') {
          continue;
        }

        const timestamp = new Date(strategy.timestamp || Date.now());

        switch (strategy.type) {
          case 'SMART_MONEY_FLOW':
            await this.telegramService.sendSmartMoneyFlowAlert(
              symbol,
              strategy.timeframe || '15m',
              strategy.signal,
              strategy.confidence,
              strategy.indicators || {},
              timestamp,
            );
            break;

          case 'MULTI_TIMEFRAME_TREND':
            await this.telegramService.sendMultiTimeframeTrendAlert(
              symbol,
              strategy.signal,
              strategy.confidence,
              strategy.details?.trendAnalysis || [],
              timestamp,
            );
            break;

          case 'PATTERN_RECOGNITION':
            await this.telegramService.sendPatternRecognitionAlert(
              symbol,
              strategy.timeframe || '15m',
              strategy.signal,
              strategy.confidence,
              strategy.details?.patterns || {},
              timestamp,
            );
            break;

          default:
            // 기타 고급 전략들은 종합 알림으로 처리
            await this.telegramService.sendAdvancedStrategyAlert(
              symbol,
              strategy.type || strategy.strategy,
              strategy.signal,
              strategy.confidence,
              strategy.details || { reasoning: strategy.reasoning },
              timestamp,
            );
            break;
        }

        this.logger.log(
          `✅ [AdvancedStrategy] ${strategy.type} 알림 발송 완료: ${symbol}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `❌ [AdvancedStrategies] 고급 전략 알림 처리 실패: ${symbol}`,
        error,
      );
    }
  }

  /**
   * 💼 실전 전략 알림 처리
   */
  private async handlePracticalStrategiesNotification(
    symbol: string,
    practicalStrategies: any[],
  ): Promise<void> {
    try {
      this.logger.log(
        `💼 [PracticalStrategies] 실전 전략 알림 처리 시작: ${symbol} (${practicalStrategies.length}개)`,
      );

      for (const strategy of practicalStrategies) {
        // 높은 신뢰도의 신호만 알림 발송 (스팸 방지)
        if (strategy.confidence < 70 || strategy.signal === 'NEUTRAL') {
          continue;
        }

        const timestamp = new Date(strategy.timestamp || Date.now());

        switch (strategy.type) {
          case 'DAY_TRADING_STRATEGY':
            await this.telegramService.sendDayTradingStrategyAlert(
              symbol,
              strategy.timeframe || '15m',
              strategy.signal,
              strategy.confidence,
              strategy.indicators || {},
              timestamp,
            );
            break;

          case 'SWING_TRADING':
            await this.telegramService.sendSwingTradingAlert(
              symbol,
              strategy.timeframe || '1h',
              strategy.signal,
              strategy.confidence,
              strategy.indicators || {},
              timestamp,
            );
            break;

          case 'POSITION_TRADING':
            await this.telegramService.sendPositionTradingAlert(
              symbol,
              strategy.timeframe || '1d',
              strategy.signal,
              strategy.confidence,
              strategy.indicators || {},
              timestamp,
            );
            break;

          case 'MEAN_REVERSION':
            await this.telegramService.sendMeanReversionAlert(
              symbol,
              strategy.timeframe || '1h',
              strategy.signal,
              strategy.confidence,
              strategy.indicators || {},
              timestamp,
            );
            break;

          default:
            // 기타 실전 전략들은 종합 알림으로 처리
            await this.telegramService.sendAdvancedStrategyAlert(
              symbol,
              strategy.type || strategy.strategy,
              strategy.signal,
              strategy.confidence,
              strategy.details || { reasoning: strategy.reasoning },
              timestamp,
            );
            break;
        }

        this.logger.log(
          `✅ [PracticalStrategy] ${strategy.type} 알림 발송 완료: ${symbol}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `❌ [PracticalStrategies] 실전 전략 알림 처리 실패: ${symbol}`,
        error,
      );
    }
  }

  /**
   * 📬 기술적 분석 결과 알림 메시지 생성
   *
   * @param data 분석 결과 데이터
   * @returns 알림 메시지
   */
  private createAnalysisNotification(data: {
    symbol: string;
    analysisResult: {
      signal: string;
      confidence: number;
      indicators?: any;
    };
    analyzedAt: Date;
  }): NotificationMessage {
    const { symbol, analysisResult, analyzedAt } = data;

    // 신호에 따른 우선순위 결정
    let priority = NotificationPriority.MEDIUM;
    if (analysisResult.confidence >= 80) {
      priority = NotificationPriority.HIGH;
    }
    if (analysisResult.confidence >= 90) {
      priority = NotificationPriority.CRITICAL;
    }

    // 제목 생성
    const title = `${symbol} ${analysisResult.signal} 신호 (${analysisResult.confidence}%)`;

    // 메시지 본문 생성
    const message = this.formatAnalysisMessage(symbol, analysisResult);

    return {
      id: uuidv4(),
      type: NotificationType.ANALYSIS_RESULT,
      channel: NotificationChannel.TELEGRAM, // 기본 채널
      priority,
      title,
      message,
      symbol,
      data: {
        analysisResult,
        analyzedAt,
      },
      createdAt: new Date(),
      status: NotificationStatus.PENDING,
    };
  }

  /**
   * 📝 기술적 분석 결과 메시지 포맷팅
   *
   * @param symbol 심볼
   * @param analysisResult 분석 결과
   * @returns 포맷된 메시지
   */
  private formatAnalysisMessage(symbol: string, analysisResult: any): string {
    const { signal, confidence, indicators, timestamp } = analysisResult;
    let emoji = '📊';
    if (signal === 'BUY' || signal === 'STRONG_BUY') emoji = '📈';
    if (signal === 'SELL' || signal === 'STRONG_SELL') emoji = '📉';

    // 분석 시점 UTC/KST 변환 개선
    let timeStr = '';
    if (timestamp) {
      const dateObj =
        typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
      // UTC/KST 변환
      const utcStr =
        dateObj.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
      const kstDate = new Date(dateObj.getTime() + 9 * 60 * 60 * 1000);
      const kstStr =
        kstDate.toISOString().replace('T', ' ').substring(11, 19) + ' KST';
      timeStr = `${utcStr} (${kstStr})`;
    } else {
      const now = new Date();
      const utcStr =
        now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
      const kstDate = new Date(now.getTime() + 9 * 60 * 60 * 1000);
      const kstStr =
        kstDate.toISOString().replace('T', ' ').substring(11, 19) + ' KST';
      timeStr = `${utcStr} (${kstStr})`;
    }

    return [
      `${emoji} **${symbol} 기술적 분석 완료**`,
      '',
      `🎯 **신호**: ${signal}`,
      `📊 **신뢰도**: ${confidence}%`,
      '',
      '📈 **주요 지표**:',
      indicators ? this.formatIndicators(indicators) : '• 분석 중...',
      '',
      `🕒 **분석 시점**: ${timeStr}`,
    ].join('\n');
  }

  /**
   * 📊 지표 정보 포맷팅
   *
   * @param indicators 지표 데이터
   * @returns 포맷된 지표 문자열
   */
  private formatIndicators(indicators: Record<string, any>): string {
    const lines: string[] = [];

    // 기본 지표들 표시
    if (indicators.sma) {
      lines.push(`• SMA: ${indicators.sma}`);
    }
    if (indicators.rsi) {
      lines.push(`• RSI: ${indicators.rsi}`);
    }
    if (indicators.macd) {
      lines.push(`• MACD: ${indicators.macd}`);
    }
    if (indicators.volume) {
      lines.push(`• 거래량: ${indicators.volume}`);
    }

    return lines.length > 0 ? lines.join('\n') : '• 데이터 수집 중...';
  }

  /**
   * 📤 알림 발송
   *
   * @param notification 알림 메시지
   */
  private async sendNotification(
    notification: NotificationMessage,
  ): Promise<void> {
    try {
      // 중복 메시지 방지: 심볼+분석시점+신호+신뢰도 기준으로 체크
      const uniqueKey = `${notification.symbol}-${notification.data?.analyzedAt?.toISOString?.() ?? ''}-${notification.data?.analysisResult?.signal ?? ''}-${notification.data?.analysisResult?.confidence ?? ''}`;
      if (this.sentMessages.has(uniqueKey)) {
        this.logger.warn(
          `🚫 [Notification] 중복 분석 결과 스킵: ${notification.title}`,
        );
        return;
      }
      notification.status = NotificationStatus.SENDING;

      // 채널별 발송 처리
      switch (notification.channel) {
        case NotificationChannel.TELEGRAM:
          await this.sendTelegramNotification(notification);
          break;

        case NotificationChannel.WEBSOCKET:
          await this.sendWebSocketNotification(notification);
          break;

        case NotificationChannel.KAKAO:
          await this.sendKakaoNotification(notification);
          break;

        default:
          throw new Error(`지원하지 않는 채널: ${notification.channel}`);
      }

      // 발송 완료 처리
      notification.status = NotificationStatus.SENT;
      notification.sentAt = new Date();
      this.sentMessages.set(uniqueKey, notification);

      this.logger.log(
        `✅ [Notification] 알림 발송 완료: ${notification.title}`,
      );
    } catch (error) {
      // 발송 실패 처리
      notification.status = NotificationStatus.FAILED;
      notification.error = error.message;

      this.logger.error(
        `❌ [Notification] 알림 발송 실패: ${notification.title}`,
        error,
      );
    }
  }

  /**
   * 📱 텔레그램 알림 발송
   *
   * @param notification 알림 메시지
   */
  private async sendTelegramNotification(
    notification: NotificationMessage,
  ): Promise<void> {
    const { symbol, data } = notification;

    this.logger.log(`📱 [Telegram] 알림 발송 시작: ${symbol}`, data);

    if (
      notification.type === NotificationType.ANALYSIS_RESULT &&
      data?.analysisResult
    ) {
      // 분석 결과 데이터 구조 정규화
      const analysisData = data.analysisResult;

      // TelegramClient가 기대하는 형식으로 변환
      const telegramData = {
        signal: analysisData.overallSignal || analysisData.signal || 'HOLD',
        indicators: {
          SMA5: analysisData.indicators?.SMA5 || 'N/A',
          SMA10: analysisData.indicators?.SMA10 || 'N/A',
          SMA20: analysisData.indicators?.SMA20 || 'N/A',
          RSI: analysisData.indicators?.RSI || 'N/A',
          MACD: analysisData.indicators?.MACD || 'N/A',
          Volume: analysisData.indicators?.Volume || 'N/A',
          AvgVolume: analysisData.indicators?.AvgVolume || 'N/A',
          VolumeRatio: analysisData.indicators?.VolumeRatio || 'N/A',
        },
        price: analysisData.currentPrice || analysisData.price || 0,
        timestamp: data.analyzedAt || new Date(),
      };

      this.logger.log(`📱 [Telegram] 정규화된 데이터:`, telegramData);

      // 기존 TelegramClient의 분석 결과 메서드 활용
      await this.telegramService.sendAnalysisResult(symbol!, telegramData);
    } else {
      // 일반 텍스트 메시지 발송
      await this.telegramService.sendTextMessage(notification.message);
    }

    this.logger.log(`✅ [Telegram] 알림 발송 완료: ${symbol}`);
  }

  /**
   * 🌐 웹소켓 알림 발송 (추후 구현)
   *
   * @param notification 알림 메시지
   */
  private async sendWebSocketNotification(
    notification: NotificationMessage,
  ): Promise<void> {
    // TODO: 웹소켓 서비스 구현 후 추가
    this.logger.log(
      '🌐 [WebSocket] 알림 발송 (추후 구현):',
      notification.title,
    );
  }

  /**
   * 💬 카카오톡 알림 발송 (추후 구현)
   *
   * @param notification 알림 메시지
   */
  private async sendKakaoNotification(
    notification: NotificationMessage,
  ): Promise<void> {
    // TODO: 카카오톡 서비스 구현 후 추가
    this.logger.log('💬 [Kakao] 알림 발송 (추후 구현):', notification.title);
  }

  /**
   * 📊 알림 통계 조회
   */
  getNotificationStats(): {
    totalSent: number;
    recentMessages: NotificationMessage[];
    channelStats: Record<string, number>;
  } {
    const messages = Array.from(this.sentMessages.values());
    const channelStats: Record<string, number> = {};

    // 채널별 통계
    for (const message of messages) {
      channelStats[message.channel] = (channelStats[message.channel] || 0) + 1;
    }

    return {
      totalSent: messages.length,
      recentMessages: messages.slice(-10), // 최근 10개
      channelStats,
    };
  }
}
