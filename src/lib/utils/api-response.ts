import { ErrorCode } from '@/types/api';
import { NextResponse } from 'next/server';

type SuccessData<T> = {
  code: 0;
  message: 'success';
  data: T;
};

type ErrorData = {
  code: number;
  message: string;
  data: null;
};

export function success<T>(data: T, status = 200) {
  const body: SuccessData<T> = {
    code: 0,
    message: 'success',
    data,
  };
  return NextResponse.json(body, { status });
}

export function error(code: number, message: string, status = 400) {
  const body: ErrorData = {
    code,
    message,
    data: null,
  };
  return NextResponse.json(body, { status });
}

export function unauthorized(message = '未认证') {
  return error(ErrorCode.UNAUTHORIZED, message, 401);
}

export function forbidden(message = '权限不足') {
  return error(ErrorCode.FORBIDDEN, message, 403);
}

export function notFound(message = '资源不存在') {
  return error(ErrorCode.NOT_FOUND, message, 404);
}

export function validationError(message: string) {
  return error(ErrorCode.VALIDATION_ERROR, message, 422);
}

export function internalError(message = '服务器内部错误') {
  return error(ErrorCode.INTERNAL_ERROR, message, 500);
}
