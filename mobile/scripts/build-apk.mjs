/**
 * Local Android release APK for Presence native (Expo) app.
 * Usage from repo: node mobile/scripts/build-apk.mjs
 * Or: cd mobile && npm run build:apk:local
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(__dirname, '..');
const androidDir = path.join(mobileRoot, 'android');
const isWin = process.platform === 'win32';

function exists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function findJavaHome() {
  if (process.env.JAVA_HOME && exists(path.join(process.env.JAVA_HOME, 'bin', isWin ? 'java.exe' : 'java'))) {
    return process.env.JAVA_HOME;
  }
  const candidates = [
    'C:\\Program Files\\Android\\Android Studio1\\jbr',
    'C:\\Program Files\\Android\\Android Studio\\jbr',
    'C:\\Program Files\\Android\\Android Studio\\jre',
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Android', 'Android Studio', 'jbr'),
  ];
  for (const c of candidates) {
    if (c && exists(path.join(c, 'bin', isWin ? 'java.exe' : 'java'))) return c;
  }
  return null;
}

function findSdkDir() {
  if (process.env.ANDROID_HOME && exists(process.env.ANDROID_HOME)) return process.env.ANDROID_HOME;
  if (process.env.ANDROID_SDK_ROOT && exists(process.env.ANDROID_SDK_ROOT)) return process.env.ANDROID_SDK_ROOT;
  const guess = path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk');
  if (exists(guess)) return guess;
  return null;
}

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, {
    cwd: opts.cwd || mobileRoot,
    env: opts.env || process.env,
    stdio: 'inherit',
    shell: isWin,
  });
  if (res.status !== 0) process.exit(res.status || 1);
}

const javaHome = findJavaHome();
if (!javaHome) {
  console.error('JAVA_HOME not found. Install Android Studio, then retry.');
  process.exit(1);
}
const sdkDir = findSdkDir();
if (!sdkDir) {
  console.error('Android SDK not found.');
  process.exit(1);
}

const env = {
  ...process.env,
  JAVA_HOME: javaHome,
  ANDROID_HOME: sdkDir,
  ANDROID_SDK_ROOT: sdkDir,
  // Short path avoids Windows MAX_PATH failures with React Native prefab libs
  GRADLE_USER_HOME: process.env.GRADLE_USER_HOME || (isWin ? 'C:\\g' : path.join(process.env.HOME || '', '.gradle')),
  NODE_ENV: 'production',
  CI: '1',
};

if (!exists(androidDir)) {
  console.log('Running expo prebuild…');
  run('npx', ['expo', 'prebuild', '--platform', 'android', '--clean'], { env });
}

const gradlew = isWin ? 'gradlew.bat' : './gradlew';
console.log('Building release APK…');
run(gradlew, ['assembleRelease'], { cwd: androidDir, env });

const apk = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
if (!exists(apk)) {
  console.error('APK not found at', apk);
  process.exit(1);
}
console.log('BUILD SUCCESSFUL');
console.log('APK:', apk);
