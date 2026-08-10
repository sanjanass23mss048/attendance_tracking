# Presence Android APK = same website in an app shell

This uses **Capacitor**. The phone opens your live site:

`https://attendance.rioassetmanagement.net`

So the app UI matches the website (sidebar, reports, attendance, etc.).

> The `mobile/` Expo/React Native folder is a **different** experimental app.  
> For “website as APK”, use **Capacitor** below — not Expo.

---

## One-time setup

1. Install **[Android Studio](https://developer.android.com/studio)**  
2. In Android Studio: install SDK + accept licenses  
3. In this project (already done on `sanjana`):
   - `@capacitor/*` packages
   - `android/` native project
   - `capacitor.config.json` → loads the live website

---

## Build an APK (one command — like Flutter)

```bash
cd "D:\attendance tracking"
npm run build:apk
```

Same idea as:

```bash
cd mansoor_app_frontend
flutter build apk --release
```

Output:

```text
android\app\build\outputs\apk\release\app-release.apk
```

Copy that APK to your phone and install it.

---

## Build an APK (Android Studio UI)

```bash
cd "D:\attendance tracking"

# Sync Capacitor (optional if you only use live URL)
npm run cap:sync

# Open Android Studio
npm run cap:open
```

In Android Studio:

1. Wait for Gradle sync to finish  
2. Menu: **Build → Build Bundle(s) / APK(s) → Build APK(s)**  
3. When done, click **locate** — APK is usually:

`android\app\build\outputs\apk\debug\app-debug.apk`

Install that file on your phone.

### Release APK (signed, for sharing)

In Android Studio: **Build → Generate Signed Bundle / APK → APK**  
Create a keystore when prompted, then build **release**.

---

## How it works

| Piece | What happens |
|---|---|
| Capacitor app | Thin Android shell (WebView) |
| Content | Your **website** at `attendance.rioassetmanagement.net` |
| Login / data | Same as opening the site in Chrome |

Config: `capacitor.config.json` → `server.url`

To ship a fully offline-bundled UI later, remove `server.url` and rely on `webDir: "dist"` after `npm run build`.

---

## Troubleshooting

- **Blank / won’t load** — phone needs internet; site must be up  
- **Looks like old Expo app** — uninstall Expo Go build; install the Capacitor APK  
- **Internal server error on Save** — that’s the **VPS API** bug, not the app shell; redeploy server fix
