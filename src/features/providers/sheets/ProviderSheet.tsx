import { useCallback, useEffect, useId, useImperativeHandle, useState, type Ref } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { IconLoader2, IconPencil } from '@/components/ui/icons';
import type { ProviderRecentUsageMap } from '@/components/providers/utils';
import { useNotificationStore } from '@/stores';
import { PROVIDER_DESCRIPTORS } from '../descriptors';
import { isMultiProtocolSponsorBrand } from '../sponsorDefinitions';
import type { ProviderBrand, ProviderEntryFormInput, ProviderResource } from '../types';
import type { UseProviderWorkbenchResult } from '../useProviderWorkbench';
import { BaseProviderForm } from './forms/BaseProviderForm';
import { ResourceDetailView } from './ResourceDetailView';
import { SponsorProviderForm } from './forms/SponsorProviderForm';
import { SaveBar } from '../components/SaveBar';
import styles from './ProviderSheet.module.scss';

type SheetMode = 'detail' | 'create' | 'edit';

export interface ProviderSheetState {
  open: boolean;
  brand: ProviderBrand;
  mode: SheetMode;
  resource: ProviderResource | null;
}

export interface ProviderSheetHandle {
  confirmDiscardIfDirty: () => Promise<boolean>;
}

interface ProviderSheetProps {
  state: ProviderSheetState;
  onClose: () => void;
  onSwitchToEdit: () => void;
  workbench: UseProviderWorkbenchResult;
  onCreated: () => void;
  onUpdated: () => void;
  mutationDisabled?: boolean;
  usageByProvider?: ProviderRecentUsageMap;
  ref?: Ref<ProviderSheetHandle>;
}

