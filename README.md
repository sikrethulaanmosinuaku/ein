# EIN

1. Upload these files (NOT the zip itself) to a GitHub repo: index.html, package.json, api/game.js
2. Vercel -> Add New Project -> pick the repo -> Deploy
3. Project -> Storage -> add Upstash Redis (Marketplace) and connect it to the project
4. Project -> Settings -> Environment Variables -> add ADMIN_SECRET (your own secret code)
   Optional: ANTHROPIC_API_KEY (Claude judges descriptions)
5. Deployments -> Redeploy
