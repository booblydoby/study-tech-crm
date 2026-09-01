export class ApiError extends Error {
  public readonly status: number;
  public readonly statusText: string;
  public readonly data?: unknown;

  constructor(status: number, statusText: string, message?: string, data?: unknown) {
    super(message || statusText);
    this.name = "ApiError";
    this.status = status;
    this.statusText = statusText;
    this.data = data;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isServerError(): boolean {
    return this.status >= 500;
  }
}