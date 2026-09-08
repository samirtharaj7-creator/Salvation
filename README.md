# Salvation

Next.js website with Gemini answers grounded in the existing Qdrant library. Includes the My Bible Explorer ribbons and alphabetical library menu.

## Local development

Use Node.js 22.x. Run `npm ci`, copy `.env.example` to `.env.local`, fill in your credentials, and run `npm run dev`.

## Production

Run `npm run typecheck`, `npm run build`, then `npm start`. This app requires a Next.js server and cannot be deployed as a static GitHub Pages site.

See [DEPLOYMENT.md](DEPLOYMENT.md) for Vercel configuration and salvation.mybibleexplorer.com DNS setup. No credentials belong in GitHub.
