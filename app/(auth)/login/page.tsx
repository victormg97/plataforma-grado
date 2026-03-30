'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { getRolRedirectPath } from '@/lib/auth/helpers';
import { loginSchema, type LoginFormData } from '@/lib/validations/auth.schema';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/common/Button';
import { AppLogo } from '@/components/common/AppLogo';
import type { UserRol } from '@/lib/supabase/types';

export default function LoginPage() {
  const t = useTranslations('auth.login');
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(data: LoginFormData) {
    setLoading(true);
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (error) {
      toast.error(t('error_credenciales'));
      setLoading(false);
      return;
    }

    // Get user profile to determine role
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profile) {
        router.push(getRolRedirectPath(profile.rol));
        router.refresh();
        return;
      }
    }

    toast.error(t('error_generico'));
    setLoading(false);
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
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              {...register('password')}
              className="h-11"
            />
            {errors.password && (
              <p className="text-xs text-[var(--color-error)]">
                {errors.password.message}
              </p>
            )}
          </div>

          <Button type="submit" fullWidth loading={loading}>
            {loading ? t('cargando') : t('boton')}
          </Button>
        </form>
      </div>
    </div>
  );
}
