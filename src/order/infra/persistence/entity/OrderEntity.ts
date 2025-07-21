export class OrderEntity {
  id: number;
  symbol: string;
  price: number;
  quantity: number;
  status: string;
  createdAt: Date;
  // ... 기타 필드
}
