import { Module } from '@nestjs/common';
import { TelegramClient } from './infra/client/TelegramClient';
import { NotificationService } from './service/NotificationService';

/**
 * 📢 Notification 도메인 모듈
 *
 * 🎯 **핵심 책임**: 다양한 채널을 통한 통합 알림 관리
 * - technical-analysis 도메인의 analysis.completed 이벤트 수신
 * - 채널별 알림 발송 (텔레그램, 웹소켓, 카카오톡 등)
 * - 알림 우선순위 및 필터링 관리
 * - 발송 상태 추적 및 통계
 *
 * 🔄 **이벤트 플로우**:
 * analysis.completed 수신 → 채널 선택 → 알림 발송 → 상태 추적
 *
 * 📡 **수신 이벤트**: analysis.completed
 *
 * 📢 **지원 채널**:
 * - ✅ 텔레그램 (구현 완료)
 * - 🔄 웹소켓 (추후 구현)
 * - 🔄 카카오톡 (추후 구현)
 * - 🔄 이메일 (추후 구현)
 * - 🔄 디스코드 (추후 구현)
 *
 * 🏗️ **확장 계획**:
 * - 웹소켓을 통한 실시간 클라이언트 알림
 * - 카카오톡 비즈니스 API 연동
 * - 이메일 대량 발송 시스템
 * - 디스코드 봇 연동
 * - 푸시 알림 (모바일 앱)
 */
@Module({
  imports: [],
  controllers: [],
  providers: [
    // 📢 메인 알림 서비스
    NotificationService,

    // 📱 채널별 서비스들 (common 모듈의 기존 서비스 활용)
    TelegramClient,

    // TODO: 추후 추가할 채널 서비스들
    // WebSocketNotificationService,
    // KakaoNotificationService,
    // EmailNotificationService,
    // DiscordNotificationService,
  ],
  exports: [
    // 🔄 다른 도메인에서 사용할 수 있도록 export
    NotificationService, // 이벤트 연결 및 직접 알림 발송용
  ],
})
export class NotificationModule {}
