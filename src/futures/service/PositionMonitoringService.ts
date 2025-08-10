import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BinanceWebSocketClient } from 'src/common/binance/BinanceWebSocketClient';
import {
  PositionClosedEvent,
  PositionOpenedEvent,
} from 'src/common/dto/event/PositionEvent';

/**
 * 선물 포지션 모니터링 서비스
 *
 * 선물 포지션이 진입되었을 때 해당 심볼에 대해 바이낸스 웹소켓 스트림을 동적으로 구독하고,
 * 포지션이 종료되었을 때 구독을 해제하는 책임을 갖는다.
 *
 * 설계 원칙
 * - 단일 책임: 15분봉 저장/분석 로직(Candle15MService)과 분리한다.
 * - 최소 침투: 기존 저장 구조를 변경하지 않고, 대응용으로만 저주기 스트림을 사용한다.
 * - 자원 효율: 심볼별 참조 카운트를 사용하여 중복 구독을 방지한다.
 * - 안전성: 포지션이 모두 종료된 심볼만 구독을 해제한다.
 */
@Injectable()
export class PositionMonitoringService implements OnModuleInit {
  /** 로거 인스턴스 */
  private readonly logger = new Logger(PositionMonitoringService.name);

  /**
   * 심볼별 구독 상태 맵
   * key: 심볼 (예: BTCUSDT)
   * value: 구독 상세 정보
   */
  private readonly subscriptions = new Map<
    string,
    {
      refCount: number;
      tickKey?: string;
      k1mKey?: string;
      k5mKey?: string;
      lastTickAt?: number;
    }
  >();

  constructor(
    /** 이벤트 버스 인스턴스. 선물 포지션 오픈/클로즈 이벤트를 수신하기 위해 사용한다. */
    private readonly eventEmitter: EventEmitter2,
    /** 바이낸스 웹소켓 클라이언트. tick/1m/5m 스트림 구독에 사용한다. */
    private readonly wsClient: BinanceWebSocketClient,
  ) {}

  /**
   * 모듈 초기화 훅
   *
   * 애플리케이션 시작 시 선물 포지션 관련 이벤트 리스너를 등록한다.
   */
  onModuleInit(): void {
    // 포지션 오픈 이벤트 구독: 해당 심볼에 대한 동적 스트림 구독 시작
    this.eventEmitter.on(
      'futures.position.opened',
      (event: PositionOpenedEvent) => {
        try {
          this.handlePositionOpened(event);
        } catch (error) {
          this.logger.error(
            `futures.position.opened 처리 중 오류: ${error?.message || error}`,
          );
        }
      },
    );

    // 포지션 클로즈 이벤트 구독: 해당 심볼에 대한 동적 스트림 구독 해제 시도
    this.eventEmitter.on(
      'futures.position.closed',
      (event: PositionClosedEvent) => {
        try {
          this.handlePositionClosed(event);
        } catch (error) {
          this.logger.error(
            `futures.position.closed 처리 중 오류: ${error?.message || error}`,
          );
        }
      },
    );

    this.logger.log('PositionMonitoringService 이벤트 리스너 등록 완료');
  }

  /**
   * 포지션 진입 이벤트 처리자
   *
   * 요구사항: 포지션 진입 시 해당 심볼에 대해 다음 스트림을 구독한다.
   * - 거래 틱 스트림: @trade
   * - 1분봉 스트림: @kline_1m
   * - 5분봉 스트림: @kline_5m
   */
  private handlePositionOpened(event: PositionOpenedEvent): void {
    const symbol = event.symbol;
    const state = this.subscriptions.get(symbol) || { refCount: 0 };

    // 이미 구독 중인 경우 참조 카운트만 증가시킨다.
    if (state.refCount > 0) {
      state.refCount += 1;
      this.subscriptions.set(symbol, state);
      this.logger.log(
        `이미 구독 중인 심볼 감지: ${symbol} (refCount=${state.refCount})`,
      );
      return;
    }

    // 신규 구독 설정
    const tickKey = this.wsClient.subscribeTrade(
      symbol,
      (data) => this.onTick(symbol, data),
      true,
    );
    const k1mKey = this.wsClient.subscribeKline(
      symbol,
      '1m',
      (data) => this.onKline(symbol, '1m', data),
      true,
    );
    const k5mKey = this.wsClient.subscribeKline(
      symbol,
      '5m',
      (data) => this.onKline(symbol, '5m', data),
      true,
    );

    this.subscriptions.set(symbol, {
      refCount: 1,
      tickKey,
      k1mKey,
      k5mKey,
      lastTickAt: 0,
    });

    this.logger.log(`동적 구독 시작: ${symbol} (tick/1m/5m)`);
  }

