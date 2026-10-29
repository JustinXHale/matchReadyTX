# Promotions Firebase setup

These rules belong to the dedicated promotions Firebase project, not the
MatchReadyTX project.

Before opening `/promotions-manager`:

1. In Firebase Authentication, enable the Google provider.
2. Add the manager's host and `localhost` under Authentication → Settings →
   Authorized domains.
3. In Firestore, create `settings/admins` with an `emails` array containing the
   Google accounts allowed to manage promotions.
4. Publish `firestore.rules` in the promotions project's Firestore Rules tab.

The allowlist document can only be changed through Firebase Console/IAM. The
manager can edit drafts and published feeds but cannot grant itself access.
