# Gradly Design System — Phase 1 Foundation

**Status:** Phase 1 foundation only. This document describes the implemented token layer and the component contract for future adoption. Existing production pages and components have not been redesigned or replaced.

## 1. Product principles

- **Academic clarity:** academic progress, records and actions remain the most visually prominent content.
- **Trust through restraint:** neutral surfaces, precise typography, quiet borders and purposeful accent colour; no ornamental gradients or glass effects.
- **Predictability:** shared spacing, interaction states, component anatomy and semantic colour roles.
- **Accessible by default:** visible keyboard focus, readable contrast targets, reduced-motion support, labelled controls and touch-friendly dimensions.
- **Independent applications:** Student and Administration applications own separate builds, entry points, auth and deployment. Tokens are duplicated intentionally; no runtime cross-app import.
- **Progressive adoption:** tokens can be adopted page-by-page in later phases. This phase does not replace existing page styling.

## 2. Workspace identities

| Workspace | Accent | Accent hover | Soft accent | Purpose |
|---|---|---|---|---|
| Student platform | #168653 | #116B42 | #EAF7EF | Calm academic progress and learning |
| Admin | #175CD3 | #1849A9 | #EFF8FF | Institution operations |
| Super Admin | #6941C6 | #53389E | #F4F3FF | Platform governance |

Admin and Super Admin accents are selected through the existing document attributes `data-admin-theme` and `data-sa-theme`; existing localStorage preference keys and settings flows remain unchanged. Student supports `data-student-theme="light|dark"` and follows the operating-system colour preference when no explicit attribute is present. No new preference UI or persistence behaviour is introduced.

## 3. Semantic colour contract

Components should use semantic aliases, not raw palette values.

| Token | Light intent | Dark intent |
|---|---|---|
| `--g-bg` | App canvas | Deep canvas |
| `--g-bg-subtle` | Secondary page region | Raised dark region |
| `--g-surface` | Standard cards and panels | Standard dark surface |
| `--g-surface-raised` | Popovers and elevated panels | Elevated dark surface |
| `--g-surface-sunken` | Inputs and recessed regions | Recessed dark region |
| `--g-text` | Primary content | High-emphasis light text |
| `--g-text-secondary` | Supporting content | Secondary light text |
| `--g-text-muted` | Metadata | Muted light text |
| `--g-border` / `--g-border-strong` | Quiet / emphasized boundaries | Dark-mode boundaries |
| `--g-accent` / hover / active | Workspace identity | Accessible brightened identity |
| `--g-success` | Positive state | Positive state |
| `--g-warning` | Caution state | Caution state |
| `--g-danger` | Destructive/error state | Destructive/error state |
| `--g-info` | Informational state | Informational state |
| `--g-disabled-bg` / text | Disabled controls | Disabled controls |
| `--g-focus-ring` | Keyboard focus | Keyboard focus |

Palette values are defined centrally in each app's `design-system/tokens.css`. Status colours are never used as workspace identity colours. Do not communicate status by colour alone; pair with text or an icon.

## 4. Typography

Font stack: Manrope → Inter → system UI. No remote font request or dependency is introduced by this foundation. Numeric academic values should use tabular numerals (`font-variant-numeric: tabular-nums`) when adopted.

| Role | Token | Size / line-height | Weight |
|---|---|---|---|
| Display | `--g-text-4xl` | clamp(32px, 4vw, 40px) / 1.2 | 800 |
| Page title | `--g-text-3xl` | clamp(28px, 3vw, 32px) / 1.3 | 800 |
| Section title | `--g-text-2xl` | 24px / 1.3 | 700 |
| Card title | `--g-text-xl` | 20px / 1.3 | 700 |
| Lead | `--g-text-lg` | 18px / 1.55 | 400–500 |
| Body | `--g-text-md` | 16px / 1.55 | 400 |
| Supporting | `--g-text-sm` | 14px / 1.55 | 400–500 |
| Caption | `--g-text-xs` | 12px / 1.45 | 500 |

Use sentence case for headings and labels. Reserve uppercase and letter spacing for short eyebrow labels only. Avoid using tiny text for essential data.

## 5. Spacing and layout

Base unit: 4px. Scale: 0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96px. Use `--g-page-inline`, `--g-page-block`, `--g-section-gap`, `--g-card-padding`, `--g-form-gap`, `--g-nav-gap`, table-cell and dialog tokens rather than arbitrary values.

Content max width: 1440px. Default page gutter: clamp(16px, 3vw, 40px). Forms should use a readable max width; dense data tables may scroll within their own region rather than forcing the full viewport wider.

## 6. Surfaces and elevation

