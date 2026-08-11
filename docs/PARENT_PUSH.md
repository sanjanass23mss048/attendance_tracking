# Parent Notice Board push notifications

Parents are notified for **every notice that appears on their Notice Board**:

| Audience | Who sees it / gets notified |
|----------|-----------------------------|
| **Entire school (`ALL`)** | Every parent account (e.g. holiday for all students) |
| **Class / Groups** | Parents of students in those class-sections |
| **Specific students** | Parents linked to those students |

Teacher **Send Notification** (web) also mirrors into the Notice Board and triggers the same push.

## How delivery works

1. **Socket.IO** (works immediately while the parent app is open) — local system notification.
2. **FCM** (works when the app is backgrounded/killed) — requires Firebase credentials on the **production** host.

> Local script / local API can send FCM even when production cannot. If Notice Board updates but there is no tray push from the live site, production is missing the service-account file inside Docker.

## Server setup (FCM)

1. Create a Firebase project → Project settings → Service accounts → Generate new private key.
2. Save the JSON as `server/firebase-service-account.json` (do **not** commit it — gitignored).
3. In `server/.env` set:

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

4. Restart / redeploy the API. Without these, Socket.IO still works; FCM is skipped.

## Production redeploy (required for teacher Send Notification push)

Do this on the **laptop / VPS that runs** `attendance.rioassetmanagement.net`:

1. `git pull` (get `docker-compose.prod.yml` volume mount + FCM path fixes).
2. Copy the secret file onto that machine (it is **not** in git):

   ```bash
   # from your PC that has the JSON, e.g.:
   scp server/firebase-service-account.json user@HOST:/opt/attendance-tracking/server/
   ```

3. Ensure `server/.env` on the host contains:

   ```env
   FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
   ```

4. Rebuild and restart:

   ```bash
   cd /opt/attendance-tracking
   # file must exist BEFORE compose up, or Docker creates an empty directory instead
   test -f server/firebase-service-account.json
   docker compose -f docker-compose.prod.yml up -d --build
   ```

5. Confirm logs show FCM is live:

   ```bash
   docker logs bright-future-attendance --tail 40 | grep FCM
   ```

   You want: `FCM: service account file OK → …`  
   Not: `FCM: configured PATH but file missing` or `FCM: not configured`.

After that, teacher **Send Notification** should show on the Notice Board **and** fire a system push.

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
