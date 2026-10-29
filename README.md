# Little Lantern Stories — The Mystery of the Mooing Loch

A self-contained, mobile-friendly interactive bedtime mystery for ages 6–8. This export contains the working app, including the continuity fixes from the private test version.

## Deploy using GitHub and Cloudflare Pages

### 1. Put the files in GitHub

1. Extract this ZIP on your computer.
2. Create a new repository on GitHub, for example `little-lantern-stories`. It can be private; the Cloudflare review site can still be public.
3. In the repository, choose **uploading an existing file** (or **Add file → Upload files**).
4. Drag the extracted folder's **contents** into the upload area: `public`, `scripts`, `README.md` and `REVIEW.md`. Keep the `public` folder intact. Do not upload the ZIP itself or put everything inside an extra enclosing folder.
5. Commit the files to `main`.

You should see `public/index.html` when opening the repository.

If using GitHub Desktop instead: create a new repository, copy these contents into its local folder, commit, then **Publish repository**. For later updates, commit and **Push origin**.

### 2. Connect Cloudflare Pages

1. In Cloudflare, open **Workers & Pages → Create application → Pages**.
2. Choose **Import an existing Git repository**, connect GitHub if prompted and select your repository. Make sure you are creating a **Pages** project, rather than a Worker.
3. Use these settings:

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Framework preset | None |
| Build command | `exit 0` |
| Build output directory | `public` |
| Root directory | Leave blank |
| Environment variables | None needed |

4. Save and deploy.
5. Open the returned `https://…pages.dev` address and share it with reviewers. No custom domain is needed. No ChatGPT account is required by this app. Unless you configure separate access protection in Cloudflare, anyone with the URL can visit.

Official setup reference: https://developers.cloudflare.com/pages/framework-guides/deploy-anything/

### 3. Make changes later

Edit `public/index.html`, commit to `main` and push to GitHub. Cloudflare Pages will deploy the updated files automatically. Editing a local copy without committing and pushing will not update the live site.

## Test before sharing

Open `public/index.html` directly for a quick local check, or run `python3 -m http.server 8000 --directory public` from this folder and open http://localhost:8000. Browser storage behaviour can differ when using a file URL; a local server is more representative.

Optional route validation with Node.js (no packages to install):

```
node scripts/check-story.cjs
```

The checker validates all 24 complete routes, reachability of all 12 scenes and all 3 endings, plus back, restart and saved progress. These are automated structure/behaviour checks; read-aloud pacing and enjoyment need family testing.

## Files and editing

- `public/index.html`: the entire app: styles, story content and engine.
- `public/_headers`: review-site indexing and basic response headers.
- `public/robots.txt`: asks compliant crawlers not to index the review site. This is not access control.
- `scripts/check-story.cjs`: optional route and navigation checks.
- `REVIEW.md`: suggested test routes and feedback prompts.

Story scenes are stored in the `story` object inside `index.html`. Preserve scene IDs and valid choice targets when editing.

## Prototype scope and data

This pilot uses a fixed story. It does not include AI generation, accounts, payments, analytics or a feedback submission service. Ask reviewers to send feedback directly to you.

Reading progress is saved in the visitor's browser using localStorage. It is not synced across devices or sent to an application server by this code. The hosting provider may keep its normal request logs. **Start again** resets reading progress. The app remains usable when browser storage is unavailable, but it cannot remember the place. Progress from the ChatGPT-hosted site will not carry over to a different domain.

No API keys, ChatGPT hosting configuration or credentials are required or included.
