# Parent Notice Board push notifications

Parents are notified for **every notice that appears on their Notice Board**:

| Audience | Who sees it / gets notified |
|----------|-----------------------------|
| **Entire school (`ALL`)** | Every parent account (e.g. holiday for all students) |
| **Class / Groups** | Parents of students in those class-sections |
| **Specific students** | Parents linked to those students |

## How delivery works

1. **Socket.IO** (works immediately while the parent app is open) — local system notification.
2. **FCM** (works when the app is backgrounded/killed) — requires Firebase credentials below.

## Server setup (FCM)

1. Create a Firebase project → Project settings → Service accounts → Generate new private key.
2. Save the JSON on the server (do not commit it).
3. In `server/.env` set one of:

```env
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
```

or paste the JSON:

```env
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
```

Legacy alternative:

```env
FCM_SERVER_KEY=your_legacy_server_key
```

4. Restart the API. Without these vars, Socket.IO notifications still work; FCM is skipped.

## Flutter / Android setup (FCM token)

1. In Firebase Console add an Android app with package `edu.presence.flutter`.
2. Download `google-services.json` into `presence_flutter/android/app/`.
3. In `presence_flutter/android/settings.gradle.kts` / app `build.gradle.kts`, apply the Google Services plugin (FlutterFire docs).
4. Rebuild the app. Until this is done, the app falls back to Socket.IO + local notifications.

## Apply DB table

```bash
cd server
node scripts/ensure-parent-portal-tables.js
```

Creates `tblDevice_Tokens` if missing.
