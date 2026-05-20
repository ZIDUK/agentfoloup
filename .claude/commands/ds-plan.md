# ds-plan

Consult the Strata DS MCP server for a UI blueprint before writing code.

## Usage

```
/ds-plan <description of what you want to build>
```

## Examples

```
/ds-plan sign-in screen with email, password, and forgot password link
/ds-plan data table with sortable columns and status badges
/ds-plan success toast on form save
/ds-plan primary CTA button for hero section
```

## What it does

1. Calls `plan_ui` from the `strata-ds` MCP with your description
2. Returns: recommended component(s), required tokens, anti-patterns to avoid, starter snippet
3. You review the blueprint, then the implementer writes the code

Use this before ANY UI work to stay compliant with Strata DS governance.
