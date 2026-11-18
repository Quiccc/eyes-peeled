import { describe, expect, it } from 'vitest';

import { parseTrustProxy } from '../src/app';
import { loadEnv } from '../src/env';

const prod = {
  NODE_ENV: 'production',
  JWT_SECRET: 'a'.repeat(40),
  FILE_URL_SECRET: 'b'.repeat(40),
  ANTHROPIC_API_KEY: 'sk-ant-real',
  REVENUECAT_SECRET_KEY: 'sk_live',
  REVENUECAT_WEBHOOK_AUTH: 'Bearer real',
  AUTH_DEV_LOGIN: 'true',
};

describe('loadEnv in production', () => {
  it('accepts a complete config and forces dev login off', () => {
    expect(loadEnv(prod).AUTH_DEV_LOGIN).toBe(false);
  });

  it('refuses to start without ANTHROPIC_API_KEY instead of judging photos at random', () => {
    expect(() => loadEnv({ ...prod, ANTHROPIC_API_KEY: '' })).toThrow(/ANTHROPIC_API_KEY/);
  });

  it('refuses placeholder secrets from .env.example', () => {
    expect(() => loadEnv({ ...prod, JWT_SECRET: 'change-me-dev-jwt-secret-at-least-32-chars' })).toThrow(/JWT_SECRET/);
  });

  it('defaults to Claude Haiku and a 0.7 pass threshold', () => {
    expect(loadEnv(prod)).toMatchObject({ VERIFY_MODEL: 'claude-haiku-5-5', VERIFY_MIN_CONFIDENCE: 0.7 });
  });

  it('requires the RevenueCat keys', () => {
    expect(() => loadEnv({ ...prod, REVENUECAT_SECRET_KEY: '' })).toThrow(/REVENUECAT_SECRET_KEY/);
  });

  it('allows the stub verifier and placeholders outside production', () => {
    expect(() => loadEnv({ ...prod, NODE_ENV: 'development', ANTHROPIC_API_KEY: '', JWT_SECRET: 'change-me-dev-jwt-secret-at-least-32-chars' })).not.toThrow();
  });
});

describe('parseTrustProxy', () => {
  it('parses booleans, hop counts and subnet lists', () => {
    expect(parseTrustProxy('true')).toBe(true);
    expect(parseTrustProxy('false')).toBe(false);
    expect(parseTrustProxy('1')).toBe(1);
    expect(parseTrustProxy('loopback, 10.0.0.0/8')).toBe('loopback, 10.0.0.0/8');
  });
});
