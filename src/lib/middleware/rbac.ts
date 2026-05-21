import { requireAuth, type AuthContext } from './auth';
import { forbidden } from '@/lib/utils/api-response';

/** 角色层级 */
const ROLE_HIERARCHY: Record<string, number> = {
  EXECUTIVE: 1,
  HR: 2,
  PM: 3,
  LEADER: 4,
  MANAGER: 5,
  ADMIN: 6,
};

type RoleCheck =
  | { allow: string[] }
  | { minRole: string };

const API_PERMISSIONS: Record<string, RoleCheck> = {
  'GET /api/v1/projects': { allow: ['MANAGER', 'LEADER', 'PM'] },
  'POST /api/v1/projects': { allow: ['MANAGER', 'PM'] },
  'PUT /api/v1/projects': { allow: ['MANAGER', 'PM'] },
  'GET /api/v1/projects/okr-tree': { allow: ['MANAGER', 'EXECUTIVE'] },
  'PUT /api/v1/projects/*/costs/*': { allow: ['MANAGER'] },
  'GET /api/v1/projects/*/roi': { allow: ['MANAGER', 'PM', 'EXECUTIVE'] },

  'GET /api/v1/efficiency/rankings': { allow: ['MANAGER', 'LEADER', 'HR'] },
  'GET /api/v1/efficiency/dashboard': { allow: ['ADMIN', 'MANAGER', 'LEADER', 'PM', 'HR', 'EXECUTIVE'] },
  'GET /api/v1/efficiency/members/*/profile': { allow: ['MANAGER', 'LEADER'] },
  'GET /api/v1/efficiency/config': { allow: ['MANAGER'] },
  'PUT /api/v1/efficiency/config': { allow: ['MANAGER'] },

  'GET /api/v1/agile/sprints': { allow: ['MANAGER', 'LEADER', 'PM'] },
  'GET /api/v1/agile/sprints/*/retro': { allow: ['MANAGER', 'LEADER'] },

  'GET /api/v1/resources/members/distribution': { allow: ['MANAGER', 'HR'] },
  'POST /api/v1/resources/sync/trigger': { allow: ['MANAGER'] },
  'GET /api/v1/resources/sync/logs': { allow: ['MANAGER'] },
  'GET /api/v1/resources/sync/status': { allow: ['MANAGER'] },

  'GET /api/v1/admin/users': { allow: ['ADMIN'] },
  'POST /api/v1/admin/users': { allow: ['ADMIN'] },
  'GET /api/v1/admin/audit-logs': { allow: ['ADMIN'] },
};

function matchPermissionKey(method: string, path: string): string | null {
  const segments = path.split('/').filter(Boolean);

  for (const pattern of Object.keys(API_PERMISSIONS)) {
    const parts = pattern.split(' ');
    const patternMethod = parts[0];
    const patternSegments = parts.slice(1).join('/').split('/').filter(Boolean);

    if (patternMethod !== method) continue;
    if (patternSegments.length !== segments.length) continue;

    let match = true;
    for (let i = 0; i < patternSegments.length; i++) {
      if (patternSegments[i] === '*') continue;
      if (patternSegments[i] !== segments[i]) {
        match = false;
        break;
      }
    }

    if (match) return pattern;
  }

  return null;
}

export async function checkPermission(
  method: string,
  path: string,
  authCtx?: AuthContext,
): Promise<void> {
  const ctx = authCtx || (await requireAuth());

  // ADMIN角色拥有所有权限
  if (ctx.role === 'ADMIN') return;

  const permissionKey = matchPermissionKey(method, path);

  if (!permissionKey) return;

  const rule = API_PERMISSIONS[permissionKey];

  if ('allow' in rule) {
    if (!rule.allow.includes(ctx.role)) {
      throw forbidden(`角色 ${ctx.role} 无权访问此资源`);
    }
  }

  if ('minRole' in rule) {
    const userLevel = ROLE_HIERARCHY[ctx.role] || 0;
    const requiredLevel = ROLE_HIERARCHY[rule.minRole] || 0;
    if (userLevel < requiredLevel) {
      throw forbidden(`需要 ${rule.minRole} 或更高权限`);
    }
  }
}

export function getDataScopeFilter(authCtx: AuthContext): Record<string, unknown> {
  switch (authCtx.role) {
    case 'ADMIN':
    case 'MANAGER':
      return {};
    case 'LEADER':
      return authCtx.teamId ? { teamId: authCtx.teamId } : {};
    default:
      return {};
  }
}