- App canvas: `--g-bg`; avoid large decorative colour fields.
- Card/panel: `--g-surface`, 1px semantic border, 14–18px radius, minimal shadow.
- Elevated panel/popover: `--g-surface-raised`, small shadow.
- Modal/dialog: semantic surface, 24px radius maximum, overlay `--g-overlay`.
- Inputs: `--g-input-bg`, strong border, 10px radius, 42px minimum height (44px touch-friendly on compact screens).
- Sidebar: semantic surface and border; workspace accent only for active/selected state.
- Radii: 4, 6, 10, 14, 18, 24px and pill. Avoid rounding every nested element.
- Shadows: xs/sm for hierarchy; md/lg only for overlays and intentionally elevated elements.

## 7. Shared component contract

The following are specifications for future component implementation, not replacements made in Phase 1. Each component consumes semantic tokens and preserves its content and behaviour.

| Component | Default and hover/active | Focus and disabled | Loading / responsive / theme |
|---|---|---|---|
| Button | Primary accent fill; secondary surface + border; tertiary text. Hover darkens or adds subtle surface; active uses pressed accent. | 3px visible focus ring; disabled uses disabled tokens and no hover. | Spinner replaces leading icon while label remains; full-width option on narrow screens; semantic tokens adapt in dark mode. |
| Icon button | 40–44px square, quiet surface; hover surface tint. | Accessible name required; same focus ring; disabled opacity/tokens. | Loading spinner; touch target at least 44px; theme-aware. |
| Input | 42px control, clear label, hint/error below; hover border emphasis. | Focus ring; disabled surface/text; invalid uses danger border plus text. | Optional inline spinner; full width on mobile; semantic input surface in both themes. |
| Select | Matches input; selected value and chevron clearly visible. | Keyboard-operable native/select-equivalent; focus ring; disabled state. | Long options wrap/truncate accessibly; full width on mobile; theme-aware menu. |
| Textarea | Same border/radius as input; resize policy explicit. | Focus ring; disabled and invalid states; errors described in text. | Optional character count/loading; full width; sensible min-height on mobile. |
| Form label | 14px medium; required marker is textual/semantic. | Programmatic association via `htmlFor`; do not rely on placeholder. | Remains above control on all widths and themes. |
| Validation message | 12–14px with error icon and concise corrective guidance. | Linked by `aria-describedby`; invalid control uses `aria-invalid`. | Wraps without clipping; danger semantic tokens in both themes. |
| Card | White/semantic surface, 1px border, 14–18px radius. Hover only when interactive. | Interactive cards use keyboard focus; disabled cards are not actionable. | Padding reduces at 480px; content-driven height; dark semantic surface. |
| Metric card | Label, prominent tabular value, context; accent reserved for trend/status. | Interactive variant has focus ring; disabled state explicit. | 2–4 column responsive grid; stack at small widths; no invented values. |
| Status badge | Compact pill with text; neutral default; status colour paired with label/icon. | Never interactive unless implemented as a control; disabled contrast remains readable. | Wraps naturally; semantic success/warning/danger/info in both themes. |
| Search field | Input with search icon and optional clear action. | Label or accessible name; clear action separately named and keyboard reachable. | Full width on mobile; no placeholder-only label; theme-aware. |
| Filter control | Labelled select/chip; selected state uses accent-soft. | Focus ring and clear selected semantics; disabled state. | Filters wrap or move to a disclosure on mobile; preserve filter state. |
| Data table | Clear header, aligned numeric columns, row separators, restrained hover. | Semantic table markup; focusable row actions; no colour-only meaning. | Container-level horizontal scroll or card transformation; sticky header only when useful; dark borders. |
| Pagination | Previous/next and current page; clear selected state. | Buttons have accessible names and disabled boundary states. | Compact labels on mobile without hiding current position; theme-aware. |
| Modal | Clear title, description, actions; overlay and restrained elevation. | `role="dialog"`, `aria-modal="true"`, labelled title, focus trap/return, Escape policy. | Near-full width with safe viewport margins on mobile; theme-aware surface. |
| Drawer | Side panel for contextual workflows; clear close control. | Same dialog naming/focus lifecycle; keyboard dismissal where safe. | Full-screen or bottom-sheet pattern on narrow screens; theme-aware. |
| Tooltip | Short supplementary explanation, not essential content. | Trigger focusable; tooltip available on keyboard focus; no hover-only content. | Avoid offscreen placement and touch-only reliance; theme-aware. |
| Alert | Icon + title/message + optional action; semantic status tone. | Use `role="status"` or `role="alert"` according to urgency. | Stack actions on mobile; semantic colours in both themes. |
| Empty state | Explain what is absent and provide a relevant next action if available. | Action uses standard button focus/disabled rules. | Compact illustration optional; avoid oversized empty panels; readable on mobile. |
| Loading state | Skeleton or spinner with stable layout; avoid fake data. | Announce meaningful wait with status semantics; respect reduced motion. | Skeletons collapse to content width; static fallback under reduced motion. |
| Error state | Plain-language cause and recovery action; preserve existing data where possible. | Announce errors; action keyboard accessible. | Text wraps; no raw technical detail unless useful; danger tokens adapt to theme. |
| Confirmation dialog | Explicit consequence, cancel and confirm actions; destructive action visually distinct. | Focus management and accessible title; safe default focus on cancel. | Stack actions on mobile; never rely on colour alone. |
| Notification surface | Clear source, message, time and read/unread state. | Announce new notifications appropriately; controls named. | Responsive list/card layout; status not conveyed only by colour. |

