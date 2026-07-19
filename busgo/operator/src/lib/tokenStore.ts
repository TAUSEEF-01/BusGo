import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

/**
 * P0.5: long-lived credentials live in the platform keystore (SecureStore),
 * not AsyncStorage. Only the non-sensitive profile cache stays in
 * AsyncStorage. Legacy AsyncStorage tokens are migrated once, then removed.
 */
const SECURE_TOKEN_KEY = 'busgo.secure.token';
const SECURE_REFRESH_KEY = 'busgo.secure.refresh-token';
// Legacy AsyncStorage locations (pre-secure-store builds).
const LEGACY_TOKEN_KEY = 'busgo.token';
const LEGACY_REFRESH_TOKEN_KEY = 'busgo.refresh-token';
export const USER_KEY = 'busgo.user';

let migrated = false;

async function migrateLegacyTokens(): Promise<void> {
  if (migrated) return;
  migrated = true;
  try {
    const [legacyToken, legacyRefresh] = await Promise.all([
      AsyncStorage.getItem(LEGACY_TOKEN_KEY),
      AsyncStorage.getItem(LEGACY_REFRESH_TOKEN_KEY),
    ]);
    if (legacyToken && !(await SecureStore.getItemAsync(SECURE_TOKEN_KEY))) {
      await SecureStore.setItemAsync(SECURE_TOKEN_KEY, legacyToken);
    }
    if (legacyRefresh && !(await SecureStore.getItemAsync(SECURE_REFRESH_KEY))) {
      await SecureStore.setItemAsync(SECURE_REFRESH_KEY, legacyRefresh);
    }
    if (legacyToken || legacyRefresh) {
      await AsyncStorage.multiRemove([LEGACY_TOKEN_KEY, LEGACY_REFRESH_TOKEN_KEY]);
    }
  } catch {
    // Migration must never block auth; worst case the user signs in again.
  }
}

export async function getAccessToken(): Promise<string | null> {
  await migrateLegacyTokens();
  try { return await SecureStore.getItemAsync(SECURE_TOKEN_KEY); } catch { return null; }
}

export async function getRefreshToken(): Promise<string | null> {
  await migrateLegacyTokens();
  try { return await SecureStore.getItemAsync(SECURE_REFRESH_KEY); } catch { return null; }
}

export async function setTokens(accessToken: string, refreshToken?: string | null): Promise<void> {
  await SecureStore.setItemAsync(SECURE_TOKEN_KEY, accessToken);
  if (refreshToken) await SecureStore.setItemAsync(SECURE_REFRESH_KEY, refreshToken);
}

export async function clearTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(SECURE_TOKEN_KEY).catch(() => {}),
    SecureStore.deleteItemAsync(SECURE_REFRESH_KEY).catch(() => {}),
    AsyncStorage.multiRemove([LEGACY_TOKEN_KEY, LEGACY_REFRESH_TOKEN_KEY, USER_KEY]).catch(() => {}),
  ]);
}
