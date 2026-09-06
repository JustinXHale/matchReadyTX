/**
 * Firestore Admin access for one-off CLI scripts.
 *
 * Requires a Firebase service account key — `firebase login` is not enough
 * (CLI OAuth cannot bypass security rules for collection scans).
 *
 *   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json
 */
import { Firestore } from '@google-cloud/firestore';

let cachedDb: Firestore | undefined;

export function requireCliFirestore(projectId: string): Firestore {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error(
      [
        'Missing GOOGLE_APPLICATION_CREDENTIALS.',
        '',
        'One-off migrations need a Firebase service account key (Admin SDK):',
        '  1. Firebase Console → Project settings → Service accounts',
        '  2. Generate new private key → save JSON outside the repo',
        '  3. export GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json',
        '  4. npm run migrate:tournament-feedback',
        '',
        'Note: firebase login alone cannot read/write bulk Firestore data.',
      ].join('\n'),
    );
  }

  if (!cachedDb) {
    cachedDb = new Firestore({ projectId });
  }
  return cachedDb;
}
