# Push & deploy checklist (when Daniel is ready)
1. Create a public GitHub repo named `market-morning-brief` (no README/license init).
2. `git remote add origin <repo-url>` then `git push -u origin main` (branch: check `git branch`).
3. Netlify: import the repo, publish dir `public`, functions `netlify/functions` (netlify.toml already set).
4. Netlify site settings > Environment variables: add `CMC_API_KEY` (Daniel enters it there himself).
5. Verify deployed `/api/health` shows mode "live" once the key is set and Startup tier has landed.
6. Create the DoraHacks BUIDL submission and the #BuildwithCMC X post.
