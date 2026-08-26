# Jackett UI

The modern dashboard is a React 19, Vite, Tailwind CSS v4, shadcn/ui, and TanStack application. It is intentionally additive: Jackett's original dashboard remains available at `/UI/Legacy` while the modern search workspace is served at `/UI/Dashboard`.

## Development

```bash
npm install
npm run dev
```

Vite proxies `/api` and `/UI` to a Jackett instance on `127.0.0.1:9117`.

## Build

```bash
npm run lint
npm test
npm run build
```

The production bundle is written to `../Jackett.Common/Content/UI` and included by the .NET project.

## Keyboard workflow

- `Cmd/Ctrl-K` opens the global command menu for searches, recent queries, navigation, and app actions.
- `/` focuses and selects the main release search from anywhere outside an editable field.
- Arrow keys move through command-menu options, `Enter` runs one, and `Escape` closes the menu or blurs the main search.

Searches run as independent in-memory sessions. Starting a new query does not cancel older work; the session rail and command menu can switch between them, cancel one, or remove settled results. All sessions share an eight-request concurrency budget so parallel searches remain responsive without overwhelming Jackett or its indexers.

Failed and timed-out indexers open an issue inspector from the tracker pulse, Issues metric, or command menu. It provides a categorized diagnosis, raw error details, connection testing, single-indexer retry, schema-driven configuration editing, and confirmed removal using Jackett's existing management APIs.

## Component sources

- The results table is adapted from [ShadTable](https://www.shad-table.dev/), built on TanStack Table.
- Animated search icon source is installed from [Iconimate](https://iconimate.app/).
- UI primitives are owned shadcn/ui source files under `src/components/ui`.
