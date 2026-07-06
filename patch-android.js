/* Patches the generated AndroidManifest.xml with the permissions
   the background guardian service needs. Runs in CI after `cap add android`. */
const fs = require('fs');
const p = 'android/app/src/main/AndroidManifest.xml';
let xml = fs.readFileSync(p, 'utf8');

const perms = `
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
    <uses-permission android:name="android.permission.VIBRATE" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-permission android:name="android.permission.CALL_PHONE" />
`;

if (!xml.includes('ACCESS_BACKGROUND_LOCATION')) {
  xml = xml.replace('<application', perms + '\n    <application');
  fs.writeFileSync(p, xml);
  console.log('✅ AndroidManifest.xml patched with guardian permissions');
} else {
  console.log('ℹ️ Manifest already patched');
}
