import { prisma } from '@/lib/prisma';
import { checkPermission } from '@/lib/middleware/rbac';
import { success } from '@/lib/utils/api-response';

export async function GET() {
  try {
    await checkPermission('GET', '/api/v1/resources/sync/status');

    const sources = ['TAPD', 'MANUAL'] as const;

    const statuses = await Promise.all(
      sources.map(async (source) => {
        const lastSync = await prisma.syncLog.findFirst({
          where: { source },
          orderBy: { startedAt: 'desc' },
        });

        return {
          source,
          lastSyncTime: lastSync?.startedAt || null,
          lastSyncStatus: lastSync?.status || 'NEVER',
          lastSyncRecords: lastSync?.recordsCount || 0,
        };
      }),
    );

    return success(statuses);
  } catch (error) {
    if (error instanceof Response) return error;
    throw error;
  }
}
