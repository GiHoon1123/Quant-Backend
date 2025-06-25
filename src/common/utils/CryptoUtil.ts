// src/common/util/CryptoUtil.ts
import * as crypto from 'crypto';

export class CryptoUtil {
  static generateBinanceSignature(queryString: string, secret: string): string {
    return crypto
      .createHmac('sha256', secret)
      .update(queryString)
      .digest('hex');
  }
}
