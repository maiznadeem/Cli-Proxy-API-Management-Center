import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { animate } from 'motion/mini';
import { Button } from '@/components/ui/Button';
import { prefersReducedMotion } from '@/hooks/motion';
import { useActionBarHeightVar } from '@/hooks/useActionBarHeightVar';
import type { ConfigStatusTone } from '../uiState';
import styles from './FloatingSaveBar.module.scss';

// --ease-standard, cubic-bezier(.2, .8, .2, 1), and --dur-base (220ms) in seconds.
const EASE_STANDARD = [0.2, 0.8, 0.2, 1] as const;
const DUR_BASE_S = 0.22;
const BASE_TRANSFORM = 'translateX(-50%)';
const HIDDEN_TRANSFORM = 'translateX(-50%) translateY(12px)';

export type FloatingSaveBarProps = {
  /** 有未保存修改时可见（与未保存离开守卫的 block 条件一致）。 */
  visible: boolean;
  statusText: string;
  statusTone: ConfigStatusTone;
  saving: boolean;
  saveDisabled: boolean;
  discardDisabled: boolean;
  onSave: () => void;
  onDiscard: () => void;
};

/**
 * Floating save bar: a raised bar portalled to body, shown only while there are changes.
 * - Slides 12px with a fade over --dur-base on enter and exit, then unmounts;
 * - reduced motion switches to an instant change (translateX(-50%) is kept for centring);
 * - its live height is written to --config-action-bar-height for the page bottom padding.
 */
export function FloatingSaveBar(props: FloatingSaveBarProps) {
  const {
    visible,
    statusText,
    statusTone,
    saving,
    saveDisabled,
    discardDisabled,
    onSave,
    onDiscard,
  } = props;
  const { t } = useTranslation();

  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const animationRef = useRef<ReturnType<typeof animate> | null>(null);
  const visibleRef = useRef(visible);
  const previousVisibleRef = useRef(false);

  useActionBarHeightVar(containerRef, '--config-action-bar-height', mounted);

  useEffect(() => {
    visibleRef.current = visible;
    if (visible) setMounted(true);
  }, [visible]);

  useLayoutEffect(() => {
    if (!mounted) return;
    const el = containerRef.current;
    if (!el) return;
    const wasVisible = previousVisibleRef.current;

    animationRef.current?.stop();
    animationRef.current = null;

    const reduced = prefersReducedMotion();

    if (visible && !wasVisible) {
      if (reduced) {
        el.style.transform = BASE_TRANSFORM;
        el.style.opacity = '1';
      } else {
        animationRef.current = animate(
          el,
          { transform: [HIDDEN_TRANSFORM, BASE_TRANSFORM], opacity: [0, 1] },
          {
            duration: DUR_BASE_S,
            ease: EASE_STANDARD,
            onComplete: () => {
              el.style.transform = BASE_TRANSFORM;
              el.style.opacity = '1';
            },
          }
        );
      }
    } else if (!visible && wasVisible) {
      const finishExit = () => {
        if (!visibleRef.current) setMounted(false);
      };
      if (reduced) {
        el.style.transform = BASE_TRANSFORM;
        finishExit();
      } else {
        animationRef.current = animate(
          el,
          { transform: [BASE_TRANSFORM, HIDDEN_TRANSFORM], opacity: [1, 0] },
          { duration: DUR_BASE_S, ease: EASE_STANDARD, onComplete: finishExit }
        );
      }
    }

    previousVisibleRef.current = visible;
  }, [mounted, visible]);

  useEffect(
    () => () => {
      animationRef.current?.stop();
      animationRef.current = null;
    },
    []
  );

  if (!mounted || typeof document === 'undefined') return null;

  const toneClass: Record<ConfigStatusTone, string> = {
    error: styles.statusError,
    warning: styles.statusWarning,
    busy: styles.statusBusy,
    muted: styles.statusMuted,
    ok: styles.statusOk,
  };

  return createPortal(
    <div className={styles.container} ref={containerRef}>
      <div className={styles.bar} role="group" aria-label={t('config_management.status_dirty')}>
        <span className={`${styles.status} ${toneClass[statusTone]}`} aria-live="polite">
          {statusText}
        </span>
        <div className={styles.actionsGroup}>
          <Button variant="ghost" onClick={onDiscard} disabled={discardDisabled}>
            {t('config_management.actions.discard')}
          </Button>
          <Button variant="primary" onClick={onSave} disabled={saveDisabled} loading={saving}>
            {t('config_management.actions.save')}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
