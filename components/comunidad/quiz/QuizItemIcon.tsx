'use client';

/* eslint-disable @next/next/no-img-element -- tiny public storage icons; next/image adds nothing here */
import type { CSSProperties } from 'react';
import {
  Anchor, Baby, Banknote, BookOpen, Brain, Briefcase, Building2, Calculator, Car, Coins, Compass,
  Crown, Factory, Feather, FileText, Flag, Gavel, Globe, GraduationCap, Hammer, Handshake,
  HeartHandshake, House, Landmark, Layers, Leaf, Library, Lightbulb, Lock, Plane, Puzzle, Receipt,
  Scale, ScrollText, ShieldCheck, Ship, Siren, Sparkles, Stamp, Star, Swords, Target, Trophy, Users,
  type LucideIcon,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { QUIZ_ICON_BUCKET, isQuizColorKey, type QuizIconKey } from '@/lib/comunidad/quiz-display';

export const QUIZ_ICONS: Record<QuizIconKey, LucideIcon> = {
  'book-open': BookOpen, scale: Scale, gavel: Gavel, landmark: Landmark, scroll: ScrollText,
  'file-text': FileText, library: Library, graduation: GraduationCap, briefcase: Briefcase,
  building: Building2, factory: Factory, users: Users, house: House, 'heart-handshake': HeartHandshake,
  handshake: Handshake, baby: Baby, shield: ShieldCheck, lock: Lock, siren: Siren, stamp: Stamp,
  coins: Coins, banknote: Banknote, receipt: Receipt, calculator: Calculator, globe: Globe,
  compass: Compass, ship: Ship, plane: Plane, car: Car, anchor: Anchor, leaf: Leaf, hammer: Hammer,
  brain: Brain, lightbulb: Lightbulb, puzzle: Puzzle, target: Target, layers: Layers, trophy: Trophy,
  star: Star, crown: Crown, flag: Flag, feather: Feather, swords: Swords, sparkles: Sparkles,
};

/** Public URL of an uploaded icon (no network: URL is derived locally). */
export function quizIconUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const { data } = createClient().storage.from(QUIZ_ICON_BUCKET).getPublicUrl(path);
  return data.publicUrl ?? null;
}

/**
 * CSS custom properties for an item's color. Without a configured color it
 * follows the game accent (burgundy, or gold in the graduado theme).
 */
export function quizToneStyle(colorKey: string | null | undefined): CSSProperties {
  if (isQuizColorKey(colorKey)) {
    return {
      ['--tone' as string]: `var(--quiz-tone-${colorKey})`,
      ['--tone-deep' as string]: `var(--quiz-tone-${colorKey}-deep)`,
      ['--tone-soft' as string]: `var(--quiz-tone-${colorKey}-soft)`,
    };
  }
  return {
    ['--tone' as string]: 'var(--game-accent, var(--quiz-tone-burgundy))',
    ['--tone-deep' as string]: 'var(--game-header-bg, var(--quiz-tone-burgundy-deep))',
    ['--tone-soft' as string]: 'var(--game-accent-muted, var(--quiz-tone-burgundy-soft))',
  };
}

/**
 * Icon of a subject/category: uploaded image > gallery icon > default.
 * Inherits text color; images are shown as-is (object-contain).
 */
export function QuizItemIcon({
  iconKey,
  imagePath,
  fallback,
  className,
}: {
  iconKey?: string | null;
  imagePath?: string | null;
  fallback: QuizIconKey;
  className?: string;
}) {
  const url = quizIconUrl(imagePath);
  if (url) {
    return <img src={url} alt="" aria-hidden className={cn('object-contain', className)} loading="lazy" />;
  }
  const Icon = (iconKey && QUIZ_ICONS[iconKey as QuizIconKey]) || QUIZ_ICONS[fallback];
  return <Icon className={className} aria-hidden />;
}
