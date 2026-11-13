import { ok } from '@/lib/api';
import { destroySession } from '@/lib/auth';
export const dynamic = 'force-dynamic';
export async function POST() {
  await destroySession(false);
  return ok();
}
