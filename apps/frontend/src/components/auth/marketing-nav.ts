import { BarChart3, FileText, HelpCircle, Info, Sparkles } from "lucide-react";

import type { TranslationKey } from "@helpmycv/shared";

import type { NavBarItem } from "@/components/ui/tubelight-navbar";

/**
 * Marketing nav links.
 *
 * Lives next to the front page so the icon set and the key order are defined
 * once; labels still go through `t()` at the call site, which is why this
 * takes the translator rather than a locale.
 */
export const MARKETING_NAV_ICONS = {
  home: Info,
  features: Sparkles,
  pricing: BarChart3,
  about: FileText,
  faq: HelpCircle,
} as const;

export type MarketingNavKey = keyof typeof MARKETING_NAV_ICONS;

export const MARKETING_NAV_KEYS: MarketingNavKey[] = ["home", "features", "pricing", "about", "faq"];

export function buildMarketingNav(
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string,
): NavBarItem[] {
  return MARKETING_NAV_KEYS.map((key) => ({
    name: t(`nav.${key}` as TranslationKey),
    url: `/#${key}`,
    icon: MARKETING_NAV_ICONS[key],
  }));
}
