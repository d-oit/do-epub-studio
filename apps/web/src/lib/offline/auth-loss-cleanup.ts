import { clearAllEncryptedData } from './db';

/**
 * Invoked on auth loss (manual or expired 401). Isolated in a standalone
 * module so `lib/api/core.ts` dynamic import never references `lib/offline/db.ts`
 * or `idb` statically or at build time from the app shell.
 */
export async function clearEncryptedDataOnAuthLoss(): Promise<void> {
  await clearAllEncryptedData();
}
