# Deploy & embed guide (M9)

How to put **Palette Studio** online and surface it from your Squarespace site. The app is a
self-contained static page (no backend, no build), so hosting is just "serve the `src/` folder."

Repo: `https://github.com/ryanmette/miniature_palette_studio`
Live URL (canonical): **`https://palette.ryanmette.com`** — the custom domain of §3b, committed as
`src/CNAME`. (`https://ryanmette.github.io/miniature_palette_studio/` remains as the underlying
GitHub Pages address / fallback.)

> **Squarespace note:** embedding arbitrary HTML/iframes needs a **Business plan or higher**
> (Code Block / Code Injection). Since you're not on Business, the supported path is to **host the
> app on GitHub Pages and link to it** from Squarespace — works on any plan. A subdomain (§3b) makes
> it feel native. The iframe route (§3c) is documented for if you ever upgrade.

---

## 1. Push the code to GitHub

The local repo already has `origin` set to your repo. From the project folder:

```bash
git push -u origin main
git push origin --tags        # optional: publish the version tags
```

(If GitHub asks for credentials, use a Personal Access Token as the password, or `gh auth login`.)

## 2. Turn on GitHub Pages (one time)

1. Repo → **Settings → Pages**.
2. **Build and deployment → Source: GitHub Actions**.
3. That's it. The included workflow (`.github/workflows/deploy.yml`) publishes `src/` on every push
   to `main`. Watch it under the repo's **Actions** tab; when it's green the site is live at
   **`https://ryanmette.github.io/miniature_palette_studio/`**.

To update the app later: commit and `git push` — it redeploys automatically.

## 3. Surface it on Squarespace

### 3a. Link or button (recommended — any plan)
- Edit the page → add a **Button** (or text **Link**).
- Set the link to `https://palette.ryanmette.com`.
- Set it to **open in a new tab**. Done — visitors launch the tool from your site.

### 3b. Custom subdomain so it feels native (✅ done — this is the live setup)
The app is served at **`palette.ryanmette.com`**:
1. DNS **CNAME**: `palette` → `ryanmette.github.io` (done).
2. Repo → **Settings → Pages → Custom domain** = `palette.ryanmette.com` (done — the committed
   `src/CNAME` keeps it across deploys; "Enforce HTTPS" on).
3. Squarespace links/buttons point at `https://palette.ryanmette.com`.

### 3c. Inline iframe (only if you upgrade to Business)
With a Business plan you can add a **Code Block** containing a responsive iframe:
```html
<div style="position:relative;width:100%;min-height:820px">
  <iframe src="https://palette.ryanmette.com/"
          style="position:absolute;inset:0;width:100%;height:100%;border:0"
          title="Palette Studio for Miniatures" loading="lazy"></iframe>
</div>
```

---

## Notes
- **Share links work** on the hosted URL: the app encodes state in the query string
  (`?c=<hex>&h=<harmony>&v=<tab>&r=accent&t=dark`), so links/buttons can deep-link to a scheme.
- **Responsiveness is built in** — the app is mobile-first (CLAUDE.md §3.6); a link/subdomain page
  needs no extra sizing.
- **Local preview** (before pushing): `cd src && python3 -m http.server`, then open the printed
  `localhost` URL — needed because the browser fetches `data/paints.json` over http.
- **Alternative hosts:** Netlify or Cloudflare Pages work identically — point the project at the repo
  and set the publish directory to `src`.
