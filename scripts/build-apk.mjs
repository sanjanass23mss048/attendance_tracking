/**
 * One-command Android APK build (Capacitor), similar to:
 *   flutter build apk --release
 *
 * Usage (from repo root):
 *   npm run build:apk
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const androidDir = path.join(root, 'android');
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
    '/Applications/Android Studio.app/Contents/jbr/Contents/Home',
  ];

  for (const c of candidates) {
    if (c && exists(path.join(c, 'bin', isWin ? 'java.exe' : 'java'))) return c;
  }
  return null;
}

function findSdkDir() {
  if (process.env.ANDROID_HOME && exists(process.env.ANDROID_HOME)) return process.env.ANDROID_HOME;
  if (process.env.ANDROID_SDK_ROOT && exists(process.env.ANDROID_SDK_ROOT)) {
    return process.env.ANDROID_SDK_ROOT;
  }
  const guess = path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk');
  if (exists(guess)) return guess;
  return null;
}

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, {
    cwd: opts.cwd || root,
    env: opts.env || process.env,
    stdio: 'inherit',
    shell: isWin,
  });
  if (res.status !== 0) {
    process.exit(res.status || 1);
  }
}

if (!exists(androidDir)) {
  console.error('android/ folder missing. Run: npx cap add android');
  process.exit(1);
}

const javaHome = findJavaHome();
if (!javaHome) {
  console.error('JAVA_HOME not found. Install Android Studio (includes a JDK), then retry.');
  process.exit(1);
}

const sdkDir = findSdkDir();
if (!sdkDir) {
  console.error('Android SDK not found. Install Android SDK via Android Studio, then retry.');
  process.exit(1);
}

const localProps = path.join(androidDir, 'local.properties');
fs.writeFileSync(localProps, `sdk.dir=${sdkDir.replace(/\\/g, '/')}\n`);

const env = {
  ...process.env,
  JAVA_HOME: javaHome,
  PATH: `${path.join(javaHome, 'bin')}${path.delimiter}${process.env.PATH || ''}`,
};

console.log('Building Presence release APK (arm64-v8a only, website shell)…');
console.log(`JAVA_HOME=${javaHome}`);
console.log(`SDK=${sdkDir}`);

// Keep Capacitor config in sync (live site URL)
run('npx', ['cap', 'sync', 'android'], { env });

const gradlew = isWin ? 'gradlew.bat' : './gradlew';
run(gradlew, ['assembleRelease', '--no-daemon'], { cwd: androidDir, env });

const apk = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
if (exists(apk)) {
  const sizeMb = (fs.statSync(apk).size / (1024 * 1024)).toFixed(1);
  console.log('\nBUILD SUCCESSFUL');
  console.log(`APK (arm64-v8a only): ${apk}`);
  console.log(`Size: ${sizeMb} MB`);
} else {
  console.error('Build finished but APK not found at expected path.');
  process.exit(1);
}
