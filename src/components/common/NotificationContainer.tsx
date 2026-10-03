import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { useNotificationStore } from '@/stores';
import { IconAlertTriangle, IconCheckCircle2, IconInfo, IconX } from '@/components/ui/icons';
import { NOTIFICATION_DURATION_MS } from '@/utils/constants';
import type { Notification } from '@/types';
import { createNotificationTimer } from './notificationTimer';
import styles from './NotificationContainer.module.scss';

interface AnimatedNotification extends Notification {
  isExiting?: boolean;
}

// Matches the exit transition (180ms); each card owns and cleans up its removal timer.
const EXIT_DURATION_MS = 180;

const notificationIcons = {
  success: IconCheckCircle2,
  info: IconInfo,
  warning: IconAlertTriangle,
  error: IconInfo,
};

function NotificationCard({
  notification,
  onExited,
  returnFocusRef,
}: {
  notification: AnimatedNotification;
  onExited: (id: string) => void;
  returnFocusRef: RefObject<HTMLElement | null>;
}) {
  const { t } = useTranslation();
  const removeNotification = useNotificationStore((state) => state.removeNotification);
  const timerRef = useRef<ReturnType<typeof createNotificationTimer> | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLSpanElement>(null);
  const pausesRef = useRef(new Set<string>());
  const { id, type, message, duration = NOTIFICATION_DURATION_MS, isExiting } = notification;
  const Icon = notificationIcons[type];
  const showProgress = duration > 0 && !isExiting;

  // Mirror the timer's pause reasons onto the progress line so it stops exactly when
  // the countdown does (hover, focus, hidden tab).
  const setPaused = useCallback((reason: string, paused: boolean) => {
    timerRef.current?.setPaused(reason, paused);
    const pauses = pausesRef.current;
    if (paused) pauses.add(reason);
    else pauses.delete(reason);
    if (progressRef.current) {
      progressRef.current.style.animationPlayState = pauses.size ? 'paused' : 'running';
    }
  }, []);

  useEffect(() => {
    if (isExiting) {
      const exitTimer = setTimeout(() => onExited(id), EXIT_DURATION_MS);
      return () => clearTimeout(exitTimer);
    }

    const timer = createNotificationTimer(duration, () => removeNotification(id));
    timerRef.current = timer;
    const syncVisibility = () => setPaused('hidden', document.hidden);
    syncVisibility();
    setPaused('focus', Boolean(cardRef.current?.contains(document.activeElement)));
    setPaused('hover', Boolean(cardRef.current?.matches(':hover')));
    document.addEventListener('visibilitychange', syncVisibility);
    return () => {
      document.removeEventListener('visibilitychange', syncVisibility);
      timer.dispose();
      timerRef.current = null;
    };
  }, [duration, id, isExiting, onExited, removeNotification, setPaused]);

  const dismiss = (skipAnimation = false) => {
    const card = cardRef.current;
    if (card?.contains(document.activeElement)) {
      const buttons = Array.from(
        card.parentElement?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []
      );
      const index = buttons.indexOf(card.querySelector('button')!);
      const target = buttons[index + 1] ?? buttons[index - 1] ?? returnFocusRef.current;
      if (target?.isConnected) target.focus({ preventScroll: true });
    }
    removeNotification(id);
    if (skipAnimation) onExited(id);
  };

  return (
    <div
      ref={cardRef}
      className={`${styles.notification} ${styles[type]}`}
      data-exiting={isExiting || undefined}
      aria-hidden={isExiting || undefined}
      inert={isExiting || undefined}
      onPointerEnter={(event) => {
        if (event.pointerType !== 'touch') setPaused('hover', true);
      }}
      onPointerLeave={() => setPaused('hover', false)}
      onFocusCapture={() => setPaused('focus', true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setPaused('focus', false);
        }
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        event.stopPropagation();
        dismiss(true);
      }}
    >
      <span className={styles.icon} aria-hidden="true">
        <Icon size={18} />
      </span>
      <div
        className={styles.message}
        role={type === 'error' ? 'alert' : 'status'}
        aria-atomic="true"
      >
        <span className={styles.srOnly}>{t(`notification.type_${type}`)}: </span>
        {message}
      </div>
      <button
        type="button"
        className={styles.closeButton}
        onClick={(event) => dismiss(event.detail === 0)}
        disabled={isExiting}
        aria-label={t('common.close')}
      >
        <IconX size={16} />
      </button>
      {showProgress ? (
        <span
          ref={progressRef}
          className={styles.progress}
          style={{ animationDuration: `${duration}ms` }}
          aria-hidden="true"
        />
      ) : null}
    </div>
  );
}

export function NotificationContainer() {
  const { t } = useTranslation();
  const notifications = useNotificationStore((state) => state.notifications);
  const [rendered, setRendered] = useState<AnimatedNotification[]>(notifications);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setRendered((previous) => {
      const current = new Map(notifications.map((notification) => [notification.id, notification]));
      const previousIds = new Set(previous.map((notification) => notification.id));
      return [
        ...previous.map((notification) =>
          current.has(notification.id)
            ? current.get(notification.id)!
            : { ...notification, isExiting: true }
        ),
        ...notifications.filter((notification) => !previousIds.has(notification.id)),
      ];
    });
  }, [notifications]);

  const handleExited = useCallback((id: string) => {
    setRendered((previous) => previous.filter((notification) => notification.id !== id));
  }, []);

  return (
    <section
      className={styles.container}
      aria-label={t('notification.region_label')}
      onFocusCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          returnFocusRef.current =
            event.relatedTarget instanceof HTMLElement ? event.relatedTarget : null;
        }
      }}
    >
      {rendered.map((notification) => (
        <NotificationCard
          key={notification.id}
          notification={notification}
          onExited={handleExited}
          returnFocusRef={returnFocusRef}
        />
      ))}
    </section>
  );
}
