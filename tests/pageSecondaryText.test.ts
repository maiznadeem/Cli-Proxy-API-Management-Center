// Secondary text on the dashboard, system, logs and plugins pages and the main layout:
// definitions live in InfoTips after their labels, restating subtitles and descriptions are
// gone, and warnings / destructive-action notes stay visible. Static markup and source
// contracts only; hover, focus and tap behaviour and the visual layout need a browser.

import { afterAll, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import i18n from '../src/i18n/index';
import { DashboardPage } from '../src/features/dashboard/DashboardPage';
import { SystemPage } from '../src/pages/SystemPage';

// Injected by Vite at build time; the system page reads it during render.
(globalThis as { __APP_VERSION__?: string }).__APP_VERSION__ = '0.0.0-test';

const initialLanguage = i18n.language;
afterAll(async () => {
  await i18n.changeLanguage(initialLanguage);
});

const renderPage = (component: () => ReturnType<typeof createElement> | null) =>
  renderToStaticMarkup(createElement(MemoryRouter, null, createElement(component)));
const infoTipNames = (html: string) =>
  (html.match(/<button\b[^>]*data-info-tip=""[^>]*>/g) ?? []).map(
    (tag) => tag.match(/aria-label="([^"]*)"/)?.[1]
  );
const read = (path: string) => readFileSync(path, 'utf8');

const stripSvg = (html: string) => html.replace(/<svg\b[\s\S]*?<\/svg>/g, '<svg/>');

describe('dashboard', () => {
  test('the page header is the title and connection state alone; no stat captions or InfoTips', async () => {
    await i18n.changeLanguage('en');
    const html = renderPage(DashboardPage);
    expect(html).toMatch(
      new RegExp(
        '^<div><header><h1>' + i18n.t('dashboard.title') + '</h1><p>.*?</p></header><section'
      )
    );
    expect(infoTipNames(html)).toEqual([]);
  });

  test('every panel is a section labelled by its own title, with no subtitle under it', async () => {
    await i18n.changeLanguage('en');
    const html = renderPage(DashboardPage);
    const titles = {
      traffic: i18n.t('dashboard.traffic_title_idle'),
      providers: i18n.t('dashboard.providers_title'),
      credentials: i18n.t('dashboard.credentials_title'),
      runtime: i18n.t('dashboard.runtime_title'),
    };
    for (const [id, title] of Object.entries(titles)) {
      expect(html).toContain('<section aria-labelledby="overview-' + id + '-title">');
      expect(html).toContain('<h2 id="overview-' + id + '-title">' + title + '</h2>');
    }
    expect(read('src/features/dashboard/DashboardPage.tsx')).not.toContain('description:');
  });
});

