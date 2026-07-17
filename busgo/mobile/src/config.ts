import Constants from 'expo-constants';

/**
 * Where the BusGo backend (Kong gateway) lives.
 *
 * Resolution order:
 *  1. EXPO_PUBLIC_API_URL env var (set it when starting:
 *     `EXPO_PUBLIC_API_URL=http://192.168.0.10:18085 npx expo start`)
 *  2. Auto-detect: in Expo Go the dev-server host (your PC's LAN IP) is known,
 *     so we reuse that IP with the Kong port 18085. This means it "just works"
 *     when your phone and PC are on the same Wi-Fi.
 *  3. Fallback: localhost (only works on emulators with port forwarding).
 */
const KONG_PORT: number = Constants.expoConfig?.extra?.kongPort ?? 18085;

function detectDevHostIp(): string | null {
  // e.g. "192.168.0.10:8081" while running through the Expo dev server
  const hostUri: string | undefined =
    Constants.expoConfig?.hostUri ?? (Constants as any).manifest2?.extra?.expoGo?.debuggerHost;
  if (!hostUri) return null;
  const host = hostUri.split(':')[0];
  return host || null;
}

export function apiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const ip = detectDevHostIp();
  if (ip) return `http://${ip}:${KONG_PORT}`;
  return `http://localhost:${KONG_PORT}`;
}

export const API_URL = apiBaseUrl();
