// src/common/exception/custom/TooManyRequestsException.ts

import { HttpException, HttpStatus } from '@nestjs/common';

export class TooManyRequestsException extends HttpException {
  constructor(message = '요청이 너무 많습니다.') {
    super(message, HttpStatus.TOO_MANY_REQUESTS);
  }
}
