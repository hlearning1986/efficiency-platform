import type { $Enums } from '@/generated/prisma/client';

export interface AuthUser {
  id: string;
  email: string;
  role: $Enums.UserRole;
  memberId?: string;
  teamId?: string;
}
