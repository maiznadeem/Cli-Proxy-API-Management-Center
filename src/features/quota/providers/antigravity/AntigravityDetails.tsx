/**
 * Antigravity details drawer: the plan, the file, and which models each quota
 * group covers. The meters above already say how much of each group is left.
 */

import { useTranslation } from 'react-i18next';
import type { AntigravityQuotaState } from '@/types';
import { FactRow, FactSection, FactSheet } from '../../components/FactSheet';
import type { QuotaDetailsProps } from '../types';
import {
  resolveAntigravityGroupLabelKey,
  resolveAntigravityGroupModels,
  translateAntigravityQuotaDescription,
  translateAntigravityQuotaLabel,
} from './labels';
import { getAntigravityPlanLabel } from './planLabel';

export function AntigravityDetails({
  quota,
  file,
  classes,
}: QuotaDetailsProps<AntigravityQuotaState>) {
  const { t } = useTranslation();
  const planLabel = getAntigravityPlanLabel(quota.subscription, t);
  const normalizedPlan = quota.subscription?.plan?.toLowerCase() ?? '';
  const premium = normalizedPlan === 'ultra' || normalizedPlan === 'ultra-lite';
  const groups = (quota.groups ?? [])
    .map((group) => {
      const models = resolveAntigravityGroupModels(group.label, group.description);
      const description = models
        ? t('antigravity_quota.group_models_description', { models: models.join(', ') })
        : translateAntigravityQuotaDescription(group.description, t);
      return {
        id: group.id,
        label: translateAntigravityQuotaLabel(
          group.label,
          resolveAntigravityGroupLabelKey(group.label),
          t
        ),
        description,
      };
    })
    .filter((group) => Boolean(group.description));

  return (
    <FactSheet>
      <FactSection title={t('quota_management.details_account')}>
        {planLabel && (
          <FactRow label={t('antigravity_quota.plan_label')}>
            <span className={premium ? classes.premiumPlanValue : undefined}>{planLabel}</span>
          </FactRow>
        )}
        <FactRow label={t('quota_management.details_credential')}>
          <span className={classes.quotaAmount}>{file.name}</span>
        </FactRow>
      </FactSection>
      {groups.length > 0 && (
        <FactSection title={t('quota_management.details_model_groups')}>
          {groups.map((group) => (
            <FactRow key={group.id} label={group.label}>
              {group.description}
            </FactRow>
          ))}
        </FactSection>
      )}
    </FactSheet>
  );
}
