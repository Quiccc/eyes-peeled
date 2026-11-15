# Word Hunt admin panel

A small React web app for running the game. It talks only to the server's `/admin/*` API and signs in
with the server's `ADMIN_TOKEN`.

| Page | What it does |
|---|---|
| **Schedule** | A month at a time: fill empty days, change any future day's word. Today and past days are locked. |
| **Words** | Add words, retire them (enabled off), set a per-word pass threshold, see which words the model knows. |
| **Moderation** | Reports with the photo: resolve, remove the photo, ban or unban the user. |
| **Model** | YOLO service status, model version, the latest word test (yolo/eval), words the model doesn't know. |
| **Stats** | Per day and word: attempts, finds, pass rate, finders. Low pass rates point to unfair words. |

## Run it

Set `ADMIN_TOKEN` in `server/.env` (any long random string) and start the server first.

```bash
cd admin
npm install
npm run dev          # http://localhost:5174/admin-panel/ , proxies /admin/* to http://localhost:4000
```

Use `API_URL=http://localhost:4123 npm run dev` if the server runs elsewhere.

## Ship it

```bash
npm run build        # typecheck + build to admin/dist
```

The server serves `admin/dist` at `/admin-panel/` (same origin as the API, no CORS). Change the folder
with `ADMIN_PANEL_DIR` in `server/.env`. The token is kept in the browser tab's `sessionStorage` and
is gone when the tab closes. Only use the panel over HTTPS in production.
