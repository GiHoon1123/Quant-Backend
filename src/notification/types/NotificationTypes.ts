/**
 * 📢 Notification 도메인 타입 정의
 *
 * 다양한 알림 채널과 메시지 형식을 정의합니다.
 */

/**
 * 지원하는 알림 채널
 */
export enum NotificationChannel {
  TELEGRAM = 'TELEGRAM',
  WEBSOCKET = 'WEBSOCKET', // 웹 클라이언트용
  KAKAO = 'KAKAO', // 카카오톡 (추후)
  EMAIL = 'EMAIL', // 이메일 (추후)
  DISCORD = 'DISCORD', // 디스코드 (추후)
}

/**
 * 알림 우선순위
 */
export enum NotificationPriority {
  CRITICAL = 'CRITICAL', // 즉시 알림 (거래 신호 등)
  HIGH = 'HIGH', // 높은 우선순위 (중요한 시장 변화)
  MEDIUM = 'MEDIUM', // 보통 우선순위 (일반 분석 결과)
  LOW = 'LOW', // 낮은 우선순위 (정보성 메시지)
}

/**
 * 알림 메시지 유형
 */
export enum NotificationType {
  ANALYSIS_RESULT = 'ANALYSIS_RESULT', // 기술적 분석 결과
  PRICE_ALERT = 'PRICE_ALERT', // 가격 알림
  VOLUME_ALERT = 'VOLUME_ALERT', // 거래량 알림
  BREAKOUT_ALERT = 'BREAKOUT_ALERT', // 돌파 알림
  NEWS_ALERT = 'NEWS_ALERT', // 뉴스 알림
  SYSTEM_ALERT = 'SYSTEM_ALERT', // 시스템 알림
}

/**
 * 알림 메시지 인터페이스
 */
export interface NotificationMessage {
  id: string; // 고유 ID
  type: NotificationType; // 메시지 유형
  channel: NotificationChannel; // 알림 채널
  priority: NotificationPriority; // 우선순위

  // 메시지 내용
  title: string; // 제목
  message: string; // 본문

  // 메타데이터
  symbol?: string; // 관련 심볼
  data?: Record<string, any>; // 추가 데이터

  // 수신자 정보
  recipients?: string[]; // 특정 수신자 (선택)

  // 타이밍
  createdAt: Date; // 생성 시간
  scheduledAt?: Date; // 예약 발송 시간
  sentAt?: Date; // 실제 발송 시간

  // 상태
  status: NotificationStatus; // 발송 상태
  error?: string; // 에러 메시지
}

/**
 * 알림 발송 상태
 */
export enum NotificationStatus {
  PENDING = 'PENDING', // 대기중
  SENDING = 'SENDING', // 발송중
  SENT = 'SENT', // 발송완료
  FAILED = 'FAILED', // 발송실패
  CANCELLED = 'CANCELLED', // 취소됨
}

/**
 * 채널별 설정 인터페이스
 */
export interface ChannelConfig {
  enabled: boolean; // 채널 활성화 여부
  priority: NotificationPriority[]; // 처리할 우선순위
  types: NotificationType[]; // 처리할 메시지 유형
  config?: Record<string, any>; // 채널별 추가 설정
}

/**
 * 알림 설정 인터페이스
 */
export interface NotificationSettings {
  channels: Record<NotificationChannel, ChannelConfig>;
  globalSettings: {
    rateLimiting: {
      enabled: boolean;
      maxPerMinute: number;
      maxPerHour: number;
    };
    quietHours: {
      enabled: boolean;
      startHour: number; // 0-23
      endHour: number; // 0-23
    };
  };
}
