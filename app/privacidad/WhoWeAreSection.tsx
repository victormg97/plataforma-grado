'use client';

import { WhoWeAre } from '@/components/common/WhoWeAre';

interface WhoWeAreSectionProps {
  tenantSlug: string;
  locale: string;
}

export function WhoWeAreSection({ tenantSlug, locale }: WhoWeAreSectionProps) {
  return <WhoWeAre tenantSlug={tenantSlug} locale={locale} />;
}