export function ProviderSheet({
  state,
  onClose,
  onSwitchToEdit,
  workbench,
  onCreated,
  onUpdated,
  mutationDisabled = false,
  usageByProvider,
  ref,
}: ProviderSheetProps) {
  const { t } = useTranslation();
  const { showConfirmation } = useNotificationStore();
  const formId = useId();
  const [submitting, setSubmitting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Reset dirty flag whenever the sheet is closed or the editing target
  // (brand / resource / mode) changes — the child form will re-mount and
  // re-report its own dirty state.
  useEffect(() => {
    setIsDirty(false);
  }, [state.brand, state.mode, state.resource?.id, state.open]);

  const handleDirtyChange = useCallback((dirty: boolean) => {
    setIsDirty(dirty);
  }, []);

  const descriptor = PROVIDER_DESCRIPTORS[state.brand];
  const isEditingForm = state.mode === 'create' || state.mode === 'edit';
  const formMutating = submitting || mutationDisabled;
  const submitDisabled = formMutating || (state.mode === 'edit' && !isDirty);

  const confirmDiscardIfDirty = useCallback((): Promise<boolean> => {
    if (!isEditingForm || !isDirty || submitting) {
      return Promise.resolve(true);
    }
    return new Promise<boolean>((resolve) => {
      showConfirmation({
        title: t('providersPage.unsavedChanges.title'),
        message: t('providersPage.unsavedChanges.message'),
        variant: 'danger',
        confirmText: t('providersPage.unsavedChanges.discard'),
        cancelText: t('providersPage.unsavedChanges.keepEditing'),
        onConfirm: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });
  }, [isDirty, isEditingForm, showConfirmation, submitting, t]);

  useImperativeHandle(ref, () => ({ confirmDiscardIfDirty }), [confirmDiscardIfDirty]);

  const handleCancelClick = useCallback(() => {
    void confirmDiscardIfDirty().then((ok) => {
      if (ok) onClose();
    });
  }, [confirmDiscardIfDirty, onClose]);

  const titleText = t(`providersPage.providerNames.${state.brand}`);

  const handleCreate = useCallback(
    async (input: ProviderEntryFormInput) => {
      if (mutationDisabled) return;
      setSubmitting(true);
      try {
        await workbench.createProvider(state.brand, input);
        onCreated();
      } finally {
        setSubmitting(false);
      }
    },
    [mutationDisabled, onCreated, state.brand, workbench]
  );

  const handleUpdate = useCallback(
    async (input: ProviderEntryFormInput) => {
      if (!state.resource || mutationDisabled || !isDirty) return;
      setSubmitting(true);
      try {
        await workbench.updateProvider(state.resource, input);
        onUpdated();
      } finally {
        setSubmitting(false);
      }
    },
    [isDirty, mutationDisabled, onUpdated, state.resource, workbench]
  );

  const renderBody = () => {
    if (state.mode === 'detail') {
      if (!state.resource) {
        return null;
      }
      return <ResourceDetailView resource={state.resource} usageByProvider={usageByProvider} />;
    }
    const formKey = `${state.brand}:${state.resource?.id ?? 'new'}:${state.mode}`;
    if (isMultiProtocolSponsorBrand(state.brand)) {
      return (
        <SponsorProviderForm
          key={formKey}
          brand={state.brand}
          resource={state.resource}
          mode={state.mode}
          mutating={formMutating}
          formId={formId}
          onSubmit={state.mode === 'create' ? handleCreate : handleUpdate}
          onDirtyChange={handleDirtyChange}
        />
      );
    }
    return (
      <BaseProviderForm
        key={formKey}
        brand={state.brand}
        resource={state.resource}
        mode={state.mode}
        mutating={formMutating}
        formId={formId}
        onSubmit={state.mode === 'create' ? handleCreate : handleUpdate}
        onDirtyChange={handleDirtyChange}
      />
    );
  };

  const footer =
    state.mode === 'detail' ? (
      state.resource ? (
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('providersPage.actions.cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={onSwitchToEdit}
            disabled={formMutating}
            className={styles.buttonWithIcon}
          >
            <IconPencil size={14} aria-hidden="true" />
            {t('providersPage.actions.edit')}
          </Button>
        </>
      ) : (
        <Button variant="primary" onClick={onClose}>
          {t('providersPage.actions.cancel')}
        </Button>
      )
    ) : undefined;

  // A new resource is unsaved by definition; an existing one only once it has edits.
  const saveBar = isEditingForm ? (
    <SaveBar visible={state.mode === 'create' || isDirty || submitting}>
      <Button variant="ghost" onClick={handleCancelClick} disabled={submitting}>
        {state.mode === 'create'
          ? t('providersPage.actions.cancel')
          : t('providersPage.unsavedChanges.discard')}
      </Button>
      <Button
        type="submit"
        form={formId}
        variant="primary"
        disabled={submitDisabled}
        className={styles.buttonWithIcon}
      >
        {submitting ? <IconLoader2 size={14} className={styles.spin} aria-hidden="true" /> : null}
        {state.mode === 'create'
          ? t('providersPage.actions.create')
          : t('providersPage.actions.saveChanges')}
      </Button>
    </SaveBar>
  ) : null;

  return (
    <Sheet
      open={state.open}
      onClose={onClose}
      size={descriptor.sheetSize}
      eyebrow={
        state.mode === 'detail'
          ? t('providersPage.detail.title')
          : state.mode === 'create'
            ? t('providersPage.form.createEyebrow')
            : t('providersPage.form.editEyebrow')
      }
      title={titleText}
      description={t('providersPage.table.description', {
        route:
          state.brand === 'openaiCompatibility'
            ? '/ai-providers/openai'
            : state.brand === 'apikeyFun'
              ? '/quick-start'
              : state.brand === 'fennoAI'
                ? '/ai-providers/fennoai'
                : state.brand === 'qiniuCloud'
                  ? '/ai-providers/qiniu'
                  : state.brand === 'kimi'
                    ? '/ai-providers/kimi'
                    : `/ai-providers/${state.brand}`,
      })}
      footer={footer}
      closeDisabled={submitting}
      confirmClose={confirmDiscardIfDirty}
    >
      {renderBody()}
      {saveBar}
    </Sheet>
  );
}
