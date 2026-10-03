import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { IconTrash2 } from '@/components/ui/icons';
import { PRICING_AS_OF, type PricingTable } from '../pricing';
import styles from '../UsagePage.module.scss';

interface Row {
  id: number;
  pattern: string;
  input: string;
  cacheRead: string;
  cacheWrite: string;
  output: string;
}

const RATE_FIELDS = ['input', 'cacheRead', 'cacheWrite', 'output'] as const;
type RateField = (typeof RATE_FIELDS)[number];
const FIELD_KEYS: Record<RateField, string> = {
  input: 'usage.col_input',
  cacheRead: 'usage.col_cache_read',
  cacheWrite: 'usage.col_cache_write',
  output: 'usage.col_output',
};

let nextId = 1;
const toRows = (table: PricingTable): Row[] =>
  Object.entries(table).map(([pattern, p]) => ({
    id: nextId++,
    pattern,
    input: String(p.input),
    cacheRead: String(p.cacheRead),
    cacheWrite: String(p.cacheWrite),
    output: String(p.output),
  }));

/** Returns null when any row is unusable so the caller keeps the last good table. */
function toTable(rows: Row[]): PricingTable | null {
  const table: PricingTable = {};
  for (const row of rows) {
    const pattern = row.pattern.trim().toLowerCase();
    if (!pattern) continue;
    const rates = RATE_FIELDS.map((f) => (row[f].trim() === '' ? NaN : Number(row[f])));
    if (rates.some((r) => !Number.isFinite(r) || r < 0)) return null;
    table[pattern] = {
      input: rates[0],
      cacheRead: rates[1],
      cacheWrite: rates[2],
      output: rates[3],
    };
  }
  return table;
}

interface PricingEditorProps {
  pricing: PricingTable;
  onChange: (table: PricingTable) => void;
  onReset: () => void;
}

export function PricingEditor({ pricing, onChange, onReset }: PricingEditorProps) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<Row[]>(() => toRows(pricing));
  const [invalid, setInvalid] = useState(false);

  // External changes (reset) replace the draft.
  useEffect(() => {
    setRows(toRows(pricing));
    setInvalid(false);
  }, [pricing]);

  const commit = (next: Row[]) => {
    setRows(next);
    const table = toTable(next);
    setInvalid(table === null);
    if (table) onChange(table);
  };

  const update = (id: number, field: 'pattern' | RateField, value: string) =>
    commit(rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)));

  return (
    <div className={styles.editor} id="usage-pricing">
      <p className={styles.editorNote}>
        {t('usage.pricing_as_of', { date: PRICING_AS_OF })} {t('usage.pricing_hint')}
      </p>
      <div className={styles.editorScroll}>
        <table className={styles.editorTable}>
          <thead>
            <tr>
              <th>{t('usage.pricing_pattern')}</th>
              {RATE_FIELDS.map((f) => (
                <th key={f} className={styles.alignRight}>
                  {t(FIELD_KEYS[f])}
                </th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <input
                    className={`${styles.editorInput} ${styles.mono}`}
                    value={row.pattern}
                    aria-label={t('usage.pricing_pattern')}
                    onChange={(e) => update(row.id, 'pattern', e.target.value)}
                  />
                </td>
                {RATE_FIELDS.map((f) => (
                  <td key={f}>
                    <input
                      className={`${styles.editorInput} ${styles.alignRight}`}
                      inputMode="decimal"
                      value={row[f]}
                      aria-label={`${row.pattern} ${t(FIELD_KEYS[f])}`}
                      onChange={(e) => update(row.id, f, e.target.value)}
                    />
                  </td>
                ))}
                <td>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    aria-label={t('usage.pricing_remove_row')}
                    title={t('usage.pricing_remove_row')}
                    onClick={() => commit(rows.filter((r) => r.id !== row.id))}
                  >
                    <IconTrash2 size={14} aria-hidden="true" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {invalid && (
        <p className={styles.editorError} role="alert">
          {t('usage.pricing_invalid')}
        </p>
      )}
      <div className={styles.editorActions}>
        <Button
          variant="secondary"
          size="sm"
          onClick={() =>
            setRows([
              ...rows,
              { id: nextId++, pattern: '', input: '0', cacheRead: '0', cacheWrite: '0', output: '0' },
            ])
          }
        >
          {t('usage.pricing_add_row')}
        </Button>
        <Button variant="ghost" size="sm" onClick={onReset}>
          {t('usage.pricing_reset')}
        </Button>
      </div>
    </div>
  );
}
