import { readFileSync } from "fs";
import { join } from "path";
import { getTranslations, getLocale } from "next-intl/server";
import { MarkdownRenderer } from "@/components/common/MarkdownRenderer";
import { BackButton } from "@/components/common/BackButton";
import { tenantConfig } from "@/config";
import { formatOwnerNames, formatOwnerEmails } from "@/lib/tenant-utils";

export async function generateMetadata() {
  const t = await getTranslations("terminos");
  return {
    title: `${t("titulo")} — ${tenantConfig.nombre}`,
    description: t("descripcion", { appName: tenantConfig.nombre }),
  };
}

export default async function TerminosPage() {
  const locale = await getLocale();
  const raw = readFileSync(
    join(process.cwd(), "content", locale, "terminos.md"),
    "utf-8"
  );

  const content = raw
    .replaceAll("{{APP_NAME}}", tenantConfig.nombre)
    .replaceAll("{{OWNER_NAME}}", formatOwnerNames(tenantConfig.propietarios))
    .replaceAll("{{OWNER_EMAIL}}", formatOwnerEmails(tenantConfig.propietarios));

  return (
    <div className="container-app py-12 max-w-2xl mx-auto">
      <BackButton className="mb-6" />
      <MarkdownRenderer content={content} />
    </div>
  );
}
