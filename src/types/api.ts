/** 统一API响应格式 */
export interface ApiSuccess<T> {
  code: 0;
  message: 'success';
  data: T;
}

export interface ApiError {
  code: number;
  message: string;
  data: null;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

/** 分页参数 */
export interface PaginationParams {
  page: number;
  pageSize: number;
}

/** 分页响应 */
export interface PaginatedData<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** 业务错误码 */
export const ErrorCode = {
  SUCCESS: 0,
  UNAUTHORIZED: 40001,
  FORBIDDEN: 40003,
  NOT_FOUND: 40401,
  CONFLICT: 40901,
  VALIDATION_ERROR: 42201,
  INTERNAL_ERROR: 50001,
} as const;
