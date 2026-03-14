// expo config plugin — suppresses kotlin metadata version mismatch on android
//
// react native 0.83 uses gradle 9.0.0 which bundles kotlin 2.2, but expo
// sdk 55 and its modules are compiled with kotlin 2.1.20. this causes
// "module was compiled with an incompatible version of kotlin" errors.
//
// fix: add -Xskip-metadata-version-check to all kotlin compilation tasks,
// including EVERY included build (expo-module-gradle-plugin AND the 4
// expo-modules-autolinking gradle plugin subprojects) which are isolated
// from the project's allprojects{} block.
//
// see: https://github.com/expo/expo/issues/37427
//      https://github.com/facebook/react-native/issues/55221

const { withDangerousMod, withProjectBuildGradle } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const FLAG = 'Xskip-metadata-version-check';

// regex for compilerOptions DSL (expo-modules-core + 3 autolinking subprojects)
const COMPILER_OPTIONS_RE = /tasks\.withType<KotlinCompile>\s*\{\s*\n\s*compilerOptions\s*\{\s*\n\s*jvmTarget\.set\(JvmTarget\.JVM_11\)\s*\n\s*\}\s*\n\s*\}/;
const COMPILER_OPTIONS_REPLACEMENT = `tasks.withType<KotlinCompile> {
  compilerOptions {
    jvmTarget.set(JvmTarget.JVM_11)
    freeCompilerArgs.addAll("-Xskip-metadata-version-check")
  }
}`;

// regex for kotlinOptions DSL (expo-autolinking-plugin-shared)
const KOTLIN_OPTIONS_RE = /tasks\.withType<KotlinCompile>\s*\{\s*\n\s*kotlinOptions\s*\{\s*\n\s*jvmTarget\s*=\s*JavaVersion\.VERSION_11\.toString\(\)\s*\n\s*\}\s*\n\s*\}/;
const KOTLIN_OPTIONS_REPLACEMENT = `tasks.withType<KotlinCompile> {
  kotlinOptions {
    jvmTarget = JavaVersion.VERSION_11.toString()
    freeCompilerArgs += listOf("-Xskip-metadata-version-check")
  }
}`;

/**
 * Walk up directory tree to find a package in node_modules (handles hoisting).
 */
function findPackageDir(projectRoot, packageName) {
  const candidates = [
    path.join(projectRoot, 'node_modules', packageName),
  ];
  let dir = projectRoot;
  while (dir !== path.dirname(dir)) {
    dir = path.dirname(dir);
    candidates.push(path.join(dir, 'node_modules', packageName));
  }
  return candidates.find((c) => fs.existsSync(c)) || null;
}

/**
 * Patch a single build.gradle.kts file with the metadata skip flag.
 * Tries both compilerOptions and kotlinOptions patterns.
 */
function patchBuildFile(filePath, label) {
  if (!fs.existsSync(filePath)) {
    console.warn(`[with-gradle-fix] ${label}: not found at ${filePath}`);
    return;
  }

  let contents = fs.readFileSync(filePath, 'utf-8');

  if (contents.includes(FLAG)) {
    console.log(`[with-gradle-fix] ${label}: already patched`);
    return;
  }

  // try compilerOptions pattern first
  let patched = contents.replace(COMPILER_OPTIONS_RE, COMPILER_OPTIONS_REPLACEMENT);
  if (patched !== contents) {
    fs.writeFileSync(filePath, patched);
    console.log(`[with-gradle-fix] ${label}: patched (compilerOptions)`);
    return;
  }

  // try kotlinOptions pattern
  patched = contents.replace(KOTLIN_OPTIONS_RE, KOTLIN_OPTIONS_REPLACEMENT);
  if (patched !== contents) {
    fs.writeFileSync(filePath, patched);
    console.log(`[with-gradle-fix] ${label}: patched (kotlinOptions)`);
    return;
  }

  console.warn(`[with-gradle-fix] ${label}: no matching pattern — skipping`);
}

function withGradleFix(config) {
  // 1. patch ALL included build gradle plugin files
  config = withDangerousMod(config, [
    'android',
    (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;

      // a) expo-modules-core/expo-module-gradle-plugin
      const expoModulesCore = findPackageDir(projectRoot, 'expo-modules-core');
      if (expoModulesCore) {
        patchBuildFile(
          path.join(expoModulesCore, 'expo-module-gradle-plugin', 'build.gradle.kts'),
          'expo-module-gradle-plugin'
        );
      } else {
        console.warn('[with-gradle-fix] expo-modules-core not found');
      }

      // b) expo-modules-autolinking/android/expo-gradle-plugin subprojects
      const expoAutolinking = findPackageDir(projectRoot, 'expo-modules-autolinking');
      if (expoAutolinking) {
        const gradlePluginDir = path.join(expoAutolinking, 'android', 'expo-gradle-plugin');
        const subprojects = [
          'expo-autolinking-settings-plugin',
          'expo-autolinking-plugin',
          'expo-autolinking-plugin-shared',
          'expo-max-sdk-override-plugin',
        ];
        for (const sub of subprojects) {
          patchBuildFile(
            path.join(gradlePluginDir, sub, 'build.gradle.kts'),
            sub
          );
        }
      } else {
        console.warn('[with-gradle-fix] expo-modules-autolinking not found');
      }

      return cfg;
    },
  ]);

  // 2. add -Xskip-metadata-version-check to all project kotlin tasks
  config = withProjectBuildGradle(config, (cfg) => {
    if (cfg.modResults.contents && !cfg.modResults.contents.includes(FLAG)) {
      cfg.modResults.contents += `
// [with-gradle-fix] suppress kotlin metadata version check
// gradle 9 bundles kotlin 2.2, expo modules compiled with 2.1.20
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
