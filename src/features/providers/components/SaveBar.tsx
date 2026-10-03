import type { ReactNode } from 'react';
import styles from './SaveBar.module.scss';

interface SaveBarProps {
  visible: boolean;
  children: ReactNode;
}

/**
 * Floating save/discard bar pinned to the bottom of a scrolling editor. It slides in only
 * while there is something to save; when hidden it leaves the tab order and the a11y tree.
 */
export function SaveBar({ visible, children }: SaveBarProps) {
  return (
    <>
      <div className={styles.spacer} aria-hidden="true" />
      <div className={styles.dock}>
        <div className={styles.bar} data-visible={visible ? 'true' : 'false'}>
          {children}
        </div>
      </div>
    </>
  );
}
