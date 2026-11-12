/**
 * Re-applies two Android fixes on every `expo prebuild` (android/ is gitignored):
 *
 * 1. Release signing with the upload key. Reads credentials.json in the project
 *    root (gitignored; android.keystore.keystorePath / keystorePassword /
 *    keyAlias / keyPassword). If credentials.json is missing (EAS, CI, another
 *    machine) release builds fall back to the debug key, so nothing breaks.
 *
 * 2. liboboe.so packaging. react-native-audio-api links against oboe, which
 *    ships as a prefab-only AAR (no jni/ folder), so AGP never packages
 *    liboboe.so and the app dies at launch with UnsatisfiedLinkError. A Gradle
 *    task extracts prefab/modules/oboe/libs/android.<abi>/liboboe.so from the
 *    same com.google.oboe:oboe AAR into build/generated/d8r-oboe/jniLibs/<abi>/
 *    and adds that folder to the app's jniLibs before any native-lib merge. No
 *    binaries are committed.
 *
 * 3. Navigation bar matches the dark app background (#100e0c) with light buttons.
 *    Expo's template leaves enforceNavigationBarContrast on, so Android 10+ paints
 *    a white or grey scrim behind the gesture bar.
 */
const fs = require("fs");
const path = require("path");
const { withAppBuildGradle, withAndroidStyles, AndroidConfig } = require("expo/config-plugins");

const SIGNING_MARK = "// @d8r-release-signing";
const OBOE_MARK = "// @d8r-oboe-jnilibs";
const DEFAULT_OBOE_VERSION = "1.9.3";

/** Use the oboe version react-native-audio-api actually depends on. */
function detectOboeVersion(projectRoot) {
  try {
    const pkg = require.resolve("react-native-audio-api/package.json", { paths: [projectRoot] });
    const gradle = fs.readFileSync(path.join(path.dirname(pkg), "android", "build.gradle"), "utf8");
    const match = gradle.match(/com\.google\.oboe:oboe:([0-9][0-9A-Za-z.\-]*)/);
    if (match) return match[1];
  } catch {
    // fall through
  }
  return DEFAULT_OBOE_VERSION;
}

function addReleaseSigning(src) {
  if (src.includes(SIGNING_MARK)) return src;

  // 1) Add a release signing config after the template's debug one.
  const debugConfig = /(signingConfigs\s*\{\s*debug\s*\{[^}]*\})/;
  if (!debugConfig.test(src)) {
    throw new Error("[withAndroidReleaseFixes] could not find signingConfigs.debug in app/build.gradle");
  }
  const releaseConfig = `
        release { ${SIGNING_MARK}
            def credFile = rootProject.file('../credentials.json')
            if (credFile.exists()) {
                def ks = new groovy.json.JsonSlurper().parse(credFile).android.keystore
                storeFile rootProject.file('../' + ks.keystorePath)
                storePassword ks.keystorePassword
                keyAlias ks.keyAlias
                keyPassword ks.keyPassword
            }
        }`;
  src = src.replace(debugConfig, `$1${releaseConfig}`);

  // 2) Point buildTypes.release at it (debug key when credentials.json is absent).
  const releaseType = /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig\s+signingConfigs\.debug/;
  if (!releaseType.test(src)) {
    throw new Error("[withAndroidReleaseFixes] could not find buildTypes.release signingConfig in app/build.gradle");
  }
  src = src.replace(
    releaseType,
    `$1signingConfig rootProject.file('../credentials.json').exists() ? signingConfigs.release : signingConfigs.debug ${SIGNING_MARK}`,
  );
  return src;
}

function addOboeJniLibs(src, oboeVersion) {
  if (src.includes(OBOE_MARK)) return src;
  return `${src.trimEnd()}

${OBOE_MARK} begin
// oboe ships as a prefab-only AAR, so liboboe.so is never packaged on its own.
// Extract it from the AAR into a generated jniLibs folder for every ABI.
configurations {
    d8rOboe { transitive = false }
}
dependencies {
    d8rOboe("com.google.oboe:oboe:${oboeVersion}@aar")
}
def d8rOboeJniDir = layout.buildDirectory.dir("generated/d8r-oboe/jniLibs").get().asFile
def d8rExtractOboe = tasks.register("d8rExtractOboe", Sync) {
    from({ configurations.d8rOboe.collect { zipTree(it) } }) {
        include "prefab/modules/oboe/libs/android.*/liboboe.so"
        eachFile { f ->
            def abi = f.relativePath.segments[-2].replaceFirst(/^android\\./, "")
            f.relativePath = new RelativePath(true, abi, f.name)
        }
    }
    includeEmptyDirs = false
    into d8rOboeJniDir
}
android.sourceSets.main.jniLibs.srcDir(d8rOboeJniDir)
android.packagingOptions.jniLibs.pickFirsts += ["**/liboboe.so"]
tasks.named("preBuild") { dependsOn d8rExtractOboe }
${OBOE_MARK} end
`;
}

module.exports = function withAndroidReleaseFixes(config) {
  config = withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== "groovy") {
      throw new Error("[withAndroidReleaseFixes] expected a Groovy app/build.gradle");
    }
    const oboeVersion = detectOboeVersion(cfg.modRequest.projectRoot);
    let src = cfg.modResults.contents;
    src = addReleaseSigning(src);
    src = addOboeJniLibs(src, oboeVersion);
    cfg.modResults.contents = src;
    return cfg;
  });

  // Same ink as colors.bg. Light buttons, no contrast scrim.
  config = withAndroidStyles(config, (cfg) => {
    const styles = cfg.modResults;
    const items = {
      "android:navigationBarColor": "#100e0c",
      "android:windowLightNavigationBar": "false",
      "android:enforceNavigationBarContrast": "false",
    };
    for (const [name, value] of Object.entries(items)) {
      AndroidConfig.Styles.assignStylesValue(styles, { add: true, parent: "AppTheme", name, value });
    }
    return cfg;
  });

  return config;
};