  /**
   * 포지션 종료 이벤트 처리자
   *
   * 요구사항: 해당 심볼에 대해 참조 카운트를 감소시키고, 0이 되면 모든 스트림 구독을 해제한다.
   */
  private handlePositionClosed(event: PositionClosedEvent): void {
    const symbol = event.symbol;
    const state = this.subscriptions.get(symbol);

    if (!state) {
      this.logger.warn(
        `구독 상태가 존재하지 않는 심볼의 클로즈 이벤트: ${symbol}`,
      );
      return;
    }

    // 참조 카운트 감소
    state.refCount = Math.max(0, state.refCount - 1);

    // 참조 카운트가 남아있으면 유지
    if (state.refCount > 0) {
      this.logger.log(`구독 유지: ${symbol} (refCount=${state.refCount})`);
      return;
    }

    // 모든 구독 해제
    if (state.tickKey) this.wsClient.unsubscribe(state.tickKey);
    if (state.k1mKey) this.wsClient.unsubscribe(state.k1mKey);
    if (state.k5mKey) this.wsClient.unsubscribe(state.k5mKey);

    this.subscriptions.delete(symbol);
    this.logger.log(`동적 구독 해제 완료: ${symbol} (tick/1m/5m)`);
  }

  /**
   * 거래 틱 스트림 콜백
   *
   * 바이낸스 trade 이벤트는 매우 고빈도로 발생한다. 불필요한 과부하를 방지하기 위해
   * 간단한 디바운싱을 적용하여 일정 주기 이내 반복 로그 또는 후속 처리를 억제한다.
   * 이 메서드에서는 저장을 수행하지 않으며, 대응 로직이 필요할 경우 이벤트 발행으로 연결하도록 한다.
   */
  private onTick(symbol: string, message: any): void {
    const state = this.subscriptions.get(symbol);
    if (!state) return;

    const now = Date.now();
    const throttleMs = 300; // 기본 스로틀 간격. 필요 시 설정값으로 분리 가능.
    if (state.lastTickAt && now - state.lastTickAt < throttleMs) {
      return;
    }

    state.lastTickAt = now;

    // 가격 추출: trade 이벤트는 보통 e='trade', p=price 를 포함한다.
    const price = this.extractTradePrice(message);
    if (price !== null) {
      this.logger.verbose(`tick 수신: ${symbol} price=${price}`);
      // 필요 시 여기서 position.monitor.update 같은 내부 이벤트를 발행할 수 있다.
    }
  }

  /**
   * 캔들스트림 콜백
   *
   * 1분봉과 5분봉 모두 동일한 처리 경로를 사용한다. 진행 중 캔들은 주기적으로 갱신되며,
   * kline.k.x === true 인 경우가 봉이 완성된 시점이다. 현재 구현에서는 저장을 하지 않으며,
   * 필요한 대응 로직이 있다면 이벤트 발행으로 연결하도록 한다.
   */
  private onKline(symbol: string, timeframe: '1m' | '5m', message: any): void {
    const k = message?.k ?? message?.data?.k;
    if (!k) return;

    const isCompleted = k.x === true;
    const close = Number(k.c);

    if (isCompleted) {
      this.logger.debug(`kline 완료: ${symbol} ${timeframe} close=${close}`);
      // 필요 시 여기서 candle.Xm.completed 스타일의 내부 이벤트를 발행할 수 있다.
    } else {
      // 진행 중 캔들 갱신. 과도한 로그를 피하기 위해 상세 로그는 verbose 수준으로 제한한다.
      this.logger.verbose(
        `kline 진행중: ${symbol} ${timeframe} close=${close}`,
      );
    }
  }

  /**
   * trade 메시지에서 가격을 안전하게 추출한다.
   *
   * 바이낸스의 웹소켓 메시지는 전달 경로에 따라 래핑 구조가 다를 수 있으므로
   * data, p, s 등의 필드를 방어적으로 확인한다.
   */
  private extractTradePrice(message: any): number | null {
    try {
      // 케이스 1: multiplex 형태 { stream, data } 구조
      const m = message?.data ?? message;
      const p = m?.p ?? m?.price;
      const price = p != null ? Number(p) : NaN;
      return Number.isFinite(price) ? price : null;
    } catch {
      return null;
    }
  }
}
