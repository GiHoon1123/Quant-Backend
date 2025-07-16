import * as WebSocket from 'ws';
import { EventEmitter } from 'events';

/**
 * 바이낸스 웹소켓 스트림 클라이언트 (공통 모듈)
 *
 * 바이낸스의 웹소켓 API를 사용하여 실시간 데이터를 수신하는 공통 클라이언트입니다.
 * 현물, 선물, 기술적 분석 등 모든 도메인에서 재사용할 수 있습니다.
 *
 * 🎯 주요 기능:
 * - 실시간 캔들스틱 데이터 스트림
 * - 실시간 거래 데이터 스트림
 * - 실시간 가격 티커 스트림
 * - 오더북 변화 스트림
 * - 자동 재연결 및 에러 처리
 *
 * 🚀 지원 스트림:
 * - @kline_1m, @kline_5m, @kline_1h 등 - 캔들스틱
 * - @trade - 개별 거래
 * - @ticker - 24시간 가격 통계
 * - @depth - 오더북 변화
 * - @miniTicker - 간소 가격 정보
 *
 * 💡 사용 예시:
 * ```typescript
 * const stream = new BinanceWebSocketClient();
 *
 * // 캔들스틱 스트림 구독
 * stream.subscribeKline('BTCUSDT', '1m', (data) => {
 *   console.log('새 캔들:', data);
 * });
 *
 * // 거래 스트림 구독
 * stream.subscribeTrade('BTCUSDT', (data) => {
 *   console.log('새 거래:', data);
 * });
 * ```
 */
export class BinanceWebSocketClient extends EventEmitter {
  private connections = new Map<string, WebSocket>();
  private subscriptions = new Map<string, Set<string>>();
  private reconnectAttempts = new Map<string, number>();

  private readonly SPOT_WS_URL = 'wss://stream.binance.com:9443/ws';
  private readonly FUTURES_WS_URL = 'wss://fstream.binance.com/ws';

  // 재연결 설정
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private readonly RECONNECT_INTERVAL = 5000; // 5초

  constructor() {
    super();
    this.setMaxListeners(100); // 많은 구독을 허용
  }

  /**
   * 캔들스틱 스트림 구독
   *
   * @param symbol 심볼 (예: BTCUSDT)
   * @param interval 시간간격 (1m, 5m, 15m, 1h, 4h, 1d 등)
   * @param callback 데이터 수신 콜백
   * @param isFutures 선물 거래 여부 (기본값: false)
   * @returns 구독 키
   */
  subscribeKline(
    symbol: string,
    interval: string,
    callback: (data: any) => void,
    isFutures: boolean = false,
  ): string {
    const streamName = `${symbol.toLowerCase()}@kline_${interval}`;
    const connectionKey = isFutures ? 'futures' : 'spot';

    console.log(
      `📊 캔들스틱 스트림 구독: ${symbol} ${interval} (${isFutures ? '선물' : '현물'})`,
    );

    this.subscribe(connectionKey, streamName, callback, isFutures);

    return `${connectionKey}_${streamName}`;
  }

  /**
   * 거래 스트림 구독
   *
   * @param symbol 심볼
   * @param callback 데이터 수신 콜백
   * @param isFutures 선물 거래 여부
   * @returns 구독 키
   */
  subscribeTrade(
    symbol: string,
    callback: (data: any) => void,
    isFutures: boolean = false,
  ): string {
    const streamName = `${symbol.toLowerCase()}@trade`;
    const connectionKey = isFutures ? 'futures' : 'spot';

    console.log(
      `💹 거래 스트림 구독: ${symbol} (${isFutures ? '선물' : '현물'})`,
    );

    this.subscribe(connectionKey, streamName, callback, isFutures);

    return `${connectionKey}_${streamName}`;
  }

  /**
   * 가격 티커 스트림 구독
   *
   * @param symbol 심볼
   * @param callback 데이터 수신 콜백
   * @param isFutures 선물 거래 여부
   * @returns 구독 키
   */
  subscribeTicker(
    symbol: string,
    callback: (data: any) => void,
    isFutures: boolean = false,
  ): string {
    const streamName = `${symbol.toLowerCase()}@ticker`;
    const connectionKey = isFutures ? 'futures' : 'spot';

    console.log(
      `📈 티커 스트림 구독: ${symbol} (${isFutures ? '선물' : '현물'})`,
    );

    this.subscribe(connectionKey, streamName, callback, isFutures);

    return `${connectionKey}_${streamName}`;
  }

