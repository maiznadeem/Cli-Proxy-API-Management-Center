import { describe, expect, test } from 'bun:test';
import { QUOTA_ADAPTERS } from '@/features/quota/providers';
import type { AuthFileItem } from '@/types';
import { isCredentialSignedOut, requireSignedIn } from '@/utils/quota/errors';

const t = ((key: string) => key) as never;
const file = (fields: Partial<AuthFileItem>) =>
  ({ name: 'claude-a.json', type: 'claude', ...fields }) as AuthFileItem;

// A dead refresh token makes the proxy call the provider with no token, which
// Anthropic answers with 429. The card must say "sign in again", not "retry later".
describe('signed-out credentials', () => {
  test('the proxy verdict is recognized', () => {
    expect(
      isCredentialSignedOut(
        file({
          status: 'error',
          unavailable: true,
          statusMessage: 'unauthorized (refresh token invalid)',
        })
      )
    ).toBe(true);
    expect(
      isCredentialSignedOut(file({ status: 'error', statusMessage: 'OAuth token revoked' }))
    ).toBe(true);
    expect(isCredentialSignedOut(file({ status: 'active', statusMessage: 'ok' }))).toBe(false);
    expect(isCredentialSignedOut(file({ status: 'error', statusMessage: 'quota exhausted' }))).toBe(
      false
    );
  });

  test('the fetch is skipped and fails as signed out', async () => {
    let called = false;
    const fetch = requireSignedIn(async () => {
      called = true;
      return 'data';
    });
    const error = await fetch(
      file({ status: 'error', statusMessage: 'unauthorized (refresh token invalid)' }),
      t
    ).catch((err: unknown) => err as { status?: number; failure?: { kind: string } });
    expect(called).toBe(false);
    expect(error).toMatchObject({ status: 401, failure: { kind: 'signed_out' } });
    expect(await fetch(file({ status: 'active' }), t)).toBe('data');
  });

  test('every locale explains it', async () => {
    for (const locale of ['en', 'ko', 'ru', 'vi', 'zh-CN', 'zh-TW', 'tr']) {
      const data = await Bun.file(`src/i18n/locales/${locale}.json`).json();
      expect(data.common.quota_failure_signed_out).toBeTruthy();
    }
  });

  test('a Claude usage 429 with a profile 401 reads as signed out', async () => {
    const source = await Bun.file('src/features/quota/providers/claude/data.ts').text();
    expect(source).toContain('profileResult.value.statusCode === 401');
    expect(source).toContain("t('common.quota_failure_signed_out')");
  });

  test('cards show the sign-out without the "failed to load" prefix', async () => {
    for (const path of [
      'src/features/quota/components/QuotaCard.tsx',
      'src/features/authFiles/components/AuthFileQuotaSection.tsx',
    ]) {
      expect(await Bun.file(path).text()).toContain("quota?.failure?.kind === 'signed_out'");
    }
  });

  test('every adapter is guarded', async () => {
    const dead = file({ status: 'error', statusMessage: 'unauthorized (refresh token invalid)' });
    for (const adapter of Object.values(QUOTA_ADAPTERS)) {
      const error = await adapter
        .fetchQuota(dead, t)
        .catch((err: unknown) => err as { failure?: { kind: string } });
      expect(error).toMatchObject({ failure: { kind: 'signed_out' } });
    }
  });
});
