import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BrandMark } from '@/components/brand/BrandMark';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SelectionCheckbox } from '@/components/ui/SelectionCheckbox';
import { IconEye, IconEyeOff } from '@/components/ui/icons';
import { useAuthStore, useLanguageStore, useNotificationStore } from '@/stores';
import { detectApiBaseFromLocation, normalizeApiBase } from '@/utils/connection';
import { LANGUAGE_LABEL_KEYS, LANGUAGE_ORDER } from '@/utils/constants';
import { isSupportedLanguage } from '@/utils/language';
import type { ApiError } from '@/types';
import { LegacyBackendError } from '@/services/api/legacyBackendProbe';
import styles from './LoginPage.module.scss';

/**
 * 将 API 错误转换为本地化的用户友好消息
 */
type RedirectState = { from?: { pathname?: string } };

function GlobeIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function getLocalizedErrorMessage(error: unknown, t: (key: string) => string): string {
  if (error instanceof LegacyBackendError) return t('login.error_legacy_backend');
  const apiError = error as Partial<ApiError>;
  const status = typeof apiError.status === 'number' ? apiError.status : undefined;
  const code = typeof apiError.code === 'string' ? apiError.code : undefined;
  const message =
    error instanceof Error
      ? error.message
      : typeof apiError.message === 'string'
        ? apiError.message
        : typeof error === 'string'
          ? error
          : '';

  const withHttpStatus = (summary: string) => {
    if (!status) {
      return summary;
    }

    const genericAxiosMessage = `Request failed with status code ${status}`;
    const detail = message.trim();
    const backendDetail =
      detail && detail !== genericAxiosMessage
        ? ` (${t('login.error_backend_detail')}: ${detail})`
        : '';

    return `HTTP ${status}: ${summary}${backendDetail}`;
  };

  // 根据 HTTP 状态码判断
  if (status === 401) {
    return withHttpStatus(t('login.error_unauthorized'));
  }
  if (status === 403) {
    return withHttpStatus(t('login.error_forbidden'));
  }
  if (status === 404) {
    return withHttpStatus(t('login.error_not_found'));
  }
  if (status && status >= 500) {
    return withHttpStatus(t('login.error_server'));
  }

  // 根据 axios 错误码判断
  if (code === 'ECONNABORTED' || message.toLowerCase().includes('timeout')) {
    return t('login.error_timeout');
  }
  if (code === 'ERR_NETWORK' || message.toLowerCase().includes('network error')) {
    return t('login.error_network');
  }
  if (code === 'ERR_CERT_AUTHORITY_INVALID' || message.toLowerCase().includes('certificate')) {
    return t('login.error_ssl');
  }

  // 检查 CORS 错误
  if (message.toLowerCase().includes('cors') || message.toLowerCase().includes('cross-origin')) {
    return t('login.error_cors');
  }

  // 默认错误消息
  return withHttpStatus(t('login.error_invalid'));
}

