# CaseFile Design System (Redesign v2)

## Design read

Redesign-overhaul of a legal research product (landing + desk) for attorneys, students, and researchers. Cold dark research-console language. Not marketing SaaS purple, not warm cream legal cliché.

**Dials:** VARIANCE 7 · MOTION 6 · DENSITY 6  
**Theme lock:** dark throughout (landing and workspace share one surface family)

## Type

| Role | Family |
|------|--------|
| Display + UI | **Outfit** (400/500/600/700) |
| Mono / data | **IBM Plex Mono** (400/500) |

Scale: xs 0.75 / sm 0.875 / base 1 / md 1.125 / lg 1.25 / xl 1.5 / 2xl 2 / 3xl clamp(2rem, 4vw, 2.85rem)

## Color

| Token | Hex | Role |
|-------|-----|------|
| `--bg` | `#0E1116` | Page |
| `--surface` | `#161B22` | Panels |
| `--surface-2` | `#1C232D` | Elevated / hover |
| `--line` | `#2A313C` | Borders |
| `--line-strong` | `#3A4452` | Focus edges |
| `--text` | `#E8EAEF` | Primary |
| `--text-soft` | `#A8B0BD` | Secondary |
| `--text-mute` | `#6F7886` | Meta |
| `--accent` | `#5B9A7D` | Forest CTA / active |
| `--accent-hover` | `#4A8569` | Pressed |
| `--accent-soft` | `rgba(91, 154, 125, 0.14)` | Soft fills |
| `--warn` | `#C4A35A` | Partial text |
| `--danger` | `#C45C5C` | Errors |
| `--shadow` | `rgba(0, 0, 0, 0.35)` | Elevation |

## Shape

| Token | Value | Use |
|-------|-------|-----|
| `--r-sm` | 2px | Chips, inputs inner |
| `--r-md` | 6px | Buttons, controls |
| `--r-lg` | 10px | Panels, media |
| `--r-pill` | 999px | Suggestion chips only |

Rule: buttons and panels use `--r-md` / `--r-lg`. Full pill reserved for suggestion chips.

## Motion

Ease: `cubic-bezier(0.16, 1, 0.3, 1)`  
Durations: 160ms UI, 400ms reveal  
Animate `transform` / `opacity` only. Honor `prefers-reduced-motion`.

## Preserve

- IA: Overview / Research desk
- Search → list → detail → extract → JSON export
- CourtListener integration
- Existing photography assets