  /**
   * 미니 티커 스트림 구독 (경량화된 가격 정보)
   *
   * @param symbol 심볼
   * @param callback 데이터 수신 콜백
   * @param isFutures 선물 거래 여부
   * @returns 구독 키
   */
  subscribeMiniTicker(
    symbol: string,
    callback: (data: any) => void,
    isFutures: boolean = false,
  ): string {
    const streamName = `${symbol.toLowerCase()}@miniTicker`;
    const connectionKey = isFutures ? 'futures' : 'spot';

    console.log(
      `📊 미니 티커 스트림 구독: ${symbol} (${isFutures ? '선물' : '현물'})`,
    );

    this.subscribe(connectionKey, streamName, callback, isFutures);

    return `${connectionKey}_${streamName}`;
  }

  /**
   * 오더북 스트림 구독
   *
   * @param symbol 심볼
   * @param speed 업데이트 속도 ('100ms' 또는 '1000ms')
   * @param callback 데이터 수신 콜백
   * @param isFutures 선물 거래 여부
   * @returns 구독 키
   */
  subscribeDepth(
    symbol: string,
    speed: '100ms' | '1000ms',
    callback: (data: any) => void,
    isFutures: boolean = false,
  ): string {
    const streamName = `${symbol.toLowerCase()}@depth@${speed}`;
    const connectionKey = isFutures ? 'futures' : 'spot';

    console.log(
      `📋 오더북 스트림 구독: ${symbol} ${speed} (${isFutures ? '선물' : '현물'})`,
    );

    this.subscribe(connectionKey, streamName, callback, isFutures);

    return `${connectionKey}_${streamName}`;
  }

  /**
   * 다중 심볼 캔들스틱 스트림 구독
   *
   * @param symbols 심볼 배열
   * @param interval 시간간격
   * @param callback 데이터 수신 콜백
   * @param isFutures 선물 거래 여부
   * @returns 구독 키 배열
   */
  subscribeMultipleKlines(
    symbols: string[],
    interval: string,
    callback: (data: any) => void,
    isFutures: boolean = false,
  ): string[] {
    console.log(
      `📊 다중 캔들스틱 스트림 구독: ${symbols.length}개 심볼 ${interval}`,
    );

    return symbols.map((symbol) =>
      this.subscribeKline(symbol, interval, callback, isFutures),
    );
  }

  /**
   * 구독 해제
   *
   * @param subscriptionKey 구독 키
   */
  unsubscribe(subscriptionKey: string): void {
    const [connectionKey, streamName] = subscriptionKey.split('_', 2);

    console.log(`❌ 스트림 구독 해제: ${streamName}`);

    const subscriptionsSet = this.subscriptions.get(connectionKey);
    if (subscriptionsSet) {
      subscriptionsSet.delete(streamName);

      // 더 이상 구독이 없으면 연결 종료
      if (subscriptionsSet.size === 0) {
        this.closeConnection(connectionKey);
      }
    }
  }

  /**
   * 특정 연결의 모든 구독 해제
   *
   * @param connectionKey 연결 키 ('spot' 또는 'futures')
   */
  unsubscribeAll(connectionKey: string): void {
    console.log(`❌ 모든 스트림 구독 해제: ${connectionKey}`);

    this.subscriptions.delete(connectionKey);
    this.closeConnection(connectionKey);
  }

  /**
   * 모든 연결 종료
   */
  disconnect(): void {
    console.log(`🔌 모든 웹소켓 연결 종료`);

    for (const [connectionKey] of this.connections) {
      this.closeConnection(connectionKey);
    }

    this.connections.clear();
    this.subscriptions.clear();
    this.reconnectAttempts.clear();
  }

  /**
   * 구독 상태 조회
   *
   * @returns 현재 구독 상태
   */
  getSubscriptionStatus(): Record<string, string[]> {
    const status: Record<string, string[]> = {};

    for (const [connectionKey, subscriptionsSet] of this.subscriptions) {
      status[connectionKey] = Array.from(subscriptionsSet);
    }

    return status;
  }

  /**
   * 연결 상태 조회
   *
   * @returns 연결 상태 정보
   */
  getConnectionStatus(): Record<
    string,
    { connected: boolean; readyState: number }
  > {
    const status: Record<string, { connected: boolean; readyState: number }> =
      {};

    for (const [connectionKey, ws] of this.connections) {
      status[connectionKey] = {
        connected: ws.readyState === WebSocket.OPEN,
        readyState: ws.readyState,
      };
    }

    return status;
  }

