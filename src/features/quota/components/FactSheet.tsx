/**
 * Fact sheet: the one grammar every expanded ribbon speaks.
 *
 * A sheet is a row of sections; a section is a title plus rows; a row is a
 * label on the left, a value in the middle, and an optional aside on the right
 * (a date, a count). Plan, credits, grants, renewal, model groups all read the
 * same way, so the eye learns the drawer once and then only reads values.
 */

import type { ReactNode } from 'react';
import styles from './FactSheet.module.scss';

export function FactSheet({ children }: { children: ReactNode }) {
  return <div className={styles.sheet}>{children}</div>;
}

export interface FactSectionProps {
  title: string;
  /** Small count beside the title, for example the number of grants. */
  count?: number | string | null;
  /** One quiet sentence under the title that explains the section. */
  note?: ReactNode;
  /** Let a wide section (a table of grants) take two columns. */
  wide?: boolean;
  children: ReactNode;
}

export function FactSection({ title, count, note, wide = false, children }: FactSectionProps) {
  return (
    <section className={wide ? `${styles.section} ${styles.sectionWide}` : styles.section}>
      <header className={styles.sectionHead}>
        <h4 className={styles.sectionTitle}>{title}</h4>
        {count !== undefined && count !== null && (
          <span className={styles.sectionCount}>{count}</span>
        )}
      </header>
      {note && <p className={styles.sectionNote}>{note}</p>}
      <div className={styles.rows}>{children}</div>
    </section>
  );
}

export interface FactRowProps {
  label: ReactNode;
  children?: ReactNode;
  /** Right-aligned detail: a date, a countdown, a count. */
  aside?: ReactNode;
  /** Second line under the value. */
  hint?: ReactNode;
  /** Tooltip, for the raw upstream wording behind a friendlier label. */
  title?: string;
  /** Draw attention to this row (expiring soon, past due). */
  tone?: 'default' | 'warn';
}

export function FactRow({ label, children, aside, hint, title, tone = 'default' }: FactRowProps) {
  return (
    <div className={tone === 'warn' ? `${styles.row} ${styles.rowWarn}` : styles.row} title={title}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{children}</span>
      {aside !== undefined && aside !== null && <span className={styles.aside}>{aside}</span>}
      {hint && <span className={styles.hint}>{hint}</span>}
    </div>
  );
}

/** A short state pill used inside values ("On", "Past due", "Never enabled"). */
export function FactPill({
  children,
  tone = 'default',
}: {
  children: ReactNode;
  tone?: 'default' | 'on' | 'warn';
}) {
  const toneClass = tone === 'on' ? styles.pillOn : tone === 'warn' ? styles.pillWarn : '';
  return (
    <span className={`${styles.pill} ${toneClass}`}>
      <span className={styles.dot} aria-hidden="true" />
      {children}
    </span>
  );
}

export function FactLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a className={styles.link} href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

/** Full-width message inside a section: a billing notice, a read error. */
export function FactNotice({
  children,
  tone = 'warn',
}: {
  children: ReactNode;
  tone?: 'warn' | 'error';
}) {
  return (
    <div
      className={tone === 'error' ? `${styles.notice} ${styles.noticeError}` : styles.notice}
      role="status"
    >
      {children}
    </div>
  );
}
