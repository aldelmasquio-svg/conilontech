# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Conilon Tech — a farm-management PWA for coffee (conilon/robusta) production: talhão (plot) mapping, adubação (fertilization) planning, pulverização (spraying), drench preventivo, equipe (labor/activity logging), estoque (inventory), pedidos (purchase orders), and a Gestão (management) reporting dashboard. Used daily in the field on phones by farm staff, and by the owner/admin for planning and purchasing decisions.

## Architecture

**No build step, no bundler, no package.json.** Each `*.html` file is a fully self-contained page: inline `<style>`, a single `<script type="module">` with the page's entire logic, Firebase v10.12.0 loaded from the `gstatic.com` CDN, Firestore `onSnapshot` listeners for real-time data, no client-side router. Navigation between pages is plain `<a href="other.html">`. There is nothing to install and nothing to compile — edit the HTML file directly and reload the browser.

Deployment is GitHub Pages, serving these files as-is from the repo root. There is no staging environment; merging to `main` is the deploy.

### Page inventory (17 pages, one Firestore-backed app each)
`index.html` (dashboard) · `agenda.html` (read-only calendar of upcoming activities, sectorized by fazenda) · `mapa.html` (talhão map) · `adubacoes.html` · `pulverizacoes.html` · `drench.html` · `atividades.html` (legacy, not in active use — see note below) · `equipe.html` · `estoque.html` · `pedidos.html` · `gestao.html` (cross-module reporting) · `analises.html` · `recomendacoes.html` · `planejamento.html` · `admin.html` · `login.html` · `design-preview.html`.

### Firebase
Every page duplicates the same `firebaseConfig` object (project `talhoes-df836`) and the same auth bootstrap: `onAuthStateChanged` → redirect to `login.html` if unauthenticated → `getDoc(doc(db,'usuarios',uid))` to load the user's profile/permissions → render. There is one shared Firebase project — no multi-tenancy. All data (talhões, plans, inventory, orders, etc.) lives in one flat set of top-level Firestore collections: `talhoes`, `planosAdubacao`, `pulverizacoes`, `drenchPrevencao`, `equipeEmpregados`, `equipeMaquinas`, `equipeRegistros`, `estoque_produtos`, `estoque_movimentacoes`, `pedidos`, `usuarios`, `analises`, `amostras`, `recomendacoes`, `planejamentos_safra`, `catalogo_adubos`, `logs`, plus legacy `registrosAtividade`/`talhoesAtividades` (see below).

### Permission model
Each page defines its own local copies of `nivelAcesso(mod)`, `isAdmin()`, and often `fazendaPermitida(fazenda)` / `podeConfirmar()` / `podeMarcar()`. `perfilAtual.modulos` (from the `usuarios` doc) maps module keys (`mapa`, `adubacao`, `pulverizacao`, `equipe`, `estoque`, `pedidos`, `gestao`, ...) to an access level (`'admin' | 'gerente' | 'encarregado' | 'operador' | 'nenhum'`). `perfilAtual.fazendasModulo?.[modulo]` optionally restricts a user to specific fazendas within a module. There is no server-side enforcement (no committed `firestore.rules` in this repo) — access control is entirely client-side gating of what's rendered/clickable. When adding a new admin-only feature, follow the existing pattern: hide the button/tab and also guard the handler function itself (defense in depth), matching how `drench.html`'s Planejamento tab is gated.

### The sidebar menu is duplicated in every page
There is no shared JS/partial. The menu array (`gerarMenu()`) — icon, label, href, required `acesso` module — is copied verbatim into every page (all except `login.html`/`design-preview.html`, which have no menu — currently 15 files carry it). **When reordering or adding a menu item, it must be changed in all of them identically**, or pages will disagree on nav order. Current canonical order: Dashboard → Agenda → Mapa → Adubações → Pulverizações → Drench → Atividades → Equipe → Estoque → Pedidos, then (Análise section) Gestão → Análises → Recomendações → Planejamento → Admin. Menu items with an `acesso` key are hidden when `nivelAcesso(mod)==='nenhum'`; items without one (Dashboard, Agenda) show for every authenticated user, and the page itself does any finer-grained gating (e.g. `agenda.html` filters its content by the per-module `fazendasModulo` restriction rather than hiding the whole page).

