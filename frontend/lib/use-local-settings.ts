"use client";
import { useState, useEffect } from "react";

interface LocalSettings {
  units: "metric" | "imperial";
  theme: "dark" | "light";  // 🟡 "light" is stored but not yet
                              // implemented — the whole design system
                              // (Session 10) is dark-only today; this
                              // is a real future toggle, not fake choice
}

const DEFAULTS: LocalSettings = { units: "metric", theme: "dark" };
const STORAGE_KEY = "rezon-settings";

export function useLocalSettings() {
  const [settings, setSettings] = useState<LocalSettings>(DEFAULTS);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setSettings(JSON.parse(stored));
  }, []);

  function update(partial: Partial<LocalSettings>) {
    const next = { ...settings, ...partial };
    setSettings(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  return { settings, update };
}
