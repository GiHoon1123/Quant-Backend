import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

const DEFAULT_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];

@ValidatorConstraint({ async: false })
export class IsModifiableSymbolConstraint
  implements ValidatorConstraintInterface
{
  validate(symbol: any, args: ValidationArguments) {
    return !DEFAULT_SYMBOLS.includes(symbol?.toUpperCase?.()); // 기본 심볼이면 false
  }

  defaultMessage() {
    return `BTCUSDT', 'ETHUSDT', 'SOLUSDT는 기본 구독 심볼이므로 추가 및 삭제할 수 없습니다.`;
  }
}

export function IsModifiableSymbol(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'IsModifiableSymbol',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: IsModifiableSymbolConstraint,
    });
  };
}
