// src/common/validator/IsSupportedSymbol.ts
import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';
import { BINANCE_SUPPORTED_SYMBOLS } from '../constant/BinanceSymbols';

export function IsSupportedSymbol(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isSupportedSymbol',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: any) {
          return BINANCE_SUPPORTED_SYMBOLS.includes(value.toUpperCase());
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.value}는 지원하지 않는 심볼입니다.`;
        },
      },
    });
  };
}
