export class CommonResponse<T> {
  status: number;
  message: string;
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
