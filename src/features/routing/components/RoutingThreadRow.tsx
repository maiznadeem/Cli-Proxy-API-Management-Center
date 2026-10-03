import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { formatLatency, formatRelative, statusTone } from '../model/format';
import { Button } from '@/components/ui/Button';
import { IconChevronDown, IconDownload } from '@/components/ui/icons';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import { accountLabel, type RoutingEvent, type RoutingThread } from '../model/parseRoutingLines';
import styles from './RoutingThreadRow.module.scss';

export interface RoutingThreadRowProps {
  thread: RoutingThread;
  expanded: boolean;
  onToggle: (session: string) => void;
  now: number;
  locale?: string;
  downloadingId: string | null;
  onDownload: (requestId: string) => void;
}

export function RoutingThreadRow(props: RoutingThreadRowProps) {
  const { thread, expanded, onToggle, now, locale, downloadingId, onDownload } = props;
  const { t } = useTranslation();
  const panelId = useId();
  const clientLabel =
    thread.client.kind === 'other'
      ? thread.client.prefix
      : t(`routing.client_${thread.client.kind}`);
  const lastSeen = new Date(thread.lastSeenMs);

  const formatTime = (event: RoutingEvent) => {
    const date = new Date(event.timestampMs);
    const sameDay = date.toDateString() === new Date(now).toDateString();
    return date.toLocaleString(locale, {
      ...(sameDay ? {} : { month: '2-digit', day: '2-digit' }),
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <li className={styles.thread} data-expanded={expanded || undefined}>
      <div className={styles.ribbon}>
        <div className={styles.identity}>
          <span className={styles.client}>{clientLabel}</span>
          <span className={styles.session} title={thread.session}>
            {thread.session}
          </span>
        </div>

        <div className={styles.facts}>
          <span className={styles.account} title={thread.lastAuth}>
            <span
              className={styles.dot}
              data-tone={thread.switched ? 'watch' : 'plenty'}
              role="img"
              aria-label={
                thread.switched ? t('routing.thread_switched') : t('routing.thread_single')
              }
            />
            <span className={styles.accountLabel}>{accountLabel(thread.lastAuth)}</span>
          </span>
          <span className={styles.count}>
            {t('routing.thread_requests', { count: thread.events.length })}
          </span>
          {thread.models.length > 0 && (
            <span className={styles.models} title={thread.models.join(', ')}>
              {thread.models.join(', ')}
            </span>
          )}
          <time
            className={styles.lastSeen}
            dateTime={lastSeen.toISOString()}
            title={lastSeen.toLocaleString(locale)}
          >
            {formatRelative(t, now, thread.lastSeenMs)}
          </time>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className={styles.iconButton}
          aria-expanded={expanded}
          aria-controls={panelId}
          aria-label={expanded ? t('routing.collapse') : t('routing.expand')}
          title={expanded ? t('routing.collapse') : t('routing.expand')}
          onClick={() => onToggle(thread.session)}
        >
          <IconChevronDown size={16} aria-hidden="true" className={styles.chevron} />
        </Button>
      </div>

      {expanded && (
        <div id={panelId} className={styles.detail}>
          <Table className={styles.table}>
            <TableHeader>
              <TableRow>
                <TableHead>{t('routing.col_time')}</TableHead>
                <TableHead>{t('routing.col_event')}</TableHead>
                <TableHead>{t('routing.col_account')}</TableHead>
                <TableHead>{t('routing.col_model')}</TableHead>
                <TableHead>{t('routing.col_status')}</TableHead>
                <TableHead alignRight>{t('routing.col_latency')}</TableHead>
                <TableHead>{t('routing.col_request')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {thread.events.map((event, index) => (
                <TableRow key={`${event.requestId}-${event.timestampMs}-${index}`}>
                  <TableCell className={styles.num}>{formatTime(event)}</TableCell>
                  <TableCell>
                    <span className={styles.event} title={event.message}>
                      <span className={styles.eventDot} data-kind={event.kind} aria-hidden="true" />
                      {t(`routing.event_${event.kind}`)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={styles.cellAccount} title={event.auth}>
                      {accountLabel(event.auth)}
                    </span>
                  </TableCell>
                  <TableCell className={styles.cellModel}>{event.model}</TableCell>
                  <TableCell>
                    <span
                      className={styles.status}
                      data-tone={statusTone(event.status)}
                      title={event.path ? `${event.method ?? ''} ${event.path}`.trim() : undefined}
                    >
                      {event.status ?? t('routing.status_pending')}
                    </span>
                  </TableCell>
                  <TableCell alignRight className={styles.num}>
                    {formatLatency(event.latencyMs)}
                  </TableCell>
                  <TableCell>
                    <span className={styles.requestId}>
                      <span className={styles.mono}>{event.requestId}</span>
                      {event.requestId !== '--------' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className={styles.iconButton}
                          aria-label={`${t('routing.download_request')} ${event.requestId}`}
                          title={t('routing.download_request')}
                          loading={downloadingId === event.requestId}
                          disabled={downloadingId !== null}
                          onClick={() => onDownload(event.requestId)}
                        >
                          <IconDownload size={14} aria-hidden="true" />
                        </Button>
                      )}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </li>
  );
}
