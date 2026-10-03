import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { useNotificationStore } from '@/stores';
import { Button } from '@/components/ui/Button';
import { IconExternalLink, IconLoader2, IconPlus } from '@/components/ui/icons';
import { PROVIDER_LOGOS } from '../brandLogos';
import { APIKEY_FUN_AFFILIATE_URL, APIKEY_FUN_DASHBOARD_URL } from '../sponsor';
import { isSponsorPartialMutationError } from '../sponsorMutationRecovery';
import type { ProviderEntryFormInput, ProviderResource } from '../types';
import type { UseProviderWorkbenchResult } from '../useProviderWorkbench';
import { SponsorProviderForm } from '../sheets/forms/SponsorProviderForm';
import { SaveBar } from './SaveBar';
import styles from './SponsorQuickStartPanel.module.scss';

interface SponsorQuickStartPanelProps {
  resource: ProviderResource | null;
  workbench: UseProviderWorkbenchResult;
  mutationDisabled?: boolean;
}

export function SponsorQuickStartPanel({
  resource,
  workbench,
  mutationDisabled = false,
}: SponsorQuickStartPanelProps) {
  const { t } = useTranslation();
  const { showNotification } = useNotificationStore();
  const formId = useId();
  const [submitting, setSubmitting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [formVersion, setFormVersion] = useState(0);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const formMutating = submitting || mutationDisabled || workbench.mutating;
  const mode = resource ? 'edit' : 'create';
  const submitDisabled = formMutating || (mode === 'edit' && !isDirty);
  const logo = PROVIDER_LOGOS.apikeyFun;

  useUnsavedChangesGuard({
    shouldBlock: isDirty && !submitting,
    dialog: {
      title: t('providersPage.unsavedChanges.title'),
      message: t('providersPage.unsavedChanges.message'),
      confirmText: t('providersPage.unsavedChanges.discard'),
      cancelText: t('providersPage.unsavedChanges.keepEditing'),
      variant: 'danger',
    },
  });

  const handleSubmit = async (input: ProviderEntryFormInput) => {
    if (mutationDisabled) return;
    setSubmitting(true);
    try {
      if (resource) {
        await workbench.updateProvider(resource, input);
        showNotification(t('providersPage.toast.updated'), 'success');
      } else {
        await workbench.createProvider('apikeyFun', input);
        showNotification(t('providersPage.toast.created'), 'success');
        setShowCreateForm(false);
      }
      setIsDirty(false);
      setFormVersion((current) => current + 1);
    } catch (err) {
      if (isSponsorPartialMutationError(err)) {
        showNotification(t('providersPage.sponsor.partialMutationWarning'), 'warning');
        throw err;
      }
      const msg = err instanceof Error ? err.message : String(err);
      showNotification(
        `${t(resource ? 'notification.update_failed' : 'notification.add_failed')}: ${msg}`,
        'error'
      );
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  if (!resource && !showCreateForm) {
    return (
      <section className={styles.panel}>
        <div className={styles.header}>
          <div className={styles.titleRow}>
            <span className={styles.tile} aria-hidden="true">
              <img src={logo.src} alt="" className={styles.logo} />
            </span>
            <div className={styles.titleText}>
              <h2 className={styles.title}>{t('providersPage.providerNames.apikeyFun')}</h2>
            </div>
          </div>
        </div>

        <div className={styles.empty}>
          <p className={styles.emptyText}>{t('providersPage.sponsor.emptyRegisterHint')}</p>
          <Button
            variant="primary"
            onClick={() => setShowCreateForm(true)}
            disabled={formMutating}
            className={styles.buttonWithIcon}
          >
            <IconPlus size={14} aria-hidden="true" />
            {t('providersPage.actions.new')}
          </Button>
          <a
            className={styles.textLink}
            href={APIKEY_FUN_AFFILIATE_URL}
            target="_blank"
            rel="noreferrer"
          >
            <span>{t('providersPage.sponsor.registerNow')}</span>
            <IconExternalLink size={14} aria-hidden="true" />
          </a>
        </div>
      </section>
    );
  }

  const actionHref = resource ? APIKEY_FUN_DASHBOARD_URL : APIKEY_FUN_AFFILIATE_URL;
  const actionLabel = resource
    ? t('providersPage.sponsor.dashboardLink')
    : t('providersPage.sponsor.registerLink');

  return (
    <section className={`${styles.panel} ${styles.panelBare}`}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <span className={styles.tile} aria-hidden="true">
            <img src={logo.src} alt="" className={styles.logo} />
          </span>
          <div className={styles.titleText}>
            <h2 className={styles.title}>{t('providersPage.providerNames.apikeyFun')}</h2>
          </div>
          <a className={styles.topLink} href={actionHref} target="_blank" rel="noreferrer">
            <span>{actionLabel}</span>
            <IconExternalLink size={14} aria-hidden="true" />
          </a>
        </div>
      </div>

      <SponsorProviderForm
        key={`${mode}:${resource?.id ?? 'new'}:${formVersion}`}
        resource={resource}
        mode={mode}
        mutating={formMutating}
        formId={formId}
        variant="quickStart"
        onSubmit={handleSubmit}
        onDirtyChange={setIsDirty}
      />

      {/* A new resource is unsaved by definition; an existing one only once it has edits. */}
      <SaveBar visible={mode === 'create' || isDirty || submitting}>
        {!resource ? (
          <Button
            variant="ghost"
            onClick={() => {
              setShowCreateForm(false);
              setIsDirty(false);
              setFormVersion((current) => current + 1);
            }}
            disabled={submitting}
          >
            {t('providersPage.actions.cancel')}
          </Button>
        ) : null}
        <Button
          type="submit"
          form={formId}
          variant="primary"
          disabled={submitDisabled}
          className={styles.buttonWithIcon}
        >
          {submitting ? (
            <IconLoader2 className={styles.spin} size={14} aria-hidden="true" />
          ) : mode === 'create' ? (
            <IconPlus size={14} aria-hidden="true" />
          ) : null}
          {mode === 'create'
            ? t('providersPage.actions.create')
            : t('providersPage.actions.saveChanges')}
        </Button>
      </SaveBar>
    </section>
  );
}
