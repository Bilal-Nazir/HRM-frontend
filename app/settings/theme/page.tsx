"use client";

import { Check, MoonStar, Palette, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { PageHeader } from "@/components/ui";
import { applyTheme, savedTheme, themes, ThemeId } from "@/lib/theme";

export default function ThemeSettingsPage() {
  const [selected, setSelected] = useState<ThemeId>("emerald");

  useEffect(() => setSelected(savedTheme()), []);

  const choose = (theme: ThemeId) => {
    setSelected(theme);
    applyTheme(theme);
  };

  return (
    <AppShell>
      <PageHeader
        eyebrow="Workspace appearance"
        title="Choose your theme"
        description="Give the entire workspace a distinct look. Your choice applies instantly and stays saved on this device."
      />
      <section className="theme-settings-card">
        <div className="theme-settings-intro">
          <span className="theme-settings-icon"><Palette size={21} /></span>
          <div><h2>Premium colour collections</h2><p>Each palette has balanced surfaces, accessible text, coordinated charts and polished interaction states.</p></div>
          <span className="theme-live-badge"><Sparkles size={14} /> Live preview</span>
        </div>
        <div className="theme-grid">
          {themes.map((theme) => {
            const active = selected === theme.id;
            return (
              <button key={theme.id} type="button" className={`theme-option ${active ? "is-selected" : ""}`} onClick={() => choose(theme.id)} aria-pressed={active}>
                <span className="theme-option-preview" data-preview-theme={theme.id}>
                  <i className="preview-sidebar"><b /><b /><b /></i>
                  <i className="preview-content"><b /><b /><b /></i>
                </span>
                <span className="theme-option-copy"><strong>{theme.name}</strong><small>{theme.description}</small></span>
                <span className="theme-swatches">{theme.colors.map((color) => <i key={color} style={{ background: color }} />)}</span>
                {active && <span className="theme-selected"><Check size={14} /> Active</span>}
                {theme.id === "obsidian-rose" && <span className="theme-dark-label"><MoonStar size={12} /> Dark</span>}
              </button>
            );
          })}
        </div>
      </section>
    </AppShell>
  );
}
