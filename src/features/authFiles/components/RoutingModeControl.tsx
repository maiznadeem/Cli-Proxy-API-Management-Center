import { useTranslation } from 'react-i18next';
import type { RoutingMode } from '@/types';
import { ROUTING_MODES } from '@/features/authFiles/routingMode';
import styles from './RoutingModeControl.module.scss';

export type RoutingModeControlProps = {
  value: RoutingMode;
  disabled?: boolean;
  /** Account name, used in the accessible label. */
  name: string;
  onChange: (mode: RoutingMode) => void;
  className?: string;
};

/** Compact Normal / Preserve / Focus segmented control. Each option explains itself on hover. */
export function RoutingModeControl(props: RoutingModeControlProps) {
  const { value, disabled = false, name, onChange, className } = props;
  const { t } = useTranslation();

  return (
    <div
      role="radiogroup"
      aria-label={t('auth_files.routing_mode.aria_label', { name })}
      className={[styles.control, className].filter(Boolean).join(' ')}
    >
      <span className={styles.label} aria-hidden="true">
        {t('auth_files.routing_mode.label')}
      </span>
      {ROUTING_MODES.map((mode) => {
        const active = value === mode;
        return (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={active}
            className={`${styles.option} ${active ? styles.optionActive : ''}`}
            data-mode={mode}
            title={t(`auth_files.routing_mode.${mode}_hint`)}
            disabled={disabled}
            onClick={() => {
              if (!active) onChange(mode);
            }}
          >
            {t(`auth_files.routing_mode.${mode}`)}
          </button>
        );
      })}
    </div>
  );
}
