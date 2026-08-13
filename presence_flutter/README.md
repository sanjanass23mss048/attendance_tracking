# Presence Flutter (native)

Full native Android/iOS app for **Presence**, talking to the same API as the website:

`https://attendance.rioassetmanagement.net`

This is **not** a WebView of the browser UI. It reimplements school workflows in Flutter
(login, dashboard, attendance mark + parent SMS, classes, students, calendar, reports, etc.).

## Options (how we got here)

| Approach | Same browser layout? | All features? | Native feel |
|---|---|---|---|
| Capacitor WebView | Yes (identical) | Yes (web code) | Weak |
| Expo RN (`mobile/`) | No | Partial | Good |
| **Flutter (this folder)** | No — native UI | Built against same API | Best for “proper app” |

You asked for Flutter + all features → this project.

## Run

```bash
cd presence_flutter
flutter pub get
flutter run
```

## Release APK

```bash
cd presence_flutter
flutter build apk --release
```

Output:

`build/app/outputs/flutter-apk/app-release.apk`

## Demo logins

- Admin (Audit Logs): `admin@brightfuture.edu.in` / `password123`
- `neha.sharma@brightfuture.edu.in` / `password123`
- `incharge@brightfuture.edu.in` / `password123`
