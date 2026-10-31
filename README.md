# Avci Collections

Next.js gallery with shared image-link posts powered by **Upstash Redis**. There are no sample images. Visitors can search, open an image to see its description, add a direct image link, and choose a personal accent color.

## 1. Update your existing `ein` GitHub repo

Your repo is already connected to Vercel. Upload the **contents** of this ZIP's `avci-collections` folder to the root of the repo, so `package.json`, `app`, and `vercel.json` are visible at the top level.

On Termux, you can use the previously supplied `replace_ein.py` script:

```bash
cd ~/storage/downloads
python replace_ein.py
```

When prompted, enter `~/storage/downloads/Avci-Collections-Upstash.zip` (or the actual name of the downloaded ZIP), your **new account's** GitHub classic token, and the repo owner. Review the list. **The script deletes existing files on the default branch that are not in the ZIP**, so confirm only if you want that. Other branches remain untouched and old commits stay in history. Never share your token.

Alternatively, commit the files normally with Git, keeping your repo's `.git` folder. A push triggers a new Vercel deployment.

## 2. Connect your existing Upstash Redis database

1. In Vercel, open your **Upstash Redis storage resource** and its connection/settings screen. Connect it to the `ein` Vercel project, including **Production**. Make sure this is a Redis database, not QStash or Vector.
2. Open your Vercel project → **Settings → Environment Variables**. Check that **one complete pair** exists for Production:
   - `KV_REST_API_URL` and `KV_REST_API_TOKEN`, or
   - `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
3. If the integration didn't add a pair, copy the REST URL and **read/write** REST token from the Upstash Redis database's Connect → REST screen and add them as a matching pair in Vercel. The read-only token cannot save images.
4. Never use `NEXT_PUBLIC_` for these variables, commit their values to GitHub, or share the token.
5. No SQL or Supabase setup is needed. Images formerly saved in Supabase will **not** migrate automatically.

## 3. Fix the earlier Vercel build setting and deploy

1. Open your Vercel project → **Settings → Build and Deployment**.
2. Set **Framework Preset** to **Next.js**. Turn off any overrides for **Output Directory** and **Build Command**; do not set the output to `public`.
3. Make sure Root Directory is the directory containing `package.json` (the repo root if you used the uploader). Save.
4. After the GitHub update and Upstash connection, open **Deployments**, choose the latest deployment, then **Redeploy**. Environment-variable changes only apply to new deployments.
5. Once the deployment is Ready, open the production URL. The gallery starts empty.

## Using the site

Click **Add image**, enter a name and direct HTTPS image URL ending in `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, or `.avif`, and optionally add a description. Click a card to read its description. The site stores the URL, not the image file itself, so a removed or inaccessible original will display a fallback.

Colors are stored in each visitor's browser. Posts are shared. The gallery displays the newest 500 entries; older entries are retained in Redis but not displayed.

**Anyone can post.** There is no login, delete interface, or moderation. The basic five-posts-per-IP-per-hour limit is not a replacement for moderation, and free usage is subject to Upstash and Vercel plan limits.

## Local development (optional)

Use Node.js 20+, copy `.env.example` to `.env.local`, enter one matching pair of Upstash credentials, then run:

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. Never commit `.env.local`.
