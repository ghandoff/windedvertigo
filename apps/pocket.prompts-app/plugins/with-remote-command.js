// expo config plugin — adds UIBackgroundModes: audio to Info.plist
// this allows the app to:
//   1. receive AirPod/Bluetooth remote commands while backgrounded
//   2. keep the silent audio loop alive when the screen locks
const { withInfoPlist } = require('expo/config-plugins');

function withRemoteCommand(config) {
  return withInfoPlist(config, (config) => {
    const modes = config.modResults.UIBackgroundModes || [];

    if (!modes.includes('audio')) {
      modes.push('audio');
    }

    config.modResults.UIBackgroundModes = modes;
    return config;
  });
}

module.exports = withRemoteCommand;
