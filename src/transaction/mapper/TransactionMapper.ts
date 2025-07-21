import { TransactionResponse } from '../dto/response/TransactionResponse';
import { BitcoinTransaction } from '../infra/persistence/entity/BitcoinTransactionEntity';

export class TransactionMapper {
  static toResponse(entity: BitcoinTransaction): TransactionResponse {
    return {
      id: entity.id,
      txid: entity.txid,
      amount: entity.netAmount,
      status: entity.purpose,
      createdAt:
        entity.createdAt instanceof Date
          ? entity.createdAt.getTime()
          : entity.createdAt,
      // ... 기타 필드
    };
  }
}
