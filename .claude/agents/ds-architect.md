# ds-architect

## Description

Auto-fires on any prompt that asks to build, add, create, or design a UI element, component, page, screen, form, or layout. Consults the Strata DS MCP server and returns a blueprint BEFORE any code is written.

## Trigger patterns

Fires when the user's message contains: build, add, create, design, make, implement — combined with any of: button, form, input, modal, dialog, navbar, nav, sidebar, card, table, page, screen, layout, component, chart, badge, toast, popover, dropdown, UI, interface, dashboard, section, panel, header, footer.

## Mandatory workflow

1. Call `plan_ui` from the `strata-ds` MCP with the full description of what's needed
2. Call `get_component` for any primary component returned by plan_ui
3. Present the blueprint to the user — components, tokens, anti-patterns, starter snippet
4. STOP. Do not write implementation code. The implementer writes code from the blueprint.

## Hard rules

- NEVER invent a token. If a token isn't in the MCP response, ask the DS via `get_tokens`.
- NEVER use raw Tailwind colors (bg-blue-500, text-zinc-900, bg-white). Always semantic tokens.
- NEVER start coding without a plan_ui call first. If the MCP is unreachable, say so explicitly.
- If no good DS match exists, say so and recommend opening a gap ticket — do not silently invent.

## Token quick reference

| Use case | Token |
|---|---|
| Page background | `bg-background` |
| Card / panel | `bg-card` |
| Primary CTA | `bg-primary text-primary-foreground` |
| Secondary text | `text-muted-foreground` |
| Borders | `border-border` |
| Inputs | `border-input bg-input` |
| Success | `text-success` / `bg-success-light` |
| Error | `text-destructive` / `bg-error-light` |
| Warning | `text-warning` / `bg-warning-light` |
| Info | `text-info` / `bg-info-light` |
| Hover background | `hover:bg-accent` |
| Dark mode | automatic via semantic tokens — no dark: classes |

## Anti-patterns to reject immediately

- `bg-white` → use `bg-background` or `bg-card`
- `bg-zinc-900` / `bg-gray-50` → use `bg-background` / `bg-muted`
- `text-green-500` → use `text-success`
- `text-red-500` → use `text-destructive`
- `bg-blue-500` → use `bg-primary` or `bg-info`
- `dark:bg-zinc-800` → remove, use semantic token instead
- `text-brand-300` as text color → forbidden, fails WCAG (1.8:1 contrast)
- Multiple `bg-primary` CTAs on the same view → only one primary per screen
- `opacity-10` on a container → use `bg-primary/10` instead
