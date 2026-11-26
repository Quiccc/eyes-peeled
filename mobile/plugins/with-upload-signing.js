// Signs local release builds (APK/AAB) with the Play upload key, so they can be uploaded to Play Console.
// The key and its passwords never live in the repo: they come from Gradle properties, usually
// ~/.gradle/gradle.properties:
//   EYESPEELED_UPLOAD_STORE_FILE, EYESPEELED_UPLOAD_STORE_PASSWORD,
//   EYESPEELED_UPLOAD_KEY_ALIAS, EYESPEELED_UPLOAD_KEY_PASSWORD
// Without them, release builds fall back to the debug key, as before.
const { withAppBuildGradle } = require('expo/config-plugins');

const UPLOAD_CONFIG = `
        upload {
            if (project.hasProperty('EYESPEELED_UPLOAD_STORE_FILE')) {
                storeFile file(EYESPEELED_UPLOAD_STORE_FILE)
                storePassword EYESPEELED_UPLOAD_STORE_PASSWORD
                keyAlias EYESPEELED_UPLOAD_KEY_ALIAS
                keyPassword EYESPEELED_UPLOAD_KEY_PASSWORD
            }
        }`;

const RELEASE_SIGNING =
  "signingConfig project.hasProperty('EYESPEELED_UPLOAD_STORE_FILE') ? signingConfigs.upload : signingConfigs.debug";

module.exports = function withUploadSigning(config) {
  return withAppBuildGradle(config, (mod) => {
    let gradle = mod.modResults.contents;
    if (gradle.includes('EYESPEELED_UPLOAD_STORE_FILE')) return mod;

    gradle = gradle.replace(/signingConfigs \{/, (m) => m + UPLOAD_CONFIG);
    gradle = gradle.replace(
      /(release \{[^}]*?)signingConfig signingConfigs\.debug/,
      (_, head) => head + RELEASE_SIGNING,
    );
    if (!gradle.includes(RELEASE_SIGNING)) {
      throw new Error('with-upload-signing: could not find the release signingConfig in app/build.gradle');
    }
    mod.modResults.contents = gradle;
    return mod;
  });
};