## 8. Responsive breakpoints and behaviour

Foundation breakpoints: 480px (small phone), 768px (tablet), 1024px (compact desktop), 1280px (desktop), 1440px (wide desktop), 1920px (ultrawide). The 320px and 375px widths are minimum QA targets, not separate layout systems.

- **320–375px:** one-column content; 16px page gutters; controls at least 44px tall; dialogs nearly full width; no viewport-level horizontal overflow.
- **480px:** compact page and card padding; filter/action groups wrap; cards remain content-first.
- **768px:** two-column grids where content supports it; navigation may become a deliberate drawer in a future layout phase.
- **1024px:** compact desktop density; tables scroll inside a bounded container.
- **1280–1440px:** 2–4 column grids based on content; maximum content width 1440px.
- **1920px:** keep content centred and capped; do not stretch paragraphs, forms or tables across the entire viewport.
- Tables must retain readable column widths; prefer local horizontal scrolling to shrinking text below 12px.
- Modal/drawer content must fit the visual viewport and remain keyboard accessible.

## 9. Accessibility baseline (WCAG 2.2 AA target)

- Text contrast: 4.5:1 for normal text; 3:1 for large text. Non-text controls and focus indicators: 3:1 against adjacent colours.
- Visible keyboard focus on every interactive element; never remove outlines without a replacement.
- All inputs have persistent labels; validation and helper text are programmatically associated.
- Keyboard order follows visual and reading order. No keyboard traps except managed modal focus, with a reliable exit.
- Dialogs require accessible names, focus placement, focus containment and focus restoration.
- Async status: use polite status announcements for routine updates and assertive alerts only for urgent errors.
- Minimum target size: 24×24 CSS px under WCAG 2.2 AA exceptions; Gradly design target is 44×44px for primary touch controls.
- Respect `prefers-reduced-motion`; avoid flashing and unnecessary movement.
- Do not communicate status or selection by colour alone.
- Reflow at 320 CSS px without two-dimensional page scrolling except content that genuinely requires it (e.g. data tables).

## 10. Theme and preference compatibility

- Existing Admin keys `gradly_admin_theme`, `gradly_admin_font`, `gradly_admin_font_size`, `gradly_admin_compact`, `gradly_admin_reduced_motion` are untouched.
- Existing Super Admin keys `gradly_sa_theme`, `gradly_sa_font`, `gradly_sa_font_size`, `gradly_sa_compact_tables`, `gradly_sa_reduced_motion` are untouched.
- The token layer reads existing document theme attributes only; it does not read/write localStorage or change settings.
- Student theme is automatic from system preference unless the existing app later supplies `data-student-theme`. No student preference UI or storage is added in this phase.
- Dark semantic values are provided, but existing page-specific hard-coded colours may not yet respond. Full page-wide theme parity requires later, explicitly approved adoption.

## 11. Implemented files in Phase 1

Each application owns its own copy:
- `src/design-system/tokens.css`
- `src/design-system/semantic-themes.css`
- `src/design-system/typography.css`
- `src/design-system/spacing.css`
- `src/design-system/surfaces.css`
- `src/design-system/motion.css`
- `src/design-system/index.css`

Both application entry points import their local design-system index. No shared runtime package, dependency, backend, API, authentication, database, environment or deployment configuration was introduced.

## 12. Explicitly not implemented

- No production component replacement or page redesign.
- No new component library or UI dependency.
- No new student theme settings UI.
- No global conversion of legacy hard-coded page colours.
- No app-shell/navigation changes.
- No auth, permissions, business logic, API, data or route changes.
- No commit/push/merge/deployment was authorized by this phase request; the branch changes are prepared as a working commit only if a separate Git action is approved.
