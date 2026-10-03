import { useTranslation } from 'react-i18next';
import type { RoutingMode } from '@/types';
import styles from './RoutingModeBadge.module.scss';

/** "Preserved" (muted) or "Focused" (accent) pill. Renders nothing for normal. */
export function RoutingModeBadge({ mode }: { mode: RoutingMode }) {
  const { t } = useTranslation();
  if (mode === 'normal') return null;
  return (
    <span
      className={`${styles.badge} ${mode === 'focus' ? styles.focused : styles.preserved}`}
      title={t(`auth_files.routing_mode.${mode}_hint`)}
    >
      {t(
        mode === 'focus'
          ? 'auth_files.routing_mode.badge_focused'
          : 'auth_files.routing_mode.badge_preserved'
      )}
    </span>
  );
}
