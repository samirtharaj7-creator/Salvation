# Deploy Salvation to Vercel

The app runs entirely on Vercel: Next.js serves the interface and `/api/chat/` connects Gemini to the existing Qdrant `salvation_docs` collection. No Supabase or Render is required.

1. Create a GitHub repository for this project and push its source. Do not upload .env.local, node_modules, .next or out. The checked-in .gitignore excludes them.
2. In Vercel choose Add New > Project and import that repository. Use the Next.js preset, Node.js 22.x, `npm ci` for installation and `npm run build` for the build. Keep the default output directory.
3. Add these server-side environment variables in Vercel for Production and Preview:
   - GEMINI_API_KEY
   - QDRANT_URL (your existing HTTPS cluster URL)
   - QDRANT_API_KEY (prefer a key restricted to reading salvation_docs)
   - QDRANT_COLLECTION=salvation_docs
   - GEMINI_MODEL=gemini-3.6-flash (the current local model; confirm availability for your key)
4. Deploy and test a question on the generated vercel.app address. Keys are required at runtime, not during the build. Confirm model availability and Qdrant embedding dimensions against the existing index. The embedding model remains gemini-embedding-001 to preserve compatibility.
5. In Project Settings > Domains add salvation.mybibleexplorer.com. At your DNS provider add the exact CNAME value Vercel displays for the salvation record. Remove conflicting records for that subdomain only. Do not point it to github.io.
6. Wait for domain validation and HTTPS provisioning, then test a question on the custom domain.

Before opening the public API broadly, configure rate limiting in Vercel Firewall for /api/chat/ and spending alerts/quotas for Gemini. Request validation and timeouts are implemented; the app does not have a distributed rate limiter.

Previously hardcoded credentials must be rotated before launch. Put replacement values in .env.local locally and Vercel environment variables; never commit them.

Future pushes to the connected production branch trigger deployments. Use pull requests for preview deployments.
