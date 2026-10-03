import type { ReactNode } from 'react';
import { FIELDS_ROOT_CLASS } from './fields/FieldPrimitives';
import styles from './SectionCard.module.scss';

export type SectionCardProps = {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
};

/** Section panel: title, muted description, then the section's field rows. */
export function SectionCard({ title, description, children }: SectionCardProps) {
  return (
    <section className={styles.card}>
      <header className={styles.header}>
        <h2 className={styles.title}>{title}</h2>
        {description ? <p className={styles.description}>{description}</p> : null}
      </header>
      <div className={`${styles.content} ${FIELDS_ROOT_CLASS}`}>{children}</div>
    </section>
  );
}
