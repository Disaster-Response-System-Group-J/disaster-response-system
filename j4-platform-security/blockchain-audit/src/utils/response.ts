export type ApiSuccessResponse<T> = {
  success: true;
  data: T;
  error: null;
};

export type ApiErrorResponse = {
  success: false;
  data: null;
  error: string;
};

export function successResponse<T>(data: T): ApiSuccessResponse<T> {
  return {
    success: true,
    data,
    error: null,
  };
}

export function errorResponse(message: string): ApiErrorResponse {
  return {
    success: false,
    data: null,
    error: message,
  };
}