  /**
   * 내부 구독 메서드 (private)
   */
  private subscribe(
    connectionKey: string,
    streamName: string,
    callback: (data: any) => void,
    isFutures: boolean,
  ): void {
    // 구독 정보 저장
    if (!this.subscriptions.has(connectionKey)) {
      this.subscriptions.set(connectionKey, new Set());
    }
    this.subscriptions.get(connectionKey)!.add(streamName);

    // 콜백 이벤트 리스너 등록
    this.on(`${connectionKey}_${streamName}`, callback);

    // 연결이 없으면 생성
    if (!this.connections.has(connectionKey)) {
      this.createConnection(connectionKey, isFutures);
    }
  }

  /**
   * 웹소켓 연결 생성 (private)
   */
  private createConnection(connectionKey: string, isFutures: boolean): void {
    const baseUrl = isFutures ? this.FUTURES_WS_URL : this.SPOT_WS_URL;
    const subscriptions = Array.from(
      this.subscriptions.get(connectionKey) || [],
    );

    // 구독할 스트림들을 조합하여 URL 생성
    const streamUrl =
      subscriptions.length > 0
        ? `${baseUrl}/${subscriptions.join('/')}`
        : baseUrl;

    console.log(
      `🔗 웹소켓 연결 생성: ${connectionKey} (${subscriptions.length}개 스트림)`,
    );

    const ws = new WebSocket(streamUrl);

    ws.on('open', () => {
      console.log(`✅ 웹소켓 연결됨: ${connectionKey}`);
      this.reconnectAttempts.set(connectionKey, 0);
      this.emit('connected', connectionKey);
    });

    ws.on('message', (data: WebSocket.Data) => {
      try {
        const message = JSON.parse(data.toString());

        // 스트림 이름 추출
        const streamName = message.stream || this.extractStreamName(message);

        if (streamName) {
          this.emit(`${connectionKey}_${streamName}`, message);
        } else {
          // 스트림 이름을 찾을 수 없는 경우 모든 구독자에게 전달
          for (const subscription of this.subscriptions.get(connectionKey) ||
            []) {
            this.emit(`${connectionKey}_${subscription}`, message);
          }
        }
      } catch (error) {
        console.error(`❌ 메시지 파싱 실패 [${connectionKey}]:`, error);
      }
    });

    ws.on('error', (error) => {
      console.error(`❌ 웹소켓 에러 [${connectionKey}]:`, error);
      this.emit('error', { connectionKey, error });
    });

    ws.on('close', (code, reason) => {
      console.log(`🔌 웹소켓 연결 종료 [${connectionKey}]: ${code} ${reason}`);
      this.connections.delete(connectionKey);
      this.emit('disconnected', { connectionKey, code, reason });

      // 자동 재연결 시도
      this.attemptReconnect(connectionKey, isFutures);
    });

    this.connections.set(connectionKey, ws);
  }

  /**
   * 재연결 시도 (private)
   */
  private attemptReconnect(connectionKey: string, isFutures: boolean): void {
    const attempts = this.reconnectAttempts.get(connectionKey) || 0;

    if (
      attempts < this.MAX_RECONNECT_ATTEMPTS &&
      this.subscriptions.has(connectionKey)
    ) {
      this.reconnectAttempts.set(connectionKey, attempts + 1);

      console.log(
        `🔄 재연결 시도 [${connectionKey}]: ${attempts + 1}/${this.MAX_RECONNECT_ATTEMPTS}`,
      );

      setTimeout(
        () => {
          this.createConnection(connectionKey, isFutures);
        },
        this.RECONNECT_INTERVAL * (attempts + 1),
      ); // 지수적 백오프
    } else {
      console.error(`❌ 재연결 포기 [${connectionKey}]: 최대 시도 횟수 초과`);
      this.emit('reconnectFailed', connectionKey);
    }
  }

  /**
   * 연결 종료 (private)
   */
  private closeConnection(connectionKey: string): void {
    const ws = this.connections.get(connectionKey);
    if (ws) {
      ws.close();
      this.connections.delete(connectionKey);
    }
    this.reconnectAttempts.delete(connectionKey);
  }

  /**
   * 메시지에서 스트림 이름 추출 (private)
   */
  private extractStreamName(message: any): string | null {
    // 다양한 메시지 형식에서 스트림 이름 추출 시도
    if (message.e) {
      // 이벤트 타입 기반 추출
      const symbol = message.s?.toLowerCase();
      const eventType = message.e;

      switch (eventType) {
        case 'kline':
          return `${symbol}@kline_${message.k?.i}`;
        case 'trade':
          return `${symbol}@trade`;
        case '24hrTicker':
          return `${symbol}@ticker`;
        case '24hrMiniTicker':
          return `${symbol}@miniTicker`;
        case 'depthUpdate':
          return `${symbol}@depth`;
        default:
          return null;
      }
    }

    return null;
  }
}
