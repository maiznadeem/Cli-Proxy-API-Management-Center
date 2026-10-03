import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import { useAuthStore } from '@/stores';
import { useHeaderRefresh } from '@/hooks/useHeaderRefresh';
import { formatCompactNumber, formatDateValue, formatPercent } from '@/utils/format';
import { useDashboardOverview } from './hooks/useDashboardOverview';
import { Meter } from './components/Meter';
import { Sparkline } from './components/Sparkline';
import { ThroughputChart } from './components/ThroughputChart';
import { TONE_COLORS, providerLabel, splitWindowMinutes, toneForSuccessRate } from './utils';
import styles from './dashboard.module.scss';

const DASH = '—';

/** 大数字：六位以内用千分位，再往上压缩，避免撑破排版 */
const formatHeadline = (value: number): string =>
  value < 100_000 ? value.toLocaleString() : formatCompactNumber(value);

export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const serverVersion = useAuthStore((state) => state.serverVersion);
  const serverBuildDate = useAuthStore((state) => state.serverBuildDate);
  const checkAuth = useAuthStore((state) => state.checkAuth);

  const { connectionStatus, connected, config, counts, traffic, providers, credentials, refresh } =
    useDashboardOverview();

  useHeaderRefresh(refresh, connected);

  const [retrying, setRetrying] = useState(false);
  const connecting = connectionStatus === 'connecting';

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await checkAuth();
    } finally {
      setRetrying(false);
    }
  };

  const windowLabel = useMemo(() => {
    if (traffic.windowMinutes <= 0) return null;
    const { hours, minutes } = splitWindowMinutes(traffic.windowMinutes);
    if (hours === 0) return t('dashboard.window_m', { minutes });
    if (minutes === 0) return t('dashboard.window_h', { hours });
    return t('dashboard.window_hm', { hours, minutes });
  }, [traffic.windowMinutes, t]);

  const routingStrategy = useMemo(() => {
    const raw = config?.routingStrategy?.trim() ?? '';
    if (!raw) return DASH;
    if (raw === 'round-robin') return t('basic_settings.routing_strategy_round_robin');
    if (raw === 'weighted-round-robin') {
      return t('basic_settings.routing_strategy_weighted_round_robin');
    }
    if (raw === 'fill-first') return t('basic_settings.routing_strategy_fill_first');
    if (raw === 'soonest-reset') return t('basic_settings.routing_strategy_soonest_reset');
    return raw;
  }, [config?.routingStrategy, t]);

  const unknownProviderLabel = t('dashboard.provider_unknown');
  const successRateTone = toneForSuccessRate(traffic.successRate);

  /* 摘要行：版本、连接状态、凭证数、模型数；细竖线分隔，没有中点 */
  const summaryItems: Array<{ key: string; content: ReactNode }> = [];
  const trimmedVersion = serverVersion?.trim() ?? '';
  if (trimmedVersion) {
    summaryItems.push({ key: 'version', content: `v${trimmedVersion.replace(/^[vV]+/, '')}` });
  }
  summaryItems.push({
    key: 'connection',
    content: t(
      connected
        ? 'common.connected_status'
        : connecting
          ? 'common.connecting_status'
          : 'common.disconnected_status'
    ),
  });
  if (connected && credentials) {
    summaryItems.push({
      key: 'credentials',
      content: t('dashboard.summary_credentials', { count: credentials.total }),
    });
  }
  if (connected && counts.models !== null) {
    summaryItems.push({
      key: 'models',
      content: t('dashboard.summary_models', { count: counts.models }),
    });
  }

  const runtimeRows: Array<{ label: string; value: string; mono?: boolean }> = [
    { label: t('dashboard.runtime_routing'), value: routingStrategy },
    {
      label: t('dashboard.runtime_retry'),
      value: config ? String(config.requestRetry ?? 0) : DASH,
    },
    {
      label: t('dashboard.runtime_management_keys'),
      value: counts.managementKeys === null ? DASH : counts.managementKeys.toLocaleString(),
    },
    {
      label: t('dashboard.runtime_provider_keys'),
      value: counts.providerKeys === null ? DASH : counts.providerKeys.toLocaleString(),
    },
    { label: t('dashboard.runtime_version'), value: trimmedVersion || DASH },
    {
      label: t('dashboard.runtime_build'),
      value: formatDateValue(serverBuildDate, i18n.language) || DASH,
    },
    { label: t('dashboard.runtime_proxy'), value: config?.proxyUrl?.trim() || DASH, mono: true },
  ];

  const runtimeToggles = config
    ? [
        { label: t('dashboard.runtime_debug'), on: Boolean(config.debug) },
        { label: t('dashboard.runtime_file_logging'), on: Boolean(config.loggingToFile) },
        { label: t('dashboard.runtime_request_log'), on: Boolean(config.requestLog) },
        { label: t('dashboard.runtime_ws_auth'), on: Boolean(config.wsAuth) },
        { label: t('dashboard.runtime_model_prefix'), on: Boolean(config.forceModelPrefix) },
      ]
    : [];

  const credentialRows = credentials
    ? [
        {
          key: 'active',
          label: t('dashboard.health_active'),
          count: credentials.active,
          swatch: styles.healthActive,
        },
        {
          key: 'unavailable',
          label: t('dashboard.health_unavailable'),
          count: credentials.unavailable,
          swatch: styles.healthUnavailable,
        },
        {
          key: 'disabled',
          label: t('dashboard.health_disabled'),
          count: credentials.disabled,
          swatch: styles.healthDisabled,
        },
      ]
    : [];

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t('dashboard.title')}</h1>
        <p className={styles.meta}>
          {summaryItems.map((item, index) => (
            <Fragment key={item.key}>
              {index > 0 && <span className={styles.metaSep} aria-hidden="true" />}
              <span>{item.content}</span>
            </Fragment>
          ))}
        </p>
      </header>

      {/* ---------- Traffic ---------- */}
      <section className={styles.panel} aria-labelledby="overview-traffic-title">
        <div className={styles.trafficHead}>
          <h2 id="overview-traffic-title" className={styles.panelTitle}>
            {windowLabel
              ? t('dashboard.traffic_title', { window: windowLabel })
              : t('dashboard.traffic_title_idle')}
          </h2>
          {connected && (
            <dl className={styles.figures}>
              <div className={styles.figure}>
                <dt className={styles.figureCaption}>{t('dashboard.figure_requests')}</dt>
                <dd className={styles.figureValue}>{formatHeadline(traffic.total)}</dd>
              </div>
              <div className={styles.figure}>
                <dt className={styles.figureCaption}>{t('dashboard.figure_success_rate')}</dt>
                <dd className={styles.figureValue}>
                  <span
                    className={styles.statusDot}
                    style={{ background: TONE_COLORS[successRateTone] }}
                    aria-hidden="true"
                  />
                  {traffic.successRate === null ? DASH : formatPercent(traffic.successRate)}
                </dd>
              </div>
            </dl>
          )}
        </div>

        {connected ? (
          <ThroughputChart traffic={traffic} />
        ) : (
          <div className={styles.offline}>
            <p className={styles.emptyNote}>
              {connecting ? t('dashboard.traffic_connecting') : t('dashboard.traffic_offline')}
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void handleRetry()}
              loading={retrying || connecting}
            >
              {t('dashboard.retry')}
            </Button>
          </div>
        )}
      </section>

      <div className={styles.row}>
        {/* ---------- Providers ---------- */}
        <section className={styles.panel} aria-labelledby="overview-providers-title">
          <h2 id="overview-providers-title" className={styles.panelTitle}>
            {t('dashboard.providers_title')}
          </h2>
          {!connected || providers.length === 0 ? (
            <p className={styles.emptyNote}>{t('dashboard.providers_empty')}</p>
          ) : (
            <Table className={styles.providerTable}>
              <TableHeader>
                <tr>
                  <TableHead scope="col">{t('dashboard.col_provider')}</TableHead>
                  <TableHead scope="col" alignRight>
                    {t('dashboard.col_credentials')}
                  </TableHead>
                  <TableHead scope="col" alignRight>
                    {t('dashboard.col_requests')}
                  </TableHead>
                  <TableHead scope="col" alignRight>
                    {t('dashboard.success_rate')}
                  </TableHead>
                  <TableHead scope="col">{t('dashboard.col_trend')}</TableHead>
                </tr>
              </TableHeader>
              <TableBody>
                {providers.map((provider) => {
                  const name = providerLabel(provider.id, unknownProviderLabel);
                  return (
                    <TableRow key={provider.id}>
                      <TableCell className={styles.providerName}>{name}</TableCell>
                      <TableCell alignRight>{provider.credentials.toLocaleString()}</TableCell>
                      <TableCell alignRight>{provider.total.toLocaleString()}</TableCell>
                      <TableCell alignRight>
                        <span className={styles.rateCell}>
                          <span>
                            {provider.successRate === null
                              ? DASH
                              : formatPercent(provider.successRate)}
                          </span>
                          <Meter
                            value={provider.successRate}
                            ariaLabel={t('dashboard.provider_success_label', { provider: name })}
                            className={styles.rateMeter}
                          />
                        </span>
                      </TableCell>
                      <TableCell className={styles.trendCell}>
                        <Sparkline
                          points={provider.buckets.map((bucket) => bucket.success + bucket.failed)}
                          ariaLabel={t('dashboard.provider_trend_label', { provider: name })}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </section>

        {/* ---------- Credentials ---------- */}
        <section className={styles.panel} aria-labelledby="overview-credentials-title">
          <h2 id="overview-credentials-title" className={styles.panelTitle}>
            {t('dashboard.credentials_title')}
          </h2>
          {!connected || !credentials || credentials.total === 0 ? (
            <p className={styles.emptyNote}>{t('dashboard.credentials_empty')}</p>
          ) : (
            <>
              <div className={styles.healthBar} aria-hidden="true">
                {credentialRows
                  .filter((row) => row.count > 0)
                  .map((row) => (
                    <span
                      key={row.key}
                      className={`${styles.healthSegment} ${row.swatch}`}
                      style={{ flexGrow: row.count }}
                    />
                  ))}
              </div>
              <ul className={styles.list}>
                {credentialRows.map((row) => (
                  <li key={row.key} className={styles.listRow}>
                    <span className={styles.listLabel}>
                      <i className={`${styles.swatch} ${row.swatch}`} aria-hidden="true" />
                      {row.label}
                    </span>
                    <span className={styles.listValue}>{row.count.toLocaleString()}</span>
                  </li>
                ))}
              </ul>
              <h3 className={styles.subTitle}>{t('dashboard.health_by_type')}</h3>
              <ul className={styles.typeList}>
                {credentials.byType.map((entry) => (
                  <li key={entry.type} className={styles.listRow}>
                    <span className={styles.listLabel}>
                      {providerLabel(entry.type, unknownProviderLabel)}
                    </span>
                    <span className={styles.listValue}>{entry.count.toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className={styles.panelFooter}>
            <Link to="/auth-files" className={`btn btn-ghost btn-sm ${styles.footerLink}`}>
              {t('dashboard.credentials_link')}
            </Link>
          </div>
        </section>
      </div>

      {/* ---------- Runtime ---------- */}
      <section className={styles.panel} aria-labelledby="overview-runtime-title">
        <h2 id="overview-runtime-title" className={styles.panelTitle}>
          {t('dashboard.runtime_title')}
        </h2>
        {!connected || !config ? (
          <p className={styles.emptyNote}>{t('dashboard.runtime_empty')}</p>
        ) : (
          <>
            <dl className={styles.specList}>
              {runtimeRows.map((row) => (
                <div key={row.label} className={styles.specRow}>
                  <dt className={styles.specLabel}>{row.label}</dt>
                  <dd className={`${styles.specValue} ${row.mono ? styles.specMono : ''}`}>
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
            <ul className={styles.toggleList}>
              {runtimeToggles.map((toggle) => (
                <li key={toggle.label} className={styles.toggleItem}>
                  <span
                    className={`${styles.toggleDot} ${toggle.on ? styles.toggleOn : ''}`}
                    aria-hidden="true"
                  />
                  {toggle.label}
                  <span className={styles.srOnly}>
                    {toggle.on ? t('dashboard.toggle_on') : t('dashboard.toggle_off')}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
        <div className={styles.panelFooter}>
          <Link to="/config" className={`btn btn-ghost btn-sm ${styles.footerLink}`}>
            {t('dashboard.runtime_link')}
          </Link>
        </div>
      </section>
    </div>
  );
}
