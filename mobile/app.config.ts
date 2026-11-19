import type { ConfigContext, ExpoConfig } from 'expo/config';

// Static config lives in app.json; this file only adds what depends on env vars.
export default ({ config }: ConfigContext): ExpoConfig => {
  const plugins = [...(config.plugins ?? [])];

  // Google sign-in needs a URL scheme made from the iOS client id
  // ("123-abc.apps.googleusercontent.com" -> "com.googleusercontent.apps.123-abc").
  // Without an id the plugin is left out: Apple rejects builds with a malformed
  // scheme (ITMS-90158), and the app hides the Google button anyway.
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();
  if (iosClientId) {
    const iosUrlScheme = iosClientId.split('.').reverse().join('.');
    plugins.push(['@react-native-google-signin/google-signin', { iosUrlScheme }]);
  }

  return { ...config, plugins } as ExpoConfig;
};
