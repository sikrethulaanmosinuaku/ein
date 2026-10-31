# Avci Collections

A mobile-friendly meme gallery built with Next.js App Router, Tailwind CSS, and Supabase. Visitors can add images by link, with an optional description shown only when an image is opened. Images are shared between visitors and persist after refresh.

The gallery starts empty, with search, an Everything view, a lightbox, broken-image fallback, and five color settings. Color settings are saved in each visitor's own browser, not for everyone.

## 1. Get the project

Download and unzip the project. Open a terminal inside the `avci-collections` folder.

Install Node.js 20 or newer from <https://nodejs.org/>. Then check it:

```bash
node --version
npm --version
```

Install and run locally:

```bash
npm install
npm run dev
```

First complete the Supabase setup below, then open <http://localhost:3000>. Stop the local server with `Ctrl+C`.

## 2. Set up the free database

The website needs a database for images to be visible to everyone. Supabase has a free plan; check its current limits and terms.

1. Sign up at <https://supabase.com/> and create a new project. Save its database password safely.
2. In your Supabase dashboard, open **SQL Editor** and select **New query**.
3. Open `supabase/schema.sql` from this project, copy all its contents into the editor, and click **Run**.
4. Go to **Project Settings → API** and copy the **Project URL** and **service_role key** (the legacy `service_role` secret). Keep that key private.
5. In your project folder, copy `.env.example` to a new file named `.env.local`. Fill in `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` with the values you copied. Do not put quotation marks around them.
6. Restart `npm run dev`. The gallery should load empty, ready for your first image.

Do not put the service role key in GitHub or share it. `.env.local` is ignored by Git. Never prefix the key with `NEXT_PUBLIC_`.

## 3. Create a GitHub repository

1. Sign in at <https://github.com/>.
2. Click **New repository**.
3. Name it `avci-collections`. Choose Public or Private.
4. Leave **Add a README**, **.gitignore**, and license unchecked. The project already includes these.
5. Click **Create repository**.
6. In a terminal opened in the extracted `avci-collections` folder, run:

```bash
git init
git add .
git commit -m "Launch Avci Collections"
git branch -M main
git remote add origin https://github.com/YOUR-GITHUB-USERNAME/avci-collections.git
git push -u origin main
```

Replace `YOUR-GITHUB-USERNAME` with your GitHub username. If Git asks you to sign in, finish the browser sign-in prompt.

If you already created the repository for the previous version, replace the project files in your existing local repo with the files in this ZIP, keeping its `.git` directory. Then run `git add -A`, `git commit -m "Add image posting and colors"`, and `git push`. Follow the database and Vercel environment-variable steps in this guide, then redeploy after adding the variables.

## 4. Connect GitHub to Vercel Free

1. Go to <https://vercel.com/> and sign in.
2. Choose **Continue with GitHub**. Approve the Vercel GitHub app access.
3. In Vercel, click **Add New → Project**.
4. Find `avci-collections` in the repository list and click **Import**. If it is missing, use **Adjust GitHub App Permissions** and grant Vercel access to that repo.
5. Leave the detected settings as they are: Framework **Next.js**, Build Command `next build`, and Output Directory default.
6. Under **Environment Variables**, add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` using the two Supabase values above. Do not put these values in your repo.
7. Click **Deploy**.
8. When the build succeeds, click the `*.vercel.app` URL to open the live gallery.

That’s it. Vercel now watches the connected GitHub repo. Each time you push a commit to `main`, Vercel builds and deploys the updated site automatically. Pull requests also get preview links.

### Make a change and redeploy

After editing files, run:

```bash
git add .
git commit -m "Update meme gallery"
git push
```

Open the project’s **Deployments** tab in Vercel to see the automatic build.

## 5. Add an image and choose a color

Click **Add image**, paste a publicly accessible direct HTTPS image URL ending in `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, or `.avif`, enter a name, optionally add a description, and click **Add to collection**. A link to an image page or to a private image is not the direct image link. Query strings on image URLs are fine.

The image appears for everyone. Clicking the image shows its description. Broken links show a placeholder; the website stores the URL, not the image bytes, so removing the image from its original host will break it here too.

Click **Colors** to pick an accent color. This setting is saved only in the current browser and doesn't affect what other visitors see.

Use images you have permission to share. The site displays up to the 500 most recent images.

## Vercel Free plan notes

- The Vercel Hobby plan and Supabase free plan can be used for a small personal project, subject to their current usage limits and terms.
- The free tier is intended for personal/non-commercial use. Check Vercel’s current plan terms before using it for commercial work.
- **Anyone who can reach the site can add an image.** There is no login or moderation. Add authentication or moderation before exposing it to untrusted visitors.
- Posting is limited to five submissions per IP per hour as basic abuse protection. This is not a substitute for authentication or moderation.
- Color settings are local to each browser. They are not shared between visitors.

## Project files

```text
avci-collections/
├── app/
│   ├── api/images/route.ts
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── archive-gallery.tsx
│   └── archive.css
├── supabase/schema.sql
├── .env.example             # copy to .env.local; never commit your real key
├── .gitignore
├── package.json
├── tailwind.config.ts
└── README.md
```
