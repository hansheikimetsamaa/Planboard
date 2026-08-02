import { useLocalization } from "cs2/l10n";

export const fallbackKindLabels = ["Issue", "Note", "Idea"] as const;
export const fallbackStatusLabels = ["Open", "Doing", "Done"] as const;
export const fallbackPriorityLabels = ["None", "Low", "Medium", "High"] as const;
export const fallbackCategoryLabels = [
  "Traffic", "Roads", "Public Transport", "Walking & Cycling", "Zoning & Development",
  "City Services", "Utilities", "Parks & Public Space", "Future Project", "General"
] as const;

const localized = (translate: (key: string, fallback?: string) => string, group: string, fallbacks: readonly string[]) =>
  fallbacks.map((fallback, index) => translate(`Planboard.${group}.${index}`, fallback) ?? fallback);

export function usePlanboardLocale() {
  const { translate } = useLocalization();
  const t = (key: string, fallback: string) => translate(`Planboard.UI.${key}`, fallback) ?? fallback;
  return {
    t,
    kindLabels: localized(translate, "Kind", fallbackKindLabels),
    statusLabels: localized(translate, "Status", fallbackStatusLabels),
    priorityLabels: localized(translate, "Priority", fallbackPriorityLabels),
    categoryLabels: localized(translate, "Category", fallbackCategoryLabels),
  };
}
