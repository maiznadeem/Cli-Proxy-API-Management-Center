import { useTranslation } from 'react-i18next';
import type { ConfigEditorMode } from '../constants';
import styles from './ModeSwitch.module.scss';

export type ModeSwitchProps = {
  mode: ConfigEditorMode;
  disabled?: boolean;
  onChange: (mode: ConfigEditorMode) => void;
};

/**
 * Visual / source segmented control. Source mode is another view of the whole document
 * (not a ninth section), so it sits with the page controls in the header, not in the tabs.
 */
export function ModeSwitch({ mode, disabled = false, onChange }: ModeSwitchProps) {
  const { t } = useTranslation();

  return (
    <div className={styles.segmented} role="group" aria-label={t('config_management.mode.label')}>
      <button
        type="button"
        className={`${styles.segment} ${mode === 'visual' ? styles.segmentActive : ''}`}
        aria-pressed={mode === 'visual'}
        disabled={disabled}
        onClick={() => onChange('visual')}
      >
        {t('config_management.mode.visual')}
      </button>
      <button
        type="button"
        className={`${styles.segment} ${mode === 'source' ? styles.segmentActive : ''}`}
        aria-pressed={mode === 'source'}
        disabled={disabled}
        onClick={() => onChange('source')}
      >
        {t('config_management.mode.source')}
      </button>
    </div>
  );
}
