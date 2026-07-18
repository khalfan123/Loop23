# Loop9 front website — design handoff (2060)

Design package from **AI call center dashboard 2060**. Use this branch to rebuild the **public marketing site** from these references.

## Website (front) sources

| File | Role |
|------|------|
| `Loop9 Website v4.dc.html` | **Preferred** marketing landing (hero: “Answer smarter, resolve faster”) |
| `Loop9 Website.dc.html` | Alternate fuller marketing page (product / how / pricing) |
| `modernist.css`, `support.js`, `image-slot.js` | Design-canvas runtime helpers for the `.dc.html` files |
| `_ds/modernist-…/` | Design-system tokens / styles from the canvas |
| `uploads/` | Pasted reference images used by the comps |

Preview locally:

```bash
npx serve docs/design/website-handoff-2060
```

Then open `Loop9 Website v4.dc.html` or `Loop9 Website.dc.html`.

## App shell / dashboard (separate)

| File | Role |
|------|------|
| `AURA Command.dc.html` / `Loop9.dc.html` | In-app Analytics/dashboard visual reference (not production React) |
| `design_handoff_loop9_redesign/README.md` | Spec for applying that look across the product UI |

## Implementation notes

- These HTML files are **design prototypes**, not drop-in production code.
- Rebuild the public site in `client/` (landing routes under `/`, `/features`, `/pricing`, etc.) matching this look.
- Keep product app routes under `/app` unchanged unless you intentionally take on the dashboard handoff as well.

## Branch

`website/front-template-2060` — holds this handoff and subsequent front-website work.
