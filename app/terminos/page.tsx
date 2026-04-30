import { readFileSync } from "fs";
import { join } from "path";
import { getTranslations, getLocale } from "next-intl/server";
import { MarkdownRenderer } from "@/components/common/MarkdownRenderer";
import { BackButton } from "@/components/common/BackButton";

export async function generateMetadata() {
  const t = await getTranslations("terminos");
  return {
    title: `${t("titulo")} — CTA Graduados`,
    description: t("descripcion"),
  };
}

export default async function TerminosPage() {
  const locale = await getLocale();
  const content = readFileSync(
    join(process.cwd(), "content", locale, "terminos.md"),
    "utf-8"
  );

  return (
    <div className="container-app py-12 max-w-2xl mx-auto">
      <BackButton className="mb-6" />
      <MarkdownRenderer content={content} />
    </div>
  );
}
