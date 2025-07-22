import {
  NotificationPriority,
  NotificationType,
} from '../notification/types/NotificationTypes';

const notificationConfig = {
  telegram: {
    enabled: true,
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    chatId: process.env.TELEGRAM_CHAT_ID,
    priority: [
      NotificationPriority.CRITICAL,
      NotificationPriority.HIGH,
      NotificationPriority.MEDIUM,
    ],
    types: [
      NotificationType.ANALYSIS_RESULT,
      NotificationType.PRICE_ALERT,
      NotificationType.BREAKOUT_ALERT,
    ],
  },
  rateLimiting: {
    enabled: true,
    maxPerMinute: 10,
    maxPerHour: 100,
  },
  quietHours: {
    enabled: false,
    startHour: 23,
    endHour: 7,
  },
};

export default notificationConfig;
