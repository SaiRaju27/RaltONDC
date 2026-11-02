import { Platform } from 'react-native';
import Constants from 'expo-constants';

export interface AppEnvironmentConfig {
  apiUrl: string;
  wsUrl: string;
  isProduction: boolean;
  environmentName: 'production' | 'development' | 'test';
}

/**
 * Determines whether the current execution context is Production.
 * Checks:
 * 1. Process environment overrides (EXPO_PUBLIC_ENV or NODE_ENV)
 * 2. Standalone Expo / EAS application ownership (production release APK/IPA)
 * 3. React Native __DEV__ global flag (false in production release bundles)
 */
export function isProductionEnvironment(): boolean {
  if (typeof process !== 'undefined') {
    if (process.env?.EXPO_PUBLIC_ENV === 'production' || process.env?.NODE_ENV === 'production') {
      return true;
    }
    if (process.env?.EXPO_PUBLIC_ENV === 'development' || process.env?.NODE_ENV === 'development') {
      return false;
    }
  }

  // Standalone release APK/IPA build
  if ((Constants as any)?.executionEnvironment === 'standalone') {
    return true;
  }

  // React Native production release builds disable __DEV__
  if (typeof __DEV__ !== 'undefined' && __DEV__ === false) {
    return true;
  }

  return false;
}

/**
 * Resolves the Backend REST API Base URL dynamically:
 * - Production: 'https://ralt.in'
 * - Local Development:
 *    • Expo Web: window.location.hostname:5001 or localhost:5001
 *    • Android Emulator: 10.0.2.2:5001 (host machine loopback)
 *    • iOS Simulator: localhost:5001
 *    • Expo Go / Physical Device: Metro Host URI IP (e.g. 192.168.x.x:5001)
 */
export function resolveApiUrl(): string {
  // 1. Explicit env variable override (highest priority)
  if (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '');
  }

  // 2. Production Build (Standalone APK, iOS release, or prod web)
  if (isProductionEnvironment()) {
    return 'https://ralt.in';
  }

  // 3. Local Development in Web Browser
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.hostname) {
    const isLocalhost =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.endsWith('.local');
    if (isLocalhost) {
      return `${window.location.protocol}//${window.location.hostname}:5001`;
    }
    return window.location.origin.replace(/\/$/, '');
  }

  // 4. Local Development on Mobile (Expo Go, Emulator, Simulator)
  const hostUri =
    Constants?.expoConfig?.hostUri ||
    (Constants as any)?.manifest2?.extra?.expoGo?.debuggerHost ||
    (Constants as any)?.manifest?.debuggerHost;

  if (hostUri) {
    const ip = hostUri.split(':')[0];
    return `http://${ip}:5001`;
  }

  // 5. Android Emulator loopback fallback
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:5001';
  }

  // 6. iOS Simulator / Default local fallback
  return 'http://localhost:5001';
}

/**
 * Resolves the WebSocket URL dynamically based on the resolved API URL:
 * - https://ralt.in -> wss://ralt.in/ws?riderId=...
 * - http://10.0.2.2:5001 -> ws://10.0.2.2:5001/ws?riderId=...
 * - http://localhost:5001 -> ws://localhost:5001/ws?riderId=...
 */
export function resolveWsUrl(riderId: string = 'RALT-RIDER-001', customApiUrl?: string): string {
  const apiUrl = (customApiUrl || resolveApiUrl()).replace(/\/$/, '');
  const cleanId = encodeURIComponent(riderId || 'RALT-RIDER-001');

  try {
    const url = new URL(apiUrl);
    const wsProto = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${wsProto}//${url.host}/ws?riderId=${cleanId}`;
  } catch {
    if (apiUrl.startsWith('https://')) {
      const host = apiUrl.replace(/^https:\/\//, '').replace(/\/.*$/, '');
      return `wss://${host}/ws?riderId=${cleanId}`;
    }
    const host = apiUrl.replace(/^http:\/\//, '').replace(/\/.*$/, '');
    return `ws://${host}/ws?riderId=${cleanId}`;
  }
}

/**
 * Returns full environment configuration
 */
export function getAppConfig(): AppEnvironmentConfig {
  const isProd = isProductionEnvironment();
  const apiUrl = resolveApiUrl();
  return {
    apiUrl,
    wsUrl: resolveWsUrl('RALT-RIDER-001', apiUrl),
    isProduction: isProd,
    environmentName: isProd ? 'production' : (process.env?.NODE_ENV === 'test' ? 'test' : 'development'),
  };
}

