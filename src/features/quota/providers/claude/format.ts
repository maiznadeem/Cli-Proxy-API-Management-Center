/** Money and short-date formatting shared by the Claude ribbon body and its details drawer. */

export const formatUsd = (amount: number, language?: string): string => {
  const whole = Number.isInteger(amount);
  return new Intl.NumberFormat(language, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

export const formatResetDate = (ms: number, language?: string): string =>
  new Intl.DateTimeFormat(language, { day: 'numeric', month: 'short' }).format(new Date(ms));
