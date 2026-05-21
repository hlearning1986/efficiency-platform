import { success } from '@/lib/utils/api-response';

export async function GET() {
  return success({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
}
