import { Platform } from 'react-native';
import Constants from 'expo-constants';
import {
  isProductionEnvironment,
  resolveApiUrl,
  resolveWsUrl,
  getAppConfig,
} from '../src/utils/environment';

describe('Environment Configuration Suite', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.EXPO_PUBLIC_API_URL;
    delete process.env.EXPO_PUBLIC_ENV;
    delete (process.env as any).NODE_ENV;
    (Platform as any).OS = 'ios';
    (Constants as any).expoConfig = {};
    (Constants as any).executionEnvironment = 'bare';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('respects explicit EXPO_PUBLIC_API_URL override', () => {
    process.env.EXPO_PUBLIC_API_URL = 'https://custom-api.ralt.in/';
    expect(resolveApiUrl()).toBe('https://custom-api.ralt.in');
  });

  it('detects production via EXPO_PUBLIC_ENV=production', () => {
    process.env.EXPO_PUBLIC_ENV = 'production';
    expect(isProductionEnvironment()).toBe(true);
    expect(resolveApiUrl()).toBe('https://ralt.in');
  });

  it('detects production via NODE_ENV=production', () => {
    process.env.NODE_ENV = 'production';
    expect(isProductionEnvironment()).toBe(true);
    expect(resolveApiUrl()).toBe('https://ralt.in');
  });

  it('detects production via Constants.executionEnvironment = standalone (Release APK/IPA)', () => {
    (Constants as any).executionEnvironment = 'standalone';
    expect(isProductionEnvironment()).toBe(true);
    expect(resolveApiUrl()).toBe('https://ralt.in');
  });

  it('resolves local development URL for Android emulator', () => {
    process.env.NODE_ENV = 'development';
    (Platform as any).OS = 'android';
    (Constants as any).expoConfig = null;
    expect(resolveApiUrl()).toBe('http://10.0.2.2:5001');
  });

  it('resolves local development URL for iOS simulator / default', () => {
    process.env.NODE_ENV = 'development';
    (Platform as any).OS = 'ios';
    (Constants as any).expoConfig = null;
    expect(resolveApiUrl()).toBe('http://localhost:5001');
  });

  it('resolves hostUri from Expo Go on physical device', () => {
    process.env.NODE_ENV = 'development';
    (Constants as any).expoConfig = { hostUri: '192.168.1.55:8081' };
    expect(resolveApiUrl()).toBe('http://192.168.1.55:5001');
  });

  it('resolves local web browser development', () => {
    process.env.NODE_ENV = 'development';
    (Platform as any).OS = 'web';
    (globalThis as any).window = {
      location: {
        hostname: 'localhost',
        protocol: 'http:',
        origin: 'http://localhost:8081',
      },
    };
    expect(resolveApiUrl()).toBe('http://localhost:5001');
  });

  it('resolves production web if not localhost', () => {
    process.env.NODE_ENV = 'development';
    (Platform as any).OS = 'web';
    (globalThis as any).window = {
      location: {
        hostname: 'ralt.in',
        protocol: 'https:',
        origin: 'https://ralt.in',
      },
    };
    expect(resolveApiUrl()).toBe('https://ralt.in');
  });

  it('resolves WebSocket URL to secure wss for production HTTPS', () => {
    const wsUrl = resolveWsUrl('R1', 'https://ralt.in');
    expect(wsUrl).toBe('wss://ralt.in/ws?riderId=R1');
  });

  it('resolves WebSocket URL to ws for local development HTTP', () => {
    const wsUrl = resolveWsUrl('R1', 'http://10.0.2.2:5001');
    expect(wsUrl).toBe('ws://10.0.2.2:5001/ws?riderId=R1');
  });

  it('detects production via global __DEV__ = false', () => {
    (globalThis as any).__DEV__ = false;
    expect(isProductionEnvironment()).toBe(true);
    (globalThis as any).__DEV__ = true;
  });

  it('handles fallback string parsing in resolveWsUrl when URL constructor fails', () => {
    const originalURL = globalThis.URL;
    try {
      (globalThis as any).URL = function () {
        throw new Error('URL constructor failed');
      };
      const wsHttps = resolveWsUrl('R1', 'https://api.test.in/v1');
      expect(wsHttps).toBe('wss://api.test.in/ws?riderId=R1');

      const wsHttp = resolveWsUrl('R1', 'http://localhost:5001/api');
      expect(wsHttp).toBe('ws://localhost:5001/ws?riderId=R1');
    } finally {
      globalThis.URL = originalURL;
    }
  });

  it('handles fallback string parsing in resolveWsUrl', () => {
    const wsHttps = resolveWsUrl('R1', 'https://api.test.in/v1');
    expect(wsHttps.startsWith('wss://')).toBe(true);

    const wsHttp = resolveWsUrl('R1', 'http://localhost:5001/api');
    expect(wsHttp.startsWith('ws://')).toBe(true);
  });

  it('returns complete AppEnvironmentConfig from getAppConfig', () => {
    process.env.EXPO_PUBLIC_ENV = 'production';
    const config = getAppConfig();
    expect(config.isProduction).toBe(true);
    expect(config.apiUrl).toBe('https://ralt.in');
    expect(config.wsUrl).toContain('wss://ralt.in/ws?riderId=');
    expect(config.environmentName).toBe('production');
  });
});
