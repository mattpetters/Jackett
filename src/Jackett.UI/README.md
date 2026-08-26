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

## Component sources

- The results table is adapted from [ShadTable](https://www.shad-table.dev/), built on TanStack Table.
- Animated search icon source is installed from [Iconimate](https://iconimate.app/).
- UI primitives are owned shadcn/ui source files under `src/components/ui`.