describe('system page', () => {
  test('the models card explains its two buttons in an InfoTip and a tooltip', async () => {
    await i18n.changeLanguage('en');
    const html = renderPage(SystemPage);
    expect(infoTipNames(html)).toEqual([
      `More information about ${i18n.t('system_info.models_title')}`,
    ]);
    expect(html).toContain(`hidden="">${i18n.t('system_info.models_desc')}</span>`);
    // No native titles on the two model buttons: the catalog hint moved into a Tooltip.
    const actions = html.slice(
      html.indexOf(i18n.t('system_info.models_title')),
      html.indexOf(i18n.t('system_info.models_catalog_refresh_button'))
    );
    expect(actions).not.toMatch(/<button[^>]*title=/);
    expect(html).not.toContain(`title="${i18n.t('system_info.models_catalog_refresh_hint')}"`);
    expect(read('src/pages/SystemPage.tsx')).toMatch(
      /<Tooltip content=\{t\('system_info\.models_catalog_refresh_hint'\)\}>\s*<Button/
    );
  });

  test('quick links are titles only; the destructive clear-login note stays visible', async () => {
    await i18n.changeLanguage('en');
    const html = stripSvg(renderPage(SystemPage));
    const quickLinks = html.slice(html.indexOf(i18n.t('system_info.quick_links_title')));
    const cards = quickLinks.match(/<a href="https:[\s\S]*?<\/a>/g) ?? [];
    expect(cards).toHaveLength(3);
    for (const card of cards) {
      // Only the title, then the external-link icon.
      expect(card).toMatch(/^<a[^>]*><span><span>[^<]+<\/span><\/span><svg\/><\/a>$/);
    }
    // The heading directly precedes the list of links: no description paragraph between them.
    expect(quickLinks).toMatch(/^[^<]*<\/h2><ul><li><a href=/);
    expect(html).toMatch(new RegExp(`<p[^>]*>${i18n.t('system_info.clear_login_desc')}</p>`));
  });
});

describe('logs page', () => {
  const source = read('src/features/logs/LogsPage.tsx');

  test('the error-log caveat is an InfoTip on the tab card title', () => {
    expect(source).toMatch(
      /\{t\('logs\.error_logs_modal_title'\)\}\s*<InfoTip\s+content=\{t\('logs\.error_logs_description'\)\}/
    );
    expect(source).not.toContain(`<div className="hint">{t('logs.error_logs_description')}</div>`);
    // The "request logging is on, so this list stays empty" warning remains visible.
    expect(source).toContain("{t('logs.error_logs_request_log_enabled')}");
  });

  test('the raw-log explanation moved from a title to an InfoTip beside the switch', () => {
    expect(source).not.toMatch(/title=\{t\('logs\.show_raw_logs_hint'/);
    // A sibling of the switch, not inside its <label>.
    expect(source).toMatch(
      /checked=\{showRawLogs\}[\s\S]*?<\/span>\s*\}\s*\/>\s*<InfoTip\s+content=\{t\('logs\.show_raw_logs_hint'/
    );
  });
});

describe('plugins page and install flow', () => {
  test('the page header is the title alone; warnings stay', () => {
    const page = read('src/features/plugins/PluginsPage.tsx');
    // Only the h1 in the header.
    expect(page).toMatch(
      /<header className=\{styles\.header\}>\s*<h1[^>]*>[^<]*<\/h1>\s*<\/header>/
    );
    expect(page).toContain("t('plugin_management.global_disabled_hint')");
    expect(read('src/features/plugins/components/PluginStoreView.tsx')).toContain(
      "t('plugin_store.security_banner_text')"
    );
  });

  test('install-version options keep only the explanations that change the choice', () => {
    const modal = read('src/features/plugins/components/PluginInstallOptionsModal.tsx');
    // "Choose release" only shows a second line while releases are loading.
    expect(modal).toMatch(
      /'release',\s*t\('plugin_store\.install_version_release_mode'\),[\s\S]*?releaseLoading \? t\('plugin_store\.install_versions_loading'\) : null,/
    );
    expect(modal).toContain("t('plugin_store.install_version_latest_hint'");
    expect(modal).toContain("t('plugin_store.install_version_manual_hint')");
  });

  test('the trust gate keeps every risk statement', () => {
    const gate = read('src/features/plugins/components/PluginInstallGateModal.tsx');
    for (const key of [
      'gate_warning',
      'gate_effect_runs_code',
      'gate_effect_no_review',
      'gate_effect_restart',
      'gate_untrusted_alert',
      'gate_step3_prompt',
    ]) {
      expect(gate).toContain(`t('plugin_store.${key}'`);
    }
    // Step 3 is the prompt, the input and the button; nothing restates the prompt below it.
    expect(gate).toMatch(
      /aria-label=\{t\('plugin_store\.gate_step3_prompt', \{ token \}\)\}\s*\/>\s*<\/div>/
    );
  });
});

describe('main layout', () => {
  test('the sidebar brand is the mark and the short name; the full name stays in its title', () => {
    const layout = read('src/components/layout/MainLayout.tsx');
    expect(layout).toMatch(
      /<div className="sidebar-brand" title=\{fullBrandName\}>\s*<BrandMark size=\{24\} className="sidebar-brand-logo" \/>\s*\{showSidebarLabels && <span className="sidebar-brand-title">\{abbrBrandName\}<\/span>\}\s*<\/div>/
    );
  });
});
