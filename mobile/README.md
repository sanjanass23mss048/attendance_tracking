# Presence Mobile (React Native / Expo)

Android app for **Presence**. Same API as the web app.

Default API: `https://attendance.rioassetmanagement.net`

---

## A) Run in Expo Go (dev / testing)

```bash
cd mobile
npm install
npm start
```

On your phone: open **Expo Go** → connect to `exp://YOUR_PC_IP:8081` (same Wi‑Fi).

---

## B) Build an installable APK (Expo EAS)

### 1. One-time setup

1. Create a free account: https://expo.dev/signup  
2. In a terminal:

```bash
cd "D:\attendance tracking\mobile"
npm install
npm install -g eas-cli
eas login
```

Sign in with your Expo account when the browser opens.

### 2. Link this project to Expo

```bash
eas init
```

- Choose **Create a new project** (or link an existing one)
- This fills `extra.eas.projectId` in `app.json` — leave that value as EAS sets it

### 3. Build the APK

```bash
npm run build:apk
```

Same as:

```bash
eas build -p android --profile preview
```

- Build runs **in the cloud** (10–20 minutes first time)
- When it finishes, Expo shows a **Download** link for the `.apk`
- Copy the APK to your phone and install it (allow “Install unknown apps” if asked)

### Profiles (see `eas.json`)

| Command | Profile | Output |
|---|---|---|
| `npm run build:apk` | `preview` | **APK** (easy install / share) |
| `npm run build:store` | `production` | **AAB** (Play Store) |

---

## Demo logins

- Teacher: `neha.sharma@brightfuture.edu.in` / `password123`
- In-charge: `incharge@brightfuture.edu.in` / `password123`

## Notes

- You do **not** need Android Studio for a cloud EAS APK build.
- `flutter build apk` does **not** apply — this is Expo, not Flutter.
- Keep `EXPO_PUBLIC_API_URL` pointing at your VPS so the APK talks to production.
