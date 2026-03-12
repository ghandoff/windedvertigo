// expo config plugin — fixes kotlin metadata version mismatch
//
// expo-module-gradle-plugin is compiled with kotlin 1.9.0 but gradle 9.0
// ships kotlin 2.2 in its API jar, causing metadata version errors.
//
// fix: downgrade gradle wrapper to 8.12 (which ships kotlin 1.9.x compatible
// metadata) and add -Xskip-metadata-version-check as a belt-and-suspenders.
//
// temporary fix until expo updates the plugin for kotlin 2.x.
// see: https://github.com/expo/expo/issues/37427

const { withDangerousMod, withProjectBuildGradle } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

function withGradleFix(config) {
  // 1. downgrade gradle wrapper from 9.0 to 8.12
  config = withDangerousMod(config, [
    'android',
    (cfg) => {
      const wrapperProps = path.join(
        cfg.modRequest.platformProjectRoot,
        'gradle',
        'wrapper',
        'gradle-wrapper.properties'
      );

      if (fs.existsSync(wrapperProps)) {
        let contents = fs.readFileSync(wrapperProps, 'utf-8');
        // replace any gradle 9.x with 8.12
        contents = contents.replace(
          /distributionUrl=.*gradle-9\.\d+(\.\d+)?.*\.zip/,
          'distributionUrl=https\\://services.gradle.org/distributions/gradle-8.12-all.zip'
        );
        fs.writeFileSync(wrapperProps, contents);
        console.log('[with-gradle-fix] downgraded gradle wrapper to 8.12');
      }

      return cfg;
    },
  ]);

  // 2. add -Xskip-metadata-version-check to all kotlin tasks via root build.gradle
  config = withProjectBuildGradle(config, (cfg) => {
    if (cfg.modResults.contents) {
      cfg.modResults.contents += `
// [with-gradle-fix] suppress kotlin metadata version check
// see: https://github.com/expo/expo/issues/37427
allprojects {
    tasks.withType(org.jetbrains.kotlin.gradle.tasks.KotlinCompile).configureEach {
        compilerOptions {
            freeCompilerArgs.addAll(["-Xskip-metadata-version-check"])
        }
    }
}
`;
    }
    return cfg;
  });

  return config;
}

module.exports = withGradleFix;
