# Avci Collections

Next.js gallery with shared image-link posts and phone/computer photo uploads, powered by **Upstash Redis**. Visitors can search, open an image to see its description, and choose a personal accent color.

## 1. Update your existing `ein` GitHub repo

Your repo is already connected to Vercel. Upload the **contents** of this ZIP's `avci-collections` folder to the root of the repo, so `package.json`, `app`, and `vercel.json` are visible at the top level.

On Termux, you can use the previously supplied `replace_ein.py` script:

```bash
cd ~/storage/downloads
python replace_ein.py
```

When prompted, enter `~/storage/downloads/Avci-Collections-Fixed.zip` (or the actual name of the downloaded ZIP), your GitHub classic token, and the repo owner. Review the list. **The script deletes existing files on the default branch that are not in the ZIP**, so confirm only if you want that. Other branches remain untouched and old commits stay in history. Never share your token.

Alternatively, commit the files normally with Git, keeping your repo's `.git` folder. A push triggers a new Vercel deployment.

## 2. Connect your existing Upstash Redis database

1. In Vercel, open your **Upstash Redis storage resource** and its connection/settings screen. Connect it to the `ein` Vercel project, including **Production**. Make sure this is a Redis database, not QStash or Vector.
2. Open your Vercel project → **Settings → Environment Variables**. Check that **one complete pair** exists for Production:
   - `KV_REST_API_URL` and `KV_REST_API_TOKEN`, or
   - `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
3. If the integration didn't add a pair, copy the REST URL and **read/write** REST token from the Upstash Redis database's Connect → REST screen and add them as a matching pair in Vercel. The read-only token cannot save images.
4. Never use `NEXT_PUBLIC_` for these variables, commit their values to GitHub, or share the token.
5. No SQL or Supabase setup is needed. Existing posts from the previous Upstash version remain in the same database. Images formerly saved in Supabase will **not** migrate automatically.

## 3. Fix the earlier Vercel build setting and deploy

1. Open your Vercel project → **Settings → Build and Deployment**.
2. Set **Framework Preset** to **Next.js**. Turn off any overrides for **Output Directory** and **Build Command**; do not set the output to `public`.
3. Make sure Root Directory is the directory containing `package.json` (the repo root if you used the uploader). Save.
4. After the GitHub update and Upstash connection, open **Deployments**, choose the latest deployment, then **Redeploy**. Environment-variable changes only apply to new deployments.
5. Once the deployment is Ready, open the production URL. Your existing Upstash posts should remain; a fresh database starts empty.

## Using the site

Click **Add image**. Choose **Image link** for a direct HTTPS URL ending in `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, or `.avif`, or **From device** to select a photo from your gallery. Enter a name and optionally a description. Click a card to read its description.

For links, the site stores only the URL, so a removed or inaccessible original will display a fallback. For device uploads, choose JPEG, PNG, WebP, or GIF. The browser converts and shrinks it to a JPEG of at most 3 MB before uploading; GIFs become still images and transparent backgrounds become white. The image is saved in your existing Upstash database. Very large images can still fail on a phone if it cannot process them.

Colors are stored in each visitor's browser. Posts are shared. The gallery loads 50 entries at a time; use **Load more images** for older posts. Search covers images loaded so far.

**Anyone can post, with no app-imposed posting rate cap.** There is no login, delete interface, or moderation. This makes spam and filling up your free storage easy. Limit access or add authentication and moderation before sharing widely. Uploads use Upstash storage and bandwidth, which still have provider quotas. Vercel also limits request size; images are compressed for that reason. There is no gallery delete interface: removing an upload requires database administration.

## Local development (optional)

Use Node.js 20+, copy `.env.example` to `.env.local`, enter one matching pair of Upstash credentials, then run:

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. Never commit `.env.local`.
