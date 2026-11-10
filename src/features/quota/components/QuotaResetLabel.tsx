/**
 * The instant a window comes back, said two ways.
 *
 * With `verb`, the countdown leads and carries the verb ("Resets in 5 days"),
 * followed by the absolute instant for planning ("16/11, 11:00"). Without it,
 * the caller has already labelled the value ("Plan ends", "Resets") and gets the
 * bare `absolute · relative` pair. One component so markup and spacing never
 * drift between providers; the separator lives in CSS.
 */

import { useTranslation } from 'react-i18next';
import type { ResetDisplay } from '@/utils/quota';
import type { QuotaClassMap } from '../types';

export interface QuotaResetLabelProps {
  display: ResetDisplay;
  classes: QuotaClassMap;
  /** True on the row that recovers first for this credential. */
  soon?: boolean;
  /** Name the event in the label itself; omit when a label beside it already does. */
  verb?: 'resets' | 'expires';
}

export function QuotaResetLabel({ display, classes, soon = false, verb }: QuotaResetLabelProps) {
  const { t } = useTranslation();
  const relativeClass = soon
    ? `${classes.quotaResetRelative} ${classes.quotaResetRelativeSoon}`
    : classes.quotaResetRelative;

  if (verb) {
    if (!display.relative) {
      return (
        <span className={classes.quotaReset}>
          {t(`quota_management.${verb}_at`, { time: display.absolute })}
        </span>
      );
    }
    return (
      <span className={classes.quotaReset} title={display.absolute}>
        <span className={relativeClass}>
          {t(`quota_management.${verb}_relative`, { relative: display.relative })}
        </span>
        <span> · {display.absolute}</span>
      </span>
    );
  }

  return (
    <>
      <span className={classes.quotaReset}>{display.absolute}</span>
      {display.relative && <span className={relativeClass}>{display.relative}</span>}
    </>
  );
}
