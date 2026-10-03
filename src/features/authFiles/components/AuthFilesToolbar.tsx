import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { IconSearch, IconSlidersHorizontal, IconTrash2, IconX } from '@/components/ui/icons';
import { MAX_CARD_PAGE_SIZE, MIN_CARD_PAGE_SIZE } from '@/features/authFiles/constants';
import type { AuthFilesSortMode, AuthFilesStatusFilterMode } from '@/features/authFiles/uiState';
import styles from './AuthFilesToolbar.module.scss';

export type AuthFilesToolbarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilterMode: AuthFilesStatusFilterMode;
  statusFilterOptions: Array<{ value: AuthFilesStatusFilterMode; label: string }>;
  onStatusFilterChange: (mode: AuthFilesStatusFilterMode) => void;
  sortMode: AuthFilesSortMode;
  sortOptions: Array<{ value: string; label: string }>;
  onSortModeChange: (value: string) => void;
  pageSizeInput: string;
  onPageSizeInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onPageSizeCommit: (rawValue: string) => void;
  compactMode: boolean;
  onCompactModeChange: (value: boolean) => void;
  deleteLabel: string;
  deleteDisabled: boolean;
  deleteLoading: boolean;
  onDelete: () => void;
};

/**
 * Workbench toolbar: search, status and sort selects, the view switch, page size, and
 * "delete filtered" at the far end, next to the filters that scope it.
 */
export function AuthFilesToolbar(props: AuthFilesToolbarProps) {
  const {
    search,
    onSearchChange,
    statusFilterMode,
    statusFilterOptions,
    onStatusFilterChange,
    sortMode,
    sortOptions,
    onSortModeChange,
    pageSizeInput,
    onPageSizeInputChange,
    onPageSizeCommit,
    compactMode,
    onCompactModeChange,
    deleteLabel,
    deleteDisabled,
    deleteLoading,
    onDelete,
  } = props;
  const { t } = useTranslation();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [displaySettingsOpen, setDisplaySettingsOpen] = useState(false);
  const displaySettingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!displaySettingsOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!displaySettingsRef.current?.contains(event.target as Node)) {
        setDisplaySettingsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDisplaySettingsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [displaySettingsOpen]);

  const viewOptions = [
    { compact: false, label: t('auth_files.view_regular') },
    { compact: true, label: t('auth_files.view_compact') },
  ];

  return (
    <div className={styles.toolbar}>
      <div className={styles.filters}>
        <div className={styles.search}>
          <IconSearch size={16} className={styles.searchIcon} aria-hidden="true" />
          <input
            ref={searchInputRef}
            className={styles.searchInput}
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t('auth_files.search_placeholder')}
            aria-label={t('auth_files.search_label')}
          />
          {search && (
            <button
              type="button"
              className={styles.clearSearch}
              aria-label={t('auth_files.search_clear')}
              title={t('auth_files.search_clear')}
              onClick={() => {
                onSearchChange('');
                searchInputRef.current?.focus();
              }}
            >
              <IconX size={14} aria-hidden="true" />
            </button>
          )}
        </div>

        <div className={styles.select}>
          <Select
            value={statusFilterMode}
            options={statusFilterOptions}
            onChange={(value) => {
              const option = statusFilterOptions.find((item) => item.value === value);
              if (option) onStatusFilterChange(option.value);
            }}
            ariaLabel={t('auth_files.problem_filter_label')}
            size="sm"
          />
        </div>

        <div className={styles.select}>
          <Select
            value={sortMode}
            options={sortOptions}
            onChange={onSortModeChange}
            ariaLabel={t('auth_files.sort_label')}
            size="sm"
          />
        </div>
      </div>

      <div className={styles.end}>
        <div className={styles.segmented} role="group" aria-label={t('auth_files.view_label')}>
          {viewOptions.map((option) => {
            const isActive = compactMode === option.compact;
            return (
              <button
                key={String(option.compact)}
                type="button"
                className={`${styles.segment} ${isActive ? styles.segmentActive : ''}`}
                aria-pressed={isActive}
                onClick={() => onCompactModeChange(option.compact)}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <div className={styles.display} ref={displaySettingsRef}>
          <button
            type="button"
            className={`${styles.displayButton} ${displaySettingsOpen ? styles.displayButtonActive : ''}`}
            aria-expanded={displaySettingsOpen}
            aria-controls="auth-files-display-settings"
            aria-label={t('auth_files.display_options_label')}
            title={t('auth_files.display_options_label')}
            onClick={() => setDisplaySettingsOpen((open) => !open)}
          >
            <IconSlidersHorizontal size={16} aria-hidden="true" />
          </button>

          {displaySettingsOpen && (
            <div id="auth-files-display-settings" className={styles.popover}>
              <div className={styles.popoverRow}>
                <label htmlFor="auth-files-page-size">{t('auth_files.page_size_label')}</label>
                <input
                  id="auth-files-page-size"
                  className={styles.pageSizeInput}
                  type="number"
                  min={MIN_CARD_PAGE_SIZE}
                  max={MAX_CARD_PAGE_SIZE}
                  step={1}
                  value={pageSizeInput}
                  onChange={onPageSizeInputChange}
                  onBlur={(e) => onPageSizeCommit(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.currentTarget.blur();
                    }
                  }}
                />
              </div>
            </div>
          )}
        </div>

        <Button
          variant="ghost"
          size="md"
          className={styles.deleteAction}
          onClick={onDelete}
          disabled={deleteDisabled}
        >
          {deleteLoading ? (
            <LoadingSpinner size={14} />
          ) : (
            <IconTrash2 size={14} aria-hidden="true" />
          )}
          {deleteLabel}
        </Button>
      </div>
    </div>
  );
}
