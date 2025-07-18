import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { CandleData } from '../../infra/candle/Candle15MEntity';
import { Candle15MService } from '../../service/candle/Candle15MService';

/**
 * 15분봉 캔들 데이터 웹소켓 게이트웨이
 *
 * 실시간 15분봉 캔들 데이터를 클라이언트에 전송하는 웹소켓 게이트웨이입니다.
 * 클라이언트는 특정 심볼을 구독하여 실시간 캔들 업데이트를 받을 수 있습니다.
 *
 * 주요 기능:
 * - 심볼별 실시간 캔들 데이터 전송
 * - 클라이언트 구독 관리
 * - 캔들 완성 이벤트 전송
 * - 연결 상태 관리
 * - 에러 처리 및 로깅
 */
@Injectable()
@WebSocketGateway({
  namespace: '/candle15m',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
})
export class Candle15MGateway
  implements
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleInit
{
  @WebSocketServer()
  server: Server;

  // 클라이언트별 구독 심볼 관리
  private clientSubscriptions = new Map<string, Set<string>>();

  constructor(private readonly candle15MService: Candle15MService) {}

  /**
   * 모듈 초기화
   *
   * 15분봉 서비스의 이벤트를 수신하여 클라이언트에 전파합니다.
   */
  onModuleInit(): void {
    // 캔들 업데이트 이벤트 수신
    this.candle15MService.on(
      'candle.updated',
      (data: {
        symbol: string;
        candleData: CandleData;
        isCompleted: boolean;
      }) => {
        this.broadcastCandleUpdate(
          data.symbol,
          data.candleData,
          data.isCompleted,
        );
      },
    );

    // 캔들 완성 이벤트 수신
    this.candle15MService.on(
      'candle.completed',
      (data: {
        symbol: string;
        candleData: CandleData;
        isCompleted: boolean;
      }) => {
        this.broadcastCandleComplete(data.symbol, data.candleData);
      },
    );

    console.log('[Candle15MGateway] 웹소켓 게이트웨이 초기화 완료');
  }

  /**
   * 웹소켓 서버 초기화
   */
  afterInit(server: Server): void {
    console.log('[Candle15MGateway] 웹소켓 서버 초기화 완료');
  }

  /**
   * 클라이언트 연결 처리
   */
  handleConnection(client: Socket): void {
    const clientId = client.id;
    this.clientSubscriptions.set(clientId, new Set<string>());

    console.log(`[Candle15MGateway] 클라이언트 연결: ${clientId}`);

    // 연결 성공 메시지 전송
    client.emit('connected', {
      message: '15분봉 캔들 데이터 웹소켓에 연결되었습니다.',
      clientId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 클라이언트 연결 해제 처리
   */
  handleDisconnect(client: Socket): void {
    const clientId = client.id;
    const subscriptions = this.clientSubscriptions.get(clientId);

    if (subscriptions) {
      console.log(
        `[Candle15MGateway] 클라이언트 연결 해제: ${clientId} (구독: ${Array.from(subscriptions).join(', ')})`,
      );
      this.clientSubscriptions.delete(clientId);
    } else {
      console.log(`[Candle15MGateway] 클라이언트 연결 해제: ${clientId}`);
    }
  }

  /**
   * 심볼 구독 처리
   *
   * @param client 클라이언트 소켓
   * @param symbols 구독할 심볼 배열
   */
  @SubscribeMessage('subscribe')
  async handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() symbols: string | string[],
  ): Promise<void> {
    try {
      const clientId = client.id;
      const symbolList = Array.isArray(symbols) ? symbols : [symbols];
      const clientSubscriptions =
        this.clientSubscriptions.get(clientId) || new Set<string>();

      for (const symbol of symbolList) {
        if (!clientSubscriptions.has(symbol)) {
          // 클라이언트 구독 목록에 추가
          clientSubscriptions.add(symbol);

          // 심볼 방(room)에 클라이언트 추가
          client.join(`symbol:${symbol}`);

          // 최신 캔들 데이터 전송
          const latestCandle = this.candle15MService.getLatestCandle(symbol);
          if (latestCandle) {
            client.emit('candle.latest', {
              symbol,
              candle: latestCandle.toCandleData(),
              timestamp: new Date().toISOString(),
            });
          }

          console.log(
            `[Candle15MGateway] 클라이언트 ${clientId} -> ${symbol} 구독`,
          );
        }
      }

      this.clientSubscriptions.set(clientId, clientSubscriptions);

      // 구독 완료 응답
      client.emit('subscribed', {
        symbols: symbolList,
        totalSubscriptions: clientSubscriptions.size,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error(`[Candle15MGateway] 구독 처리 실패:`, error);
      client.emit('error', {
        message: '구독 처리 중 오류가 발생했습니다.',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * 심볼 구독 해제 처리
   *
   * @param client 클라이언트 소켓
   * @param symbols 구독 해제할 심볼 배열
   */
  @SubscribeMessage('unsubscribe')
  async handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() symbols: string | string[],
  ): Promise<void> {
    try {
      const clientId = client.id;
      const symbolList = Array.isArray(symbols) ? symbols : [symbols];
      const clientSubscriptions = this.clientSubscriptions.get(clientId);

      if (clientSubscriptions) {
        for (const symbol of symbolList) {
          if (clientSubscriptions.has(symbol)) {
            // 클라이언트 구독 목록에서 제거
            clientSubscriptions.delete(symbol);

            // 심볼 방(room)에서 클라이언트 제거
            client.leave(`symbol:${symbol}`);

            console.log(
              `[Candle15MGateway] 클라이언트 ${clientId} -> ${symbol} 구독 해제`,
            );
          }
        }
      }

      // 구독 해제 완료 응답
      client.emit('unsubscribed', {
        symbols: symbolList,
        remainingSubscriptions: clientSubscriptions
          ? clientSubscriptions.size
          : 0,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error(`[Candle15MGateway] 구독 해제 처리 실패:`, error);
      client.emit('error', {
        message: '구독 해제 처리 중 오류가 발생했습니다.',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * 구독 상태 조회
   *
   * @param client 클라이언트 소켓
   */
  @SubscribeMessage('getSubscriptions')
  handleGetSubscriptions(@ConnectedSocket() client: Socket): void {
    const clientId = client.id;
    const subscriptions =
      this.clientSubscriptions.get(clientId) || new Set<string>();

    client.emit('subscriptions', {
      symbols: Array.from(subscriptions),
      count: subscriptions.size,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 캔들 업데이트를 구독 중인 클라이언트에게 브로드캐스트
   *
   * @param symbol 심볼
   * @param candleData 캔들 데이터
   * @param isCompleted 캔들 완성 여부
   */
  private broadcastCandleUpdate(
    symbol: string,
    candleData: CandleData,
    isCompleted: boolean,
  ): void {
    const room = `symbol:${symbol}`;

    this.server.to(room).emit('candle.update', {
      symbol,
      candle: candleData,
      isCompleted,
      timestamp: new Date().toISOString(),
    });

    console.log(`[Candle15MGateway] 캔들 업데이트 브로드캐스트: ${symbol}`);
  }

  /**
   * 캔들 완성을 구독 중인 클라이언트에게 브로드캐스트
   *
   * @param symbol 심볼
   * @param candleData 완성된 캔들 데이터
   */
  private broadcastCandleComplete(
    symbol: string,
    candleData: CandleData,
  ): void {
    const room = `symbol:${symbol}`;

    this.server.to(room).emit('candle.completed', {
      symbol,
      candle: candleData,
      timestamp: new Date().toISOString(),
    });

    console.log(`[Candle15MGateway] 캔들 완성 브로드캐스트: ${symbol}`);
  }

  /**
   * 서버 통계 정보 브로드캐스트 (관리자용)
   */
  broadcastServerStats(): void {
    const stats = {
      totalConnections: this.server.sockets.sockets.size,
      subscriptionStats: this.getSubscriptionStats(),
      serviceStats: this.candle15MService.getSubscriptionStatus(),
      timestamp: new Date().toISOString(),
    };

    this.server.emit('server.stats', stats);
    console.log(`[Candle15MGateway] 서버 통계 브로드캐스트:`, stats);
  }

  /**
   * 구독 통계 정보 반환
   */
  private getSubscriptionStats(): {
    totalClients: number;
    totalSubscriptions: number;
    symbolSubscriptions: Record<string, number>;
  } {
    const symbolCounts: Record<string, number> = {};
    let totalSubscriptions = 0;

    for (const subscriptions of this.clientSubscriptions.values()) {
      totalSubscriptions += subscriptions.size;

      for (const symbol of subscriptions) {
        symbolCounts[symbol] = (symbolCounts[symbol] || 0) + 1;
      }
    }

    return {
      totalClients: this.clientSubscriptions.size,
      totalSubscriptions,
      symbolSubscriptions: symbolCounts,
    };
  }
}
