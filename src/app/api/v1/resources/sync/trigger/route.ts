import { NextRequest } from 'next/server';
import { checkPermission } from '@/lib/middleware/rbac';
import { success, internalError } from '@/lib/utils/api-response';
import { incrementalSync, fullSync } from '@/lib/sync/tapd-sync';
import { logger } from '@/lib/utils/logger';

export async function POST(req: NextRequest) {
  try {
    await checkPermission('POST', '/api/v1/resources/sync/trigger');

    const body = await req.json().catch(() => ({}));
    const syncType = body.syncType || 'INCREMENTAL';

    // 异步执行同步，立即返回
    const syncPromise =
      syncType === 'FULL' ? fullSync() : incrementalSync();

    syncPromise.catch((error) => {
      logger.error('Manual sync failed', { error, syncType });
    });

    return success({
      message: `数据同步已触发 (${syncType})`,
      syncType,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return internalError();
  }
}
