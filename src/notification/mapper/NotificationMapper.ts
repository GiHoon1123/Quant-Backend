// // 알림 도메인 매퍼 예시

// import { NotificationResponse } from '../dto/response/NotificationResponse';
// import { NotificationEntity } from '../infra/persistence/entity/NotificationEntity';

// export class NotificationMapper {
//   static toResponse(entity: NotificationEntity): NotificationResponse {
//     return {
//       id: entity.id,
//       type: entity.type,
//       message: entity.message,
//       createdAt: entity.createdAt.getTime(),
//       // ... 기타 필드
//     };
//   }
// }
