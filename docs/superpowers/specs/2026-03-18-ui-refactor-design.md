# UI Refactor Design — "Vinyl Bar 2AM"

> Created: 2026-03-18 | Status: Approved

## Overview

Refactor the Antigravity Jukebox frontend from neon-purple glassmorphism to a warm, muted lo-fi aesthetic. Goal: **clean, chill, không flashy** — like a vinyl bar at 2am.

## Color System

| Token | Hex | RGB values | Usage |
|---|---|---|---|
| `base` | `#181614` | `24 22 20` | Page background |
| `surface` | `#211e1a` | `33 30 26` | Input bg, elevated surfaces |
| `card` | `#282420` | `40 36 32` | Cards, panels |
| `card-hover` | `#302c26` | `48 44 38` | Hover states |
| `border` | — | `200 168 124 / 0.08` | Subtle 1px borders |
| `border-glow` | — | `200 168 124 / 0.15` | Focus/active borders |
| `primary` | `#c8a87c` | `200 168 124` | CTAs, active states, links |
| `primary-hover` | `#b8985e` | `184 152 94` | Button hover |
| `accent` | `#8aad7c` | `138 173 124` | Success, online indicators |
| `text-primary` | `#e8e0d4` | `232 224 212` | Primary text |
| `text-secondary` | `#a09888` | `160 152 136` | Secondary text |
| `text-muted` | `#6b6560` | `107 101 96` | Timestamps, hints |
| `success` | `#8aad7c` | `138 173 124` | Same as accent |
| `danger` | `#c47a6a` | `196 122 106` | Muted red |
| `warning` | `#c4a96e` | `196 169 110` | Muted gold |

### Light theme

Out of scope for this refactor. Remove `[data-theme="light"]` styles.

## Typography

- **Display:** Syne (headings) — keep
- **Body:** DM Sans (body text) — keep
- **Mono:** JetBrains Mono — **new**, for timestamps, queue numbers, track durations, stats

## Room Layout — Tabbed Sidebar (B)

### Left column
1. **Player** — keep at top, YouTube embed + vinyl spin
2. **Add Song** — search bar below player
3. **Queue / History tabs** — queue is **collapsible**

### Right sidebar (tabbed)
Tab order: **Chat** (default) → **Members** → **Stats**

- **Chat:** full height when active, JetBrains Mono timestamps
- **Members:** avatar grid (not vertical list), compact, with kick button on hover
- **Stats:** minimal key numbers only
- ~~Lyrics~~ — removed (YouTube doesn't provide native lyrics)

## Effects

| Effect | Before | After |
|---|---|---|
| Glow borders | `shadow-glow`, `border-glow` | **Remove** → 1px rgba border |
| Backdrop blur | `backdrop-blur-xl` on cards | **Remove** or solid card bg |
| Modal backdrop | `bg-black/60 backdrop-blur-sm` | `rgba(0,0,0,0.6)` solid only |
| Noise grain | `opacity: 0.03` | Keep, reduce to `0.025` |
| Card hover | scale + glow + 300ms | `background-color` only, `150ms ease` |
| Slide-up anim | `0.3s`, many triggers | `0.2s`, fewer triggers |
| Scale-in | Cards, modals | **Remove** — fade-in only |
| Vinyl spin | `3s linear infinite` | **Keep** |
| Emoji float | `2s ease-out` | **Keep** |

## Scope

Priority order:
1. Room page (layout + palette)
2. Home page (palette only, keep grid layout)
3. Login page (palette)
4. Modals (clean up effects)