### `type="module"` inline-handler gotcha (recurring bug source)
Every page's script is `<script type="module">`, so top-level `let`/`const` state is module-scoped, not global. Inline HTML attributes like `onclick="minhaVar = ...">` run in the **global** scope and silently fail to touch module state (no error — the assignment just creates an unrelated global). This has caused real, hard-to-notice bugs in this codebase (e.g., a filter dropdown that visually looked selected but never actually filtered anything). The fix, used consistently across the app: never mutate module state directly from an inline attribute — always call a `window.xxx = function(...)` bridge that's explicitly assigned in the module script, e.g. `window.setDrFaz = function(v) { drenchFiltroFazenda = v; renderTab(); }`, and reference `onchange="setDrFaz(this.value)"` in the HTML. Grep `window.set[A-Z]` in any page for the existing convention before adding a new stateful filter/control.

### Retrocompat and derived/legacy data
Several collections carry data shapes that evolved over time; new code reads old and new shapes rather than migrating documents (e.g., `alvoPrevencao` may be a single string or an array; `pulverizacoes` docs use `dataRealizada` with fallback to `data`; adubação `aplicacoes` may lack per-product `feito` state on old Fertinox multi-product records — see `materializarProdutos()` in `adubacoes.html`). Follow this pattern — add fallback reads for older shapes rather than backfilling Firestore documents.

`atividades.html` (talhão × carreira checklist) and its `registrosAtividade`/`talhoesAtividades` collections are a legacy tool that was never adopted in real usage — don't build new dashboard/reporting features on top of it; it was deliberately excluded from the `index.html` redesign for this reason.

### Gestão (`gestao.html`) vs. per-module pages
`gestao.html` is a read-only, cross-module reporting surface (KPIs, PDF/Excel export via `xlsx.full.min.js`, filters). It has historically had zero Firestore writes; if you add a write there (e.g. a persisted filter/config), that's a new pattern for that file — consider whether the write belongs in the operational page instead (e.g. planning/scheduling config belongs in `drench.html`'s admin-only Planejamento tab, not in the Gestão report, per prior product decision).

### Consistent per-page details worth reusing rather than reinventing
- `formatarData(d)` (`YYYY-MM-DD` → `DD/MM/YYYY`), `sanitizar(str)` (basic HTML-escape), `corFazenda(nome)` — repeated near-verbatim in most pages.
- Leaflet 1.9.4 (unpkg CDN) for any map (`mapa.html`, `drench.html`, `pedidos.html`, ...), tile source `server.arcgisonline.com/.../World_Imagery`. Map instances bound to a container that gets wiped by `innerHTML` (as in report-style pages) must be destroyed and recreated on every render — see `renderDrenchCobMapa` pattern.
- Chart.js 4.4.0 (jsdelivr CDN) for dashboard/report charts.
- CSS custom properties (`--v`, `--ve`, `--vb`, `--c`, `--cb`, `--cl`, `--rad`, `--rs`, ...) are redefined per-file in `:root` with the same names/values — check what a given page already defines before introducing a new one.
- Pages generally cap content width on wide viewports: `@media(min-width:600px){ .container { max-width:580px; margin:0 auto; } }` — apply this to any new page so it doesn't stretch full-bleed on tablet/desktop.

## Development workflow

No linter, no formatter, no test suite, no build/CI pipeline. Validate JS changes by extracting the module script and running `node --check` on it (fast syntax check with no network/DOM), e.g.:
```bash
node -e "
const fs = require('fs');
const html = fs.readFileSync('drench.html','utf8');
const m = html.match(/<script type=\"module\">([\s\S]*?)<\/script>/);
fs.writeFileSync('/tmp/check.mjs', m[1]);
"
node --check /tmp/check.mjs
```
There's no way to run the app against real data without a live Firebase Auth login — there are no test/demo credentials available in this environment, so UI changes generally can't be visually verified end-to-end here. Note this limitation explicitly when reporting work rather than claiming visual verification that didn't happen.

Git remote is a local proxy; before pushing, `git fetch origin main && git rebase origin/main` (concurrent work lands on `main` frequently via other merged PRs) then `push --force-with-lease`.
