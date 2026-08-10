# Presence Mobile (React Native / Expo)

Native Android app for **Presence** — real screens (not a website WebView).

Talks to the same API: `https://attendance.rioassetmanagement.net`

Package id: `edu.presence.mobile` (can sit beside the old Capacitor shell).

---

## Dev (Expo Go)

```bash
cd mobile
npm install
npm start
```

Open **Expo Go** on your phone (same Wi‑Fi).

---

## Installable APK

### Option A — local (Android Studio / SDK)

```bash
cd mobile
npm install
npx expo prebuild --platform android --clean
cd android
.\gradlew.bat assembleRelease
```

APK:

`mobile/android/app/build/outputs/apk/release/app-release.apk`

### Option B — Expo cloud (EAS)

```bash
cd mobile
npm install -g eas-cli
eas login
npm run build:apk
```

---

## Features

- Login (same school accounts as web)
- Dashboard summary
- My classes → mark attendance
- Status picker (P / A / L / H / OD)
- Save only, or Save & SMS parents
- Mark all Present

## Demo logins

- Teacher: `neha.sharma@brightfuture.edu.in` / `password123`
- In-charge: `incharge@brightfuture.edu.in` / `password123`
