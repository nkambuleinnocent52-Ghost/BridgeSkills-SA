# SkillBridge SA

A responsive hackathon frontend connecting young South African digital talent with small businesses. Built from the team's working document using Vite, JavaScript and CSS.

## Run locally

Requires Node.js 20.19+ or 22.12+.

```sh
npm ci --cache /tmp/skillbridge-npm-cache
npm run dev
```

Create a production build with `npm run build`, then serve it with `npm run preview`.

## Demo journey

1. Browse, search, filter and save opportunities.
2. Open a task and send an application.
3. Open **My projects** and view the application.
4. Use **Demo: accept application** to simulate business selection.
5. Submit work, optionally request changes with feedback, then approve it.
6. Find the completed project in **My portfolio**.
7. Edit the talent profile or use **Post a task** to publish a fictional business task.

All tasks, profile edits, applications and progress persist in this browser's localStorage. Reset the demo by clearing this site's browser storage. All initial businesses and opportunities are fictional. No authentication, multi-user access, payment processing, notifications service or backend is connected. Future API integration can replace the local state and persistence in `src/main.js`.

Fonts are hosted locally with their licenses in `public/fonts`. The frontend requires no API keys or external services.
