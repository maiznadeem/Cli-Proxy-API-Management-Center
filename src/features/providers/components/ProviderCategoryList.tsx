import { useTranslation } from 'react-i18next';
import { PROVIDER_LOGOS } from '../brandLogos';
import type { ProviderBrand, ProviderGroup } from '../types';
import styles from './ProviderCategoryList.module.scss';

interface ProviderCategoryListProps {
  groups: ProviderGroup[];
  activeBrand: ProviderBrand;
  onSelect: (brand: ProviderBrand) => void;
}

const QUICK_FILL_BRAND_ORDER: readonly ProviderBrand[] = ['fennoAI', 'qiniuCloud'];

const QUICK_FILL_BRANDS: ReadonlySet<ProviderBrand> = new Set(QUICK_FILL_BRAND_ORDER);

export function ProviderCategoryList({ groups, activeBrand, onSelect }: ProviderCategoryListProps) {
  const { t } = useTranslation();

  const quickFillGroups = groups
    .filter((g) => QUICK_FILL_BRANDS.has(g.id))
    .sort(
      (left, right) =>
        QUICK_FILL_BRAND_ORDER.indexOf(left.id) - QUICK_FILL_BRAND_ORDER.indexOf(right.id)
    );
  const providerGroups = groups.filter((g) => !QUICK_FILL_BRANDS.has(g.id));

  const renderGroups = (items: ProviderGroup[]) => (
    <div className={styles.list}>
      {items.map((group) => {
        const active = group.id === activeBrand;
        const total = group.resources.length;
        const activeCount = group.resources.filter((r) => !r.disabled).length;
        const logo = PROVIDER_LOGOS[group.id];
        const itemClass = [styles.item, active ? styles.active : ''].filter(Boolean).join(' ');
        const tileClassName = [styles.tile, logo?.themeSurface ? styles.tileThemeSurface : '']
          .filter(Boolean)
          .join(' ');
        const logoClassName = [
          styles.logo,
          logo?.darkSrc ? styles.logoThemeLight : '',
          logo?.invertOnDark ? styles.logoInvertOnDark : '',
        ]
          .filter(Boolean)
          .join(' ');
        const darkLogoClassName = [styles.logo, styles.logoThemeDark].join(' ');

        return (
          <button
            key={group.id}
            type="button"
            className={itemClass}
            onClick={() => onSelect(group.id)}
            aria-current={active ? 'page' : undefined}
          >
            <span className={tileClassName} aria-hidden="true">
              {logo ? (
                <>
                  <img src={logo.src} alt="" className={logoClassName} />
                  {logo.darkSrc ? (
                    <img src={logo.darkSrc} alt="" className={darkLogoClassName} />
                  ) : null}
                </>
              ) : null}
            </span>
            <span className={styles.name}>{t(`providersPage.providerNames.${group.id}`)}</span>
            <span className={total === 0 ? `${styles.count} ${styles.countEmpty}` : styles.count}>
              {t('providersPage.categories.activeCount', {
                active: activeCount,
                total,
              })}
            </span>
          </button>
        );
      })}
    </div>
  );

  return (
    <nav className={styles.navigator} aria-label={t('providersPage.categories.title')}>
      <div className={styles.group}>
        <p className={styles.groupLabel}>{t('providersPage.categories.title')}</p>
        {renderGroups(providerGroups)}
      </div>
      {quickFillGroups.length > 0 && (
        <div className={styles.group}>
          <p className={styles.groupLabel}>{t('providersPage.categories.quickFill')}</p>
          {renderGroups(quickFillGroups)}
        </div>
      )}
    </nav>
  );
}
