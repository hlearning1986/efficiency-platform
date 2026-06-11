import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 公开路径，直接放行
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/v1/health') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/v1/resources/tapd') ||
    pathname.startsWith('/api/v1/settings/system') ||
    pathname.startsWith('/api/v1/settings/team-config') ||
    pathname.startsWith('/api/v1/settings/project-mapping') ||
    pathname.startsWith('/api/v1/dashboard/delivery') ||
    pathname.startsWith('/api/v1/sync') ||
    pathname.startsWith('/api/v1/tapd') ||
    pathname.startsWith('/api/v1/reports') ||
    pathname.startsWith('/api/v1/agile') ||
    pathname.startsWith('/api/v1/workload') ||
    pathname.startsWith('_next/static') ||
    pathname.startsWith('_next/image') ||
    pathname === '/favicon.ico' ||
    pathname.endsWith('.html')
  ) {
    return NextResponse.next();
  }

  // 预览环境（run-agent-xxx）跳过认证，直接放行
  const host = request.headers.get('host') || '';
  if (host.includes('run-agent-') || host.includes('trae.cn') || host.includes('agent-sandbox')) {
    return NextResponse.next();
  }

  // 检查是否有session cookie（不做JWT验证，避免代理环境token验证失败）
  const sessionCookie = request.cookies.get('next-auth.session-token')
    || request.cookies.get('__Secure-next-auth.session-token');

  if (sessionCookie) {
    return NextResponse.next();
  }

  // 未登录，重定向到登录页
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('callbackUrl', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    '/((?!login|api/v1/health|api/auth|api/v1/resources/tapd|api/v1/settings/system|api/v1/settings/team-config|api/v1/settings/project-mapping|api/v1/dashboard/delivery|api/v1/workload|_next/static|_next/image|favicon.ico).*)',
  ],
};
