export const THEME_STORAGE_KEY = "hrm_theme";

export const themes = [
  { id: "emerald", name: "Emerald Atelier", description: "Calm, refined and familiar", colors: ["#149B7B", "#132747", "#E4F5EF", "#E2A73F"] },
  { id: "midnight-coral", name: "Midnight Coral", description: "Warm executive contrast", colors: ["#F29F67", "#1E1E2C", "#34B1AA", "#3B8FF3"] },
  { id: "indigo-sky", name: "Indigo Sky", description: "Confident and approachable", colors: ["#4B49AC", "#98BDFF", "#7978E9", "#F3797E"] },
  { id: "violet-aqua", name: "Violet Aqua", description: "Crisp, modern analytics", colors: ["#6F42C1", "#007BFF", "#00CCCC", "#17A2B8"] },
  { id: "orchid-mint", name: "Orchid Mint", description: "Creative, soft and premium", colors: ["#A05AFF", "#1BCFB4", "#4BCBEB", "#FE9496"] },
  { id: "azure-sun", name: "Azure Sun", description: "Bright and energetic", colors: ["#248AFD", "#F5A623", "#71C02B", "#FF4747"] },
  { id: "obsidian-rose", name: "Obsidian Rose", description: "Elegant dark workspace", colors: ["#191C24", "#AF1763", "#0D6EFD", "#FFC107"] },
] as const;

export type ThemeId = (typeof themes)[number]["id"];

export function isThemeId(value: string | null): value is ThemeId {
  return themes.some((theme) => theme.id === value);
}

export function applyTheme(theme: ThemeId) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  window.dispatchEvent(new CustomEvent("hrm-theme-change", { detail: theme }));
}

export function savedTheme(): ThemeId {
  const value = localStorage.getItem(THEME_STORAGE_KEY);
  return isThemeId(value) ? value : "emerald";
}
