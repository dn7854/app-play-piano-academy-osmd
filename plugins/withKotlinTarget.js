// plugins/withKotlinTarget.js
// Forces every Kotlin compile task (including third-party modules such as
// @motiz88/react-native-midi) to target JVM 17, matching the app's Java target.
const { withProjectBuildGradle } = require("expo/config-plugins");

module.exports = function withKotlinTarget(config) {
  return withProjectBuildGradle(config, (config) => {
    const script = `
allprojects {
    tasks.withType(org.jetbrains.kotlin.gradle.tasks.KotlinCompile).configureEach {
        kotlinOptions {
            jvmTarget = "17"
        }
    }
}
`;
    if (!config.modResults.contents.includes("org.jetbrains.kotlin.gradle.tasks.KotlinCompile")) {
      config.modResults.contents += script;
    }
    return config;
  });
};