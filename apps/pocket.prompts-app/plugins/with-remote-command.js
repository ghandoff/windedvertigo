// expo config plugin — platform-specific setup for headphone remote commands
//
// iOS:  adds UIBackgroundModes: audio to Info.plist so the app receives
//       AirPod/Bluetooth remote commands while backgrounded and keeps the
//       silent audio loop alive when the screen locks.
//
// Android: adds FOREGROUND_SERVICE + FOREGROUND_SERVICE_MEDIA_PLAYBACK
//          permissions for future background MediaSession support.
//          (foreground-only mode works without these, but the permissions
//          need to be declared at build time for when we add the service.)

const { withInfoPlist, withAndroidManifest } = require('expo/config-plugins');

function withRemoteCommand(config) {
  // ── iOS ──────────────────────────────────────────────────────────
  config = withInfoPlist(config, (cfg) => {
    const modes = cfg.modResults.UIBackgroundModes || [];
    if (!modes.includes('audio')) {
      modes.push('audio');
    }
    cfg.modResults.UIBackgroundModes = modes;
    return cfg;
  });

  // ── Android ──────────────────────────────────────────────────────
  config = withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;

    // ensure <uses-permission> array exists
    if (!manifest['uses-permission']) {
      manifest['uses-permission'] = [];
    }

    const permissions = manifest['uses-permission'];

    const needed = [
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
    ];

    for (const perm of needed) {
      const exists = permissions.some(
        (p) => p.$?.['android:name'] === perm
      );
      if (!exists) {
        permissions.push({ $: { 'android:name': perm } });
      }
    }

    return cfg;
  });

  return config;
}

module.exports = withRemoteCommand;
