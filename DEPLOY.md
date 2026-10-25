# Deploying Millwork Shop Floor

This app is **InstantDB-only** — there's no separate database to provision and
**no required environment variables** (the InstantDB app id is public and baked
into `lib/instant.ts`). It reads the same real-time data the CRM Production
Scheduler writes, so once it's hosted, any shop terminal just opens the URL — no
login needed.

That makes this simpler than the CRM deploy (no Neon, no Postgres switch). The
only parts that need **your** accounts are creating the GitHub repo and the
Vercel project.

---

## Step 1 — Put the code on GitHub

The project is already a git repository with a first commit, and the remote is
already set to `https://github.com/Drewsim34/millwork-shopfloor.git`.

1. On **github.com**, click **New repository**, name it exactly
   `millwork-shopfloor`, leave everything unchecked (no README/.gitignore), and
   **Create repository**.
2. Then from the project folder push:

   ```bash
   git push -u origin main
   ```

   (If git asks you to sign in, use the same GitHub login you used for the CRM.)

## Step 2 — Deploy on Vercel

1. Go to **vercel.com** → **Add New… → Project**.
2. **Import** the `millwork-shopfloor` repo.
3. Vercel auto-detects **Next.js** — leave all build settings at their defaults.
4. **Environment variables:** none required. (Only if you ever move to a
   different InstantDB app, add `NEXT_PUBLIC_INSTANT_APP_ID` with the new id.)
5. Click **Deploy**.

That's it. Vercel gives you a URL like `millwork-shopfloor.vercel.app`. Every
push to `main` auto-deploys.

## Step 3 — (optional) custom domain / shop terminals

- Add a domain under the Vercel project's **Domains** tab if you want something
  like `floor.millworkartisans.com`.
- On each shop terminal, just open the URL and bookmark it / set it as the
  browser home page. No sign-in is needed to view the board.

## Updating later

Make changes, commit, and push — Vercel redeploys automatically:

```bash
git add -A
git commit -m "your change"
git push
```

## Keeping in sync with the CRM

The scheduling engine, model, and shop reference data (`lib/scheduler/*`) and the
InstantDB schema (`instant.schema.ts`) are copied from the CRM. If you change
either in the CRM, copy the change here too so both apps stay consistent.
