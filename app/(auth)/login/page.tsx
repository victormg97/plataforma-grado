'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { Eye, EyeOff } from 'lucide-react';
import { loginSchema, type LoginFormData } from '@/lib/validations/auth.schema';
import { setLocaleAction } from '@/app/actions/setLocale';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/common/Button';
import { AppLogo } from '@/components/common/AppLogo';
import type { LocaleCode } from '@/lib/config/locales';

export default function LoginPage() {
  const t = useTranslations('auth.login');
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  // Seconds remaining before the user can try again after a 429
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Countdown timer — ticks every second, stops at 0
  function startCooldown(seconds: number) {
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    setCooldownSeconds(seconds);
    cooldownRef.current = setInterval(() => {
      setCooldownSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current!);
          cooldownRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(data: LoginFormData) {
    // Block submit while in cooldown
    if (cooldownSeconds > 0) return;

    setLoading(true);

    let res: Response;
    try {
      res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email, password: data.password }),
      });
    } catch {
      toast.error(t('error_servidor'));
      setLoading(false);
      return;
    }

    // ── 429 Too Many Requests ────────────────────────────────────────────────
    if (res.status === 429) {
      const body = await res.json().catch(() => ({}));
      const retryAfter: number = body.retryAfter ?? 60;
      const minutes = Math.ceil(retryAfter / 60);
      startCooldown(retryAfter);
      toast.error(t('error_demasiados_intentos', { minutes }));
      setLoading(false);
      return;
    }

    // ── 401 Invalid credentials ──────────────────────────────────────────────
    if (res.status === 401) {
      const body = await res.json().catch(() => ({}));
      const remaining: number = typeof body.remaining === 'number' ? body.remaining : -1;
      if (remaining > 0) {
        toast.error(
          `${t('error_credenciales')} — ${t('intentos_restantes', { count: remaining })}`,
        );
      } else {
        toast.error(t('error_credenciales'));
      }
      setLoading(false);
      return;
    }

    // ── 5xx Server error ─────────────────────────────────────────────────────
    if (!res.ok) {
      toast.error(t('error_servidor'));
      setLoading(false);
      return;
    }

    // ── 200 Success ──────────────────────────────────────────────────────────
    const body = await res.json().catch(() => ({}));

    // Apply theme preference returned by the server
    if (body.tema === 'light' || body.tema === 'dark') {
      setTheme(body.tema);
    } else {
      // No DB preference yet — persist current localStorage theme
      fetch('/api/perfil', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tema: theme ?? 'light' }),
      }).catch(() => {});
    }

    // Apply language preference
    if (body.idioma) {
      await setLocaleAction(body.idioma as LocaleCode).catch(() => {});
    }

    router.push(body.redirectPath ?? '/login');
    router.refresh();
  }

  return (
    <div className="flex flex-col items-center">
      {/* Logo */}
      <div className="mb-8 text-center">
        <AppLogo variant="login" className="mx-auto" />
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">
          {t('subtitulo')}
        </p>
      </div>

      {/* Login Card */}
      <div className="w-full rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)] p-[var(--space-lg)] shadow-[var(--shadow-md)]">
        <h2
          className="mb-6 text-center text-xl font-semibold text-[var(--color-text-primary)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {t('titulo')}
        </h2>

        {/* eslint-disable-next-line react-hooks/refs */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-[var(--color-text-secondary)]">
              {t('email')}
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="tu@correo.com"
              {...register('email')}
              className="h-11"
            />
            {errors.email && (
              <p className="text-xs text-[var(--color-error)]">
                {errors.email.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-[var(--color-text-secondary)]">
              {t('password')}
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                {...register('password')}
                className="h-11 pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-2 top-1/2 z-10 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-secondary)]"
                aria-label={showPassword ? t('ocultar_password') : t('mostrar_password')}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-xs text-[var(--color-error)]">
                {errors.password.message}
              </p>
            )}
          </div>

          <Button
            type="submit"
            fullWidth
            loading={loading}
            disabled={loading || cooldownSeconds > 0}
          >
            {loading
              ? t('cargando')
              : cooldownSeconds > 0
                ? `${t('boton')} (${cooldownSeconds}s)`
                : t('boton')}
          </Button>
        </form>
      </div>
    </div>
  );
}
