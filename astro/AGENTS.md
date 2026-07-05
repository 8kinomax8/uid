## Project Context

This Astro app is the current UID website for the Union Instrumentale de Delemont. Treat `PRODUCT.md` at the repository root as the product brief: brand site, vibrant but precise, intergenerational, music-first, not a generic association or municipal template.

Key implementation decisions to preserve:

- The site uses local Apfel Grotezk fonts from `public/fonts`: Satt for `h1`, Fett for `h2`, Mittel for `h3`, and Regular for the rest of the UI/body text.
- The custom pointer uses `public/baguette_cursor.png` plus the `.wand-cursor` overlay in `src/layouts/BaseLayout.astro`, `src/scripts/motion.ts`, and `src/styles/global.css`. Keep it larger and shadowed.
- The theme switcher is a vanilla Astro/TypeScript adaptation of the Magic UI animated theme toggler. It lives in `src/components/Header.astro`, `src/scripts/motion.ts`, and the View Transitions CSS in `src/styles/global.css`. Do not add React just for this toggle.
- The site supports dark and light themes through `html[data-theme]`, persisted in `localStorage` under `uid-theme`.
- Prefer the user's local images in `public/images` when they match the content: `cadets.jpg`, `banniere_cadets.png`, `banniere_lutins.png`, `animatrices_lutins.png`, `biagio_musumeci.jpg`, logos, and lutins/cadets assets. Use generic `event-*` images only when there is no better content-specific asset.
- Section headings use the `.section-heading` pattern: kicker on top, `h2` left and wide, descriptive paragraph to the right on desktop, one column on mobile. Avoid reintroducing large vertical gaps between the kicker, heading, and paragraph.
- The Harmonie desktop submenu relies on `.nav-cluster::after` as a hover bridge. Preserve that so the submenu does not disappear while moving the pointer into it.
- The full-screen intro text animation was intentionally removed; do not re-add a splash/intro page.
- The legal page is `/mentions-legales/` and should remain linked from the footer.

Verification notes:

- Use `env ASTRO_TELEMETRY_DISABLED=1 npm run build` for builds, because plain Astro build may try to write telemetry config outside the sandbox.
- The dev server is usually available at `http://127.0.0.1:4321`; use `npm run dev -- --host 127.0.0.1` if needed.
- When checking layout, verify both desktop and mobile widths for overflow and text fit.

## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
