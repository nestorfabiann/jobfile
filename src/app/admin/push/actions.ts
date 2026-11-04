'use server';

import { requireAdmin } from '@/lib/admin';

/** Makes a new pair of phone alert keys and returns them to the owner's screen only. Nothing is saved. */
export async function makeKeys(): Promise<{ publicKey: string; privateKey: string }> {
  await requireAdmin();
  const webpush = (await import('web-push')).default;
  return webpush.generateVAPIDKeys();
}
