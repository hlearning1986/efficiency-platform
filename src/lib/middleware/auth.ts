import { auth } from '@/lib/auth';
import { forbidden } from '@/lib/utils/api-response';
import type { $Enums } from '@/generated/prisma/client';

export interface AuthContext {
  userId: string;
  email: string;
  role: $Enums.UserRole;
  memberId?: string;
  teamId?: string;
}

/**
 * 获取当前登录用户的认证上下文
 */
export async function getAuthContext(): Promise<AuthContext | null> {
  const session = await auth();
  if (!session?.user) return null;

  const user = session.user as unknown as Record<string, unknown>;

  return {
    userId: session.user.id || '',
    email: session.user.email || '',
    role: (user.role as $Enums.UserRole) || 'LEADER',
    memberId: user.memberId as string | undefined,
    teamId: user.teamId as string | undefined,
  };
}

/**
 * 要求用户已认证，否则抛出401
 */
export async function requireAuth(): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx) throw forbidden('未认证');
  return ctx;
}
