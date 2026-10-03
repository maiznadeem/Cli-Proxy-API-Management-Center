import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

// The quota host binds CSS-module classes at import time, which Bun cannot render.
// Keep these source contracts small; browser checks cover the actual card interactions.
const source = readFileSync(
  new URL('../src/features/authFiles/components/AuthFileCard.tsx', import.meta.url),
  'utf8'
);
const styles = readFileSync(
  new URL('../src/features/authFiles/components/AuthFileCard.module.scss', import.meta.url),
  'utf8'
);

describe('auth file card presentation contract', () => {
  test('leads with identity in a decorative provider tile, without duplicate status badges', () => {
    // The ribbon layout shows the provider icon in a 28px tile; it is decorative (alt="").
    expect(source).toContain('<img src={iconSrc} alt="" className={styles.icon} />');
    expect(source).not.toContain('stateBadge');
    expect(source).toContain('<h3');
    expect(source).toContain('{identity.primary}');
    expect(source).toContain('{identity.secondary}');
  });

  test('uses one status-column toggle and credential-specific accessible names', () => {
    const header = source.split('<header')[1].split('</header>')[0];
    const status = source.split('<div className={styles.status}>')[1].split('<footer')[0];
    const footer = source.split('<footer')[1].split('</footer>')[0];
    expect(source.match(/<ToggleSwitch/g)).toHaveLength(1);
    expect(header).not.toContain('<ToggleSwitch');
    expect(footer).not.toContain('<ToggleSwitch');
    expect(header).toContain("ariaLabel={t('auth_files.card_select', { name: file.name })}");
    expect(header).not.toContain('aria-label=');
    expect(status).toContain('<ToggleSwitch');
    expect(status).toContain("t('auth_files.card_toggle', { name: file.name })");
    expect(status).toContain('checked={!file.disabled}');
    expect(status).toContain('statusUpdating[getAuthFileRefreshKey(file)] === true ||');
    expect(status).toContain('isManualRefreshing');
    expect(status).toContain('!isRuntimeOnly &&');
  });

  test('icon-only row actions keep accessible names and tooltips', () => {
    const footer = source.split('<footer')[1].split('</footer>')[0];
    for (const key of [
      'models_button',
      'manual_refresh_button',
      'download_button',
      'prefix_proxy_button',
      'delete_button',
    ]) {
      expect(footer).toContain(`title={t('auth_files.${key}')}`);
      expect(footer).toContain(`aria-label={t('auth_files.${key}')}`);
    }
  });

  test('dims disabled card content but keeps the status and re-enable controls clear', () => {
    expect(source).toContain("file.disabled === true ? styles.cardDisabled : ''");
    expect(styles).toMatch(
      /\.cardDisabled\s*>\s*:not\(\.actions\):not\(\.status\)\s*\{\s*opacity:\s*0\.68;/
    );
    expect(styles).not.toMatch(/\.cardDisabled\s*\{[^}]*opacity:/);
  });

  test('uses a plain-text weight tooltip while preserving the details link', () => {
    expect(source).toContain("title={t('auth_files.weight_tooltip')}");
    expect(source).not.toContain("title={t('auth_files.weight_hint')}");
    const detailsSource = readFileSync(
      new URL('../src/features/authFiles/components/AuthFileDetailsSheet.tsx', import.meta.url),
      'utf8'
    );
    expect(detailsSource).toContain('i18nKey="auth_files.weight_hint"');

    for (const locale of ['en', 'zh-CN', 'zh-TW', 'ru']) {
      const { auth_files: messages } = JSON.parse(
        readFileSync(new URL(`../src/i18n/locales/${locale}.json`, import.meta.url), 'utf8')
      ) as { auth_files: Record<string, string> };
      expect(messages.weight_tooltip).toBeTruthy();
      expect(messages.weight_tooltip).not.toMatch(/<[^>]+>/);
      expect(messages.weight_hint).toContain('<settingsLink>');
      expect(messages.weight_hint).toContain('</settingsLink>');
      expect(messages.weight_tooltip).toBe(messages.weight_hint.replace(/<\/?settingsLink>/g, ''));
    }
  });

  test('retains individual management actions and warning detail', () => {
    for (const handler of [
      'onShowModels(file)',
      'onDownload(file.name)',
      'onManualRefresh(file)',
      'onCooldownReset(file)',
      'onOpenPrefixProxyEditor(file)',
      'onDelete(file.name)',
    ]) {
      expect(source).toContain(handler);
    }
    expect(source).toContain('rawStatusMessage && hasStatusWarning');
    expect(source).toContain('showManualRefreshButton');
    expect(source).toContain('file.disabled ||');
  });
});
