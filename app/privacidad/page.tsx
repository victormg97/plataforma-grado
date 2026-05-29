import { getTranslations, getLocale } from "next-intl/server";
import { MarkdownRenderer } from "@/components/common/MarkdownRenderer";
import { BackButton } from "@/components/common/BackButton";
import { tenantConfig } from "@/config";
import { createClient } from "@/lib/supabase/server";
import { WhoWeAreSection } from "./WhoWeAreSection";
import {
  formatOwnerNames,
  formatOwnerEmails,
  loadLegalDocument,
} from "@/lib/tenant-utils";

export async function generateMetadata() {
  const t = await getTranslations("privacidad");
  return {
    title: `${t("titulo")} — ${tenantConfig.nombre}`,
    description: t("descripcion", { appName: tenantConfig.nombre }),
  };
}

async function checkWhoWeAreContent(tenantSlug: string, locale: string): Promise<boolean> {
  try {
    const supabase = await createClient();

    // Try locale-specific first
    const localePath = `content/tenants/${tenantSlug}/${locale}/quienes-somos.md`;
    const { data: localeData } = supabase.storage.from('content').getPublicUrl(localePath);
    if (localeData?.publicUrl) {
      const res = await fetch(localeData.publicUrl, { method: 'HEAD' });
      if (res.ok) return true;
    }

    // Fall back to Spanish
    if (locale !== 'es') {
      const esPath = `content/tenants/${tenantSlug}/es/quienes-somos.md`;
      const { data: esData } = supabase.storage.from('content').getPublicUrl(esPath);
      if (esData?.publicUrl) {
        const res = await fetch(esData.publicUrl, { method: 'HEAD' });
        if (res.ok) return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

export default async function PrivacidadPage() {
  const locale = await getLocale();

  const { content: raw } = loadLegalDocument(
    "privacidad",
    tenantConfig.id,
    locale
  );

  const content = raw
    .replaceAll("{{APP_NAME}}", tenantConfig.nombre)
    .replaceAll("{{OWNER_NAME}}", formatOwnerNames(tenantConfig.propietarios))
    .replaceAll("{{OWNER_EMAIL}}", formatOwnerEmails(tenantConfig.propietarios));

  const hasWhoWeAreContent = await checkWhoWeAreContent(tenantConfig.id, locale);

  return (
    <div className="container-app py-12 max-w-2xl mx-auto">
      <BackButton className="mb-6" />
      <MarkdownRenderer content={content} />
      {hasWhoWeAreContent && (
        <div style={{ marginTop: 'var(--space-lg)' }}>
          <WhoWeAreSection tenantSlug={tenantConfig.id} locale={locale} />
        </div>
      )}
    </div>
  );
}
