import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import axios from 'axios';
import { BINANCE_STEP_SIZES } from 'src/common/constant/BinanceStepSizes';
import { TooManyRequestsException } from 'src/common/exception/custom/TooManyRequestsException';

export function handleBinanceAxiosError(
  error: any,
  fallbackMessage: string,
  symbol?: string, // ✅ 심볼로 stepSize 추출
): never {
  if (axios.isAxiosError(error)) {
    const code = error.response?.data?.code;
    const msg = error.response?.data?.msg || '';

    console.error(`[Binance API Error] ${code}: ${msg}`);

    const stepSize = symbol
      ? BINANCE_STEP_SIZES[symbol.toUpperCase()]
      : undefined;

    switch (code) {
      case -1013: {
        const isLotSizeError =
          msg.includes('LOT_SIZE') ||
          msg.includes('stepSize') ||
          msg.includes('not a valid quantity');

        if (isLotSizeError) {
          const baseMsg = '주문 수량이 거래 단위(stepSize)의 배수가 아닙니다.';
          const detail = stepSize
            ? ` (${stepSize} 단위로만 주문 가능합니다)`
            : '';
          throw new BadRequestException(`${baseMsg}${detail} (${msg})`);
        }

        throw new BadRequestException(
          `주문 수량 또는 가격 조건이 Binance의 거래 조건을 만족하지 않습니다. (${msg})`,
        );
      }
      case -2010:
        throw new BadRequestException(`거래 요청이 실패했습니다. (${msg})`);
      case -2011:
        throw new NotFoundException(`해당 주문을 찾을 수 없습니다. (${msg})`);
      case -2015:
        throw new UnauthorizedException(
          `API 키 또는 권한 오류입니다. (${msg})`,
        );
    }

    if (error.response?.status === 401) {
      throw new UnauthorizedException(`인증 실패: ${msg}`);
    } else if (error.response?.status === 429) {
      throw new TooManyRequestsException('Binance 요청 제한을 초과했습니다.');
    }
  }

  console.error('Unhandled Binance error:', error);
  throw new InternalServerErrorException(fallbackMessage);
}
