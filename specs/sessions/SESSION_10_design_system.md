# SESSION 10 — Frontend Design System
**Risk tier: ROUTINE (no hardware, no safety-critical logic — first frontend session, real code, standard verification).**
**Branch: `session/build-10-design-system`**
**Attach: `05_FRONTEND_TECHNICAL_SPEC.md` §1-2, `specs/frontend-research/FRONTEND_ELEVATION_VISION.md`**

---

## Agent Instructions

Bootstrap the Next.js project and establish the design system — colors, typography, base Tailwind config — that every later frontend session builds on. No pages yet, no data fetching — this is foundation only.

**What this session creates:**
- `frontend/` — new Next.js App Router project
- `frontend/tailwind.config.ts` — the real design tokens, not defaults
- `frontend/app/globals.css` — CSS custom properties matching Frontend Spec §2 exactly
- `frontend/lib/utils.ts` — shadcn/ui's required `cn()` helper
- `frontend/components.json` — shadcn/ui configuration

---

## FILE 1: `frontend/app/globals.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Exact values from 05_FRONTEND_TECHNICAL_SPEC.md §2 — re-verified
   against the live spec before writing, not from memory. The color
   comment mapping (calm/elevated/danger) is preserved here so the
   connection to AI/ML Spec §7.3's real thresholds (0.75/0.85) stays
   visible in the code, not just in the spec document. */
:root {
  --bg: #0a0d12;
  --surface: #12161d;
  --surface-2: #1a2029;
  --border: #242b36;
  --text: #e8edf4;
  --text-2: #8b95a5;
  --text-3: #5a6272;

  --calm: #3fb0c9;         /* normalized_score < 0.75 */
  --calm-bg: #0f2a30;
  --elevated: #e0a030;     /* 0.75 <= score < 0.85 */
  --elevated-bg: #2b2210;
  --danger: #e0524a;       /* score >= 0.85 */
  --danger-bg: #2d1414;

  /* shadcn/ui's expected variable names, mapped onto our tokens rather
     than shadcn's own defaults — keeps every shadcn component
     automatically dark-command-center-themed with zero per-component
     overrides needed. */
  --background: var(--bg);
  --foreground: var(--text);
  --card: var(--surface);
  --card-foreground: var(--text);
  --border-color: var(--border);
  --muted: var(--surface-2);
  --muted-foreground: var(--text-2);
  --primary: var(--calm);
  --destructive: var(--danger);
  --radius: 0.75rem;
}

body {
  background: var(--bg);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
```

## FILE 2: `frontend/tailwind.config.ts`

```typescript
import type { Config } from "tailwindcss";

// Score-to-color mapping as a Tailwind-callable utility, not just a
// CSS variable — used directly in Session 15+ (e.g., className={scoreColor(score)}),
// so the mapping logic lives in exactly one place.
export function scoreToColorToken(normalizedScore: number): "calm" | "elevated" | "danger" {
  if (normalizedScore >= 0.85) return "danger";   // AI/ML Spec §7.3
  if (normalizedScore >= 0.75) return "elevated";
  return "calm";
}

const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        border: "var(--border)",
        text: "var(--text)",
        "text-2": "var(--text-2)",
        "text-3": "var(--text-3)",
        calm: { DEFAULT: "var(--calm)", bg: "var(--calm-bg)" },
        elevated: { DEFAULT: "var(--elevated)", bg: "var(--elevated-bg)" },
        danger: { DEFAULT: "var(--danger)", bg: "var(--danger-bg)" },
      },
      borderRadius: {
        DEFAULT: "var(--radius)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
```

## FILE 3: `frontend/lib/utils.ts`

```typescript
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Standard shadcn/ui helper — required by every shadcn component's
// generated code, not REZON-specific, included here since Session 11's
// core components depend on it existing.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

## FILE 4: `frontend/lib/score-color.ts`

```typescript
// The single source of truth for score->color mapping, importable by
// any component (Session 15's digital twin, Session 16's streams, etc.)
// rather than each page re-implementing the same three-way threshold
// check — one place to update if AI/ML Spec §7.3's thresholds ever
// change post-burn-in-calibration.
import { scoreToColorToken } from "../tailwind.config";

export function scoreColorClass(normalizedScore: number, variant: "text" | "bg" = "text"): string {
  const token = scoreToColorToken(normalizedScore);
  return variant === "text" ? `text-${token}` : `bg-${token}-bg`;
}
```

## FILE 5: `frontend/components.json`

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "app/globals.css",
    "baseColor": "slate",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils"
  }
}
```

---

## Verification Steps

**Step 1:** `npx create-next-app@latest frontend --typescript --tailwind --app` (or equivalent current command — 🟡 verify against Next.js's current CLI before running, per `SESSION_GENERATION_PROTOCOL.md`'s "search, don't recall" discipline for anything version-dependent), then apply FILE 1-5 above.

**Step 2:** `npx shadcn@latest init` using the `components.json` above, then `npx shadcn@latest add button card badge` (the first 3 primitives Session 11 needs).

**Step 3:** `npm run dev` — expected: a blank page renders with the dark background (`#0a0d12`), confirming the CSS variables are actually wired, not just declared.

**Step 4 (unit test):** `scoreToColorToken(0.5)` → `"calm"`, `scoreToColorToken(0.8)` → `"elevated"`, `scoreToColorToken(0.9)` → `"danger"` — literal expected values matching AI/ML Spec §7.3's exact thresholds, the same test pattern already used for the on-device C equivalent.

## Known open items
None — this session is genuinely self-contained; nothing here depends on unresolved state from Phase 1.