export function LoginPage() {
  const { t } = useTranslation();
  useEffect(() => {
    document.title = `${t('login.title')} – Manifold`;
  }, [t]);
  const navigate = useNavigate();
  const location = useLocation();
  const { showNotification } = useNotificationStore();
  const language = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const login = useAuthStore((state) => state.login);
  const restoreSession = useAuthStore((state) => state.restoreSession);
  const storedBase = useAuthStore((state) => state.apiBase);
  const storedKey = useAuthStore((state) => state.managementKey);
  const storedRememberPassword = useAuthStore((state) => state.rememberPassword);

  const [apiBase, setApiBase] = useState('');
  const [managementKey, setManagementKey] = useState('');
  const [showCustomBase, setShowCustomBase] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [rememberPassword, setRememberPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [autoLoading, setAutoLoading] = useState(true);
  const [autoLoginSuccess, setAutoLoginSuccess] = useState(false);
  const [error, setError] = useState('');

  const detectedBase = useMemo(() => detectApiBaseFromLocation(), []);
  const titleId = useId();
  const customBaseId = useId();
  const errorId = useId();
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const languageMenuRef = useRef<HTMLDivElement | null>(null);

  const handleLanguageChange = useCallback(
    (selectedLanguage: string) => {
      setLanguageMenuOpen(false);
      if (!isSupportedLanguage(selectedLanguage)) {
        return;
      }
      setLanguage(selectedLanguage);
    },
    [setLanguage]
  );

  // Close the language menu on outside click or Escape.
  useEffect(() => {
    if (!languageMenuOpen) {
      return;
    }
    const handlePointerDown = (event: MouseEvent) => {
      if (!languageMenuRef.current?.contains(event.target as Node)) {
        setLanguageMenuOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setLanguageMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [languageMenuOpen]);

  useEffect(() => {
    const init = async () => {
      try {
        const autoLoggedIn = await restoreSession();
        if (autoLoggedIn) {
          setAutoLoginSuccess(true);
          // 延迟跳转，让用户看到成功动画
          setTimeout(() => {
            const redirect = (location.state as RedirectState | null)?.from?.pathname || '/';
            navigate(redirect, { replace: true });
          }, 1500);
        } else {
          setApiBase(storedBase || detectedBase);
          setManagementKey(storedKey || '');
          setRememberPassword(storedRememberPassword || Boolean(storedKey));
        }
      } finally {
        // 自动登录成功时 showSplash 仍由 autoLoginSuccess 维持，可无条件结束 loading
        setAutoLoading(false);
      }
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!managementKey.trim()) {
      setError(t('login.error_required'));
      return;
    }

    const baseToUse = apiBase ? normalizeApiBase(apiBase) : detectedBase;
    setLoading(true);
    setError('');
    try {
      await login({
        apiBase: baseToUse,
        managementKey: managementKey.trim(),
        rememberPassword,
      });
      showNotification(t('common.connected_status'), 'success');
      navigate('/', { replace: true });
    } catch (err: unknown) {
      const message = getLocalizedErrorMessage(err, t);
      setError(message);
      showNotification(`${t('notification.login_failed')}: ${message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [
    apiBase,
    detectedBase,
    login,
    managementKey,
    navigate,
    rememberPassword,
    showNotification,
    t,
  ]);

  const handleSubmitKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' && !loading) {
        event.preventDefault();
        handleSubmit();
      }
    },
    [loading, handleSubmit]
  );

  if (isAuthenticated && !autoLoading && !autoLoginSuccess) {
    const redirect = (location.state as RedirectState | null)?.from?.pathname || '/';
    return <Navigate to={redirect} replace />;
  }

  // 显示启动动画（自动登录中或自动登录成功）
  const showSplash = autoLoading || autoLoginSuccess;

  const keyToggleLabel = showKey ? t('login.hide_key') : t('login.show_key');

  return (
    <div className={styles.container}>
      {!showSplash && (
        <div className={styles.languageAnchor} ref={languageMenuRef}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLanguageMenuOpen((prev) => !prev)}
            aria-label={t('language.switch')}
            title={t('language.switch')}
            aria-haspopup="menu"
            aria-expanded={languageMenuOpen}
          >
            <GlobeIcon />
            {t(LANGUAGE_LABEL_KEYS[language])}
          </Button>
          {languageMenuOpen && (
            <div className={styles.languageMenu} role="menu" aria-label={t('language.switch')}>
              {LANGUAGE_ORDER.map((lang) => (
                <button
                  key={lang}
                  type="button"
                  role="menuitemradio"
                  aria-checked={language === lang}
                  className={styles.languageOption}
                  onClick={() => handleLanguageChange(lang)}
                >
                  {t(LANGUAGE_LABEL_KEYS[lang])}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <main className={styles.column}>
        <div className={styles.brand}>
          <BrandMark size={40} className={styles.mark} />
          <div className={styles.brandText}>
            <span className={styles.productName}>{t('splash.title')}</span>
            <span className={styles.productSubtitle}>{t('splash.subtitle')}</span>
          </div>
        </div>

        {showSplash ? (
          <div className={styles.splash} role="status" aria-live="polite">
            <p className={styles.splashText}>{t('login.restoring_session')}</p>
            <div className={styles.splashTrack} aria-hidden="true">
              <div className={styles.splashBar} />
            </div>
          </div>
        ) : (
          <>
            <header className={styles.heading}>
              <h1 id={titleId} className={styles.title}>
                {t('login.title')}
              </h1>
              <p className={styles.subtitle}>{t('login.subtitle')}</p>
            </header>

            <section className={styles.panel} aria-labelledby={titleId}>
              <div className={styles.connection}>
                <div className={styles.connectionRow}>
                  <div className={styles.connectionText}>
                    <span className={styles.connectionLabel}>{t('login.connection_current')}</span>
                    <span className={styles.connectionValue}>{apiBase || detectedBase}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCustomBase((prev) => !prev)}
                    aria-expanded={showCustomBase}
                    aria-controls={customBaseId}
                    aria-label={t('login.change_connection_aria')}
                  >
                    {t('login.change_connection')}
                  </Button>
                </div>

                <div
                  id={customBaseId}
                  className={styles.collapse}
                  data-open={showCustomBase ? 'true' : 'false'}
                  inert={!showCustomBase}
                >
                  <div className={styles.collapseInner}>
                    <div className={styles.field}>
                      <Input
                        label={t('login.custom_connection_label')}
                        placeholder={t('login.custom_connection_placeholder')}
                        value={apiBase}
                        onChange={(e) => setApiBase(e.target.value)}
                        hint={t('login.custom_connection_hint')}
                        spellCheck={false}
                        autoCapitalize="off"
                        autoCorrect="off"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.field}>
                <Input
                  autoFocus
                  label={t('login.management_key_label')}
                  placeholder={t('login.management_key_placeholder')}
                  type={showKey ? 'text' : 'password'}
                  name="cpa-management-key"
                  autoComplete="off"
                  spellCheck={false}
                  className={styles.keyInput}
                  value={managementKey}
                  onChange={(e) => setManagementKey(e.target.value)}
                  onKeyDown={handleSubmitKeyDown}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? errorId : undefined}
                  rightElement={
                    <button
                      type="button"
                      className={styles.iconButton}
                      onClick={() => setShowKey((prev) => !prev)}
                      aria-label={keyToggleLabel}
                      title={keyToggleLabel}
                    >
                      {showKey ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                    </button>
                  }
                />
              </div>

              {error && (
                <div id={errorId} className={styles.errorBox} role="alert">
                  {error}
                </div>
              )}

              <SelectionCheckbox
                checked={rememberPassword}
                onChange={setRememberPassword}
                ariaLabel={t('login.remember_password_label')}
                label={t('login.remember_password_label')}
                labelClassName={styles.checkboxLabel}
              />

              <Button fullWidth size="lg" onClick={handleSubmit} loading={loading}>
                {loading ? t('login.submitting') : t('login.submit_button')}
              </Button>
            </section>

            <p className={styles.footnote}>{t('login.version_requirement')}</p>
          </>
        )}
      </main>
    </div>
  );
}
