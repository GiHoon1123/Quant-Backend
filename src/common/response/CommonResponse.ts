import { ApiProperty } from '@nestjs/swagger';

export class CommonResponse<T> {
  @ApiProperty({
    example: 200,
    description: 'HTTP 상태 코드',
  })
  status: number;

  @ApiProperty({
    example: '요청이 성공적으로 처리되었습니다.',
    description: '응답 메시지',
  })
  message: string;

  @ApiProperty({
    description: '응답 데이터',
    nullable: true,
  })
  data: T | null;

  private constructor(status: number, message: string, data: T | null) {
    this.status = status;
    this.message = message;
    this.data = data;
  }

  static success<T>({
    status,
    message,
    data,
  }: {
    status: number;
    message: string;
    data: T | null;
  }): CommonResponse<T> {
    return new CommonResponse(status, message, data);
  }

  static error<T>({
    status,
    message,
    data = null,
  }: {
    status: number;
    message: string;
    data?: T | null;
  }): CommonResponse<T> {
    return new CommonResponse(status, message, data);
  }
}
