'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/common/Button';
import { TerminosAceptacion } from '@/components/auth/TerminosAceptacion';
import {
  CAMPOS_OBLIGATORIOS,
  PASSWORD_MAX,
  PASSWORD_MIN,
  registroEsValido,
  type RegistroFormData,
  type TipoRegistro,
} from '@/lib/validations/registro';
import { validarEmail, validarTelefono } from '@/lib/validations/contacto';

interface FormularioRegistroProps {
  code: string;
  tipo: TipoRegistro;
}

type Campos = Partial<RegistroFormData>;

export function FormularioRegistro({ code, tipo }: FormularioRegistroProps) {
  const t = useTranslations('registro');
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  const [form, setForm] = useState<Campos>({ aceptaTyC: false });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const obligatorios = CAMPOS_OBLIGATORIOS[tipo] as readonly string[];

  const set = (campo: keyof RegistroFormData, valor: string | boolean) =>
    setForm((f) => ({ ...f, [campo]: valor }));

  const marcarTocado = (campo: string) =>
    setTouched((tch) => ({ ...tch, [campo]: true }));

  const valido = useMemo(() => registroEsValido(form, tipo), [form, tipo]);

  const esVacio = (campo: string) => {
    const v = (form as Record<string, unknown>)[campo];
    return typeof v !== 'string' || v.trim().length === 0;
  };

  // Resultados de validación de email/teléfono (memoizados).
  const emailResult = useMemo(
    () => (form.email ? validarEmail(form.email) : { valido: false }),
    [form.email],
  );
  const telResult = useMemo(
    () =>
      form.telefono && form.telefono.trim() !== ''
        ? validarTelefono(form.telefono)
        : { valido: true, normalizado: '' },
    [form.telefono],
  );

  const passwordCorta =
    (form.password ?? '').length > 0 && (form.password ?? '').length < PASSWORD_MIN;
  const passwordLarga = (form.password ?? '').length > PASSWORD_MAX;
  const noCoinciden =
    !!form.password && !!form.confirmar && form.password !== form.confirmar;

  // ── Navegación por teclado ──
  // Enter avanza al siguiente input del formulario; en el último, si el
  // formulario es válido, envía. Combinado con `enterKeyHint`, los teclados
  // móviles muestran "Siguiente"/"Ir".
  const handleEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const formEl = formRef.current;
    if (!formEl) return;
    const inputs = Array.from(
      formEl.querySelectorAll<HTMLInputElement>(
        'input:not([type="checkbox"]):not([type="hidden"]):not([disabled])',
      ),
    );
    const idx = inputs.indexOf(e.currentTarget);
    if (idx >= 0 && idx < inputs.length - 1) {
      inputs[idx + 1].focus();
    } else {
      // Último input: intentar enviar.
      formEl.requestSubmit();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (!valido) return;

    setLoading(true);
    try {
      const res = await fetch('/api/registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, datos: form }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (data.error === 'EMAIL_EN_USO') toast.error(t('error_email_en_uso'));
        else if (data.error === 'ENLACE_NO_DISPONIBLE' || data.error === 'ENLACE_USADO')
          toast.error(t('error_enlace_no_disponible'));
        else toast.error(t('error_servidor'));
        setLoading(false);
        return;
      }

      router.push(data.redirectPath ?? '/login');
      router.refresh();
    } catch {
      toast.error(t('error_servidor'));
      setLoading(false);
    }
  };

  // Campo de texto genérico con asterisco, error inline y navegación por Enter.
  const campoTexto = (
    campo: keyof RegistroFormData,
    labelKey: string,
    opts: { type?: string; obligatorio?: boolean; enterKeyHint?: 'next' | 'go' } = {},
  ) => {
    const obligatorio = opts.obligatorio ?? obligatorios.includes(campo);
    const mostrarError = (submitted || touched[campo]) && obligatorio && esVacio(campo);
    return (
      <div className="space-y-1.5">
        <Label htmlFor={campo} className="text-[var(--color-text-secondary)]">
          {t(labelKey)}
          {obligatorio && <span className="ml-0.5 text-[var(--color-error)]">*</span>}
        </Label>
        <Input
          id={campo}
          type={opts.type ?? 'text'}
          value={(form[campo] as string) ?? ''}
          onChange={(e) => set(campo, e.target.value)}
          onBlur={() => marcarTocado(campo)}
          onKeyDown={handleEnter}
          enterKeyHint={opts.enterKeyHint ?? 'next'}
          className="h-11"
          aria-invalid={mostrarError}
        />
        {mostrarError && (
          <p className="text-xs text-[var(--color-error)]">{t('campo_requerido')}</p>
        )}
      </div>
    );
  };

  // Mostrar feedback de email/teléfono cuando el campo fue tocado o tras enviar.
  const mostrarEmail = submitted || touched.email;
  const mostrarTel = submitted || touched.telefono;

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {campoTexto('nombre', 'campo_nombre')}
        {campoTexto('apellido', 'campo_apellido')}
        {campoTexto('apellido_materno', 'campo_apellido_materno')}
        <div className="space-y-1.5">
          <Label htmlFor="telefono" className="text-[var(--color-text-secondary)]">
            {t('campo_telefono')}
          </Label>
          <Input
            id="telefono"
            type="tel"
            inputMode="tel"
            value={form.telefono ?? ''}
            onChange={(e) => set('telefono', e.target.value)}
            onBlur={() => marcarTocado('telefono')}
            onKeyDown={handleEnter}
            enterKeyHint="next"
            className="h-11"
            aria-invalid={mostrarTel && !telResult.valido}
          />
          {mostrarTel && !telResult.valido && (
            <p className="text-xs text-[var(--color-error)]">{t('telefono_invalido')}</p>
          )}
        </div>
      </div>

      {/* Correo con validación de sintaxis y sugerencia de corrección */}
      <div className="space-y-1.5">
        <Label htmlFor="email" className="text-[var(--color-text-secondary)]">
          {t('campo_email')}<span className="ml-0.5 text-[var(--color-error)]">*</span>
        </Label>
        <Input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={form.email ?? ''}
          onChange={(e) => set('email', e.target.value)}
          onBlur={() => marcarTocado('email')}
          onKeyDown={handleEnter}
          enterKeyHint="next"
          className="h-11"
          aria-invalid={mostrarEmail && !emailResult.valido}
        />
        {mostrarEmail && !emailResult.valido && (
          <p className="text-xs text-[var(--color-error)]">{t('email_invalido')}</p>
        )}
        {/* Sugerencia de corrección (errata de dominio/TLD) */}
        {emailResult.sugerencia && (
          <p className="text-xs text-[var(--color-text-muted)]">
            {t.rich('email_sugerencia', {
              sugerencia: emailResult.sugerencia,
              s: (chunks) => (
                <button
                  type="button"
                  onClick={() => {
                    set('email', emailResult.sugerencia!);
                    marcarTocado('email');
                  }}
                  className="font-medium text-[var(--color-brand-gold)] underline underline-offset-2 hover:opacity-80"
                >
                  {chunks}
                </button>
              ),
            })}
          </p>
        )}
      </div>

      {tipo === 'alumno' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {campoTexto('universidad', 'campo_universidad')}
          {campoTexto('año_egreso', 'campo_anio_egreso')}
        </div>
      )}

      {/* Contraseña */}
      <div className="space-y-1.5">
        <Label htmlFor="password" className="text-[var(--color-text-secondary)]">
          {t('campo_password')}<span className="ml-0.5 text-[var(--color-error)]">*</span>
        </Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            value={form.password ?? ''}
            onChange={(e) => set('password', e.target.value)}
            onKeyDown={handleEnter}
            enterKeyHint="next"
            autoComplete="new-password"
            className="h-11 pr-11"
            placeholder={t('placeholder_password')}
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? t('ocultar_password') : t('mostrar_password')}
            className="absolute right-2 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-secondary)]"
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        {passwordCorta && <p className="text-xs text-[var(--color-error)]">{t('password_corta')}</p>}
        {passwordLarga && <p className="text-xs text-[var(--color-error)]">{t('password_larga')}</p>}
      </div>

      {/* Repetir contraseña */}
      <div className="space-y-1.5">
        <Label htmlFor="confirmar" className="text-[var(--color-text-secondary)]">
          {t('campo_confirmar')}<span className="ml-0.5 text-[var(--color-error)]">*</span>
        </Label>
        <div className="relative">
          <Input
            id="confirmar"
            type={showPassword ? 'text' : 'password'}
            value={form.confirmar ?? ''}
            onChange={(e) => set('confirmar', e.target.value)}
            onKeyDown={handleEnter}
            enterKeyHint="go"
            autoComplete="new-password"
            className="h-11 pr-11"
            placeholder={t('placeholder_password')}
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? t('ocultar_password') : t('mostrar_password')}
            className="absolute right-2 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-secondary)]"
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        {noCoinciden && <p className="text-xs text-[var(--color-error)]">{t('no_coinciden')}</p>}
      </div>

      {/* Términos y Condiciones */}
      <div className="pt-1">
        <TerminosAceptacion
          checked={form.aceptaTyC === true}
          onChange={(v) => set('aceptaTyC', v)}
          label={t('terminos_label')}
          linkLabel={t('terminos_link')}
        />
        {submitted && form.aceptaTyC !== true && (
          <p className="mt-1 flex items-center gap-1 text-xs text-[var(--color-error)]">
            <AlertCircle className="size-3" />
            {t('terminos_requerido')}
          </p>
        )}
      </div>

      <Button type="submit" fullWidth loading={loading} disabled={loading || !valido}>
        {loading ? t('creando') : t('boton_crear')}
      </Button>
    </form>
  );
}
