import * as AppleAuthentication from 'expo-apple-authentication';
import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { Platform } from 'react-native';

import type { AuthRequest } from '@/api/types';

/** Thrown when the user dismisses the native sign-in sheet — callers should ignore it silently. */
export class SignInCancelled extends Error {
  constructor() {
    super('Sign-in cancelled');
    this.name = 'SignInCancelled';
  }
}

/**
 * Whether this build has the Google client IDs it needs (iOS also needs its own client ID). Without
 * them the button could only fail, so the sign-in screen hides it (e.g. early TestFlight builds).
 */
export const GOOGLE_SIGN_IN_AVAILABLE =
  !!process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID &&
  (Platform.OS !== 'ios' || !!process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID);

let googleConfigured = false;

function configureGoogle() {
  if (googleConfigured) return;
  GoogleSignin.configure({
    // The web client ID makes Google return an idToken your backend can verify.
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  });
  googleConfigured = true;
}

export async function isAppleSignInAvailable() {
  if (Platform.OS !== 'ios') return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

export async function getAppleCredential(): Promise<AuthRequest> {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!credential.identityToken) throw new Error('Apple did not return an identity token.');
    const name = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(' ');
    return { provider: 'apple', idToken: credential.identityToken, fullName: name || null };
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') throw new SignInCancelled();
    throw e;
  }
}

/**
 * Account deletion: ask Apple for a fresh authorization code (it lasts ~5 minutes and works once,
 * so the one from sign-in can't be kept). The server uses it to revoke the app's Apple token.
 */
export async function getAppleAuthorizationCode(): Promise<string> {
  try {
    const credential = await AppleAuthentication.signInAsync({ requestedScopes: [] });
    if (!credential.authorizationCode) throw new Error('Apple did not return an authorization code.');
    return credential.authorizationCode;
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') throw new SignInCancelled();
    throw e;
  }
}

export async function getGoogleCredential(): Promise<AuthRequest> {
  configureGoogle();
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) throw new SignInCancelled();
    const idToken = response.data.idToken;
    if (!idToken) throw new Error('Google did not return an ID token. Check EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.');
    return { provider: 'google', idToken, fullName: response.data.user.name };
  } catch (e) {
    if (isErrorWithCode(e) && e.code === statusCodes.IN_PROGRESS) throw new SignInCancelled();
    throw e;
  }
}

export async function signOutOfProviders() {
  try {
    if (googleConfigured) await GoogleSignin.signOut();
  } catch {
    // not signed in with Google
  }
}
