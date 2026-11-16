# Publish Super Stick Battle

The intended repository is `natecus/Super-Stick-Battle`. After its first successful deployment, play at https://natecus.github.io/Super-Stick-Battle/.

## One-time setup

1. Create an empty public GitHub repository named `Super-Stick-Battle` under `natecus`. Leave the README, license, and gitignore creation options off because the local project already contains files.
2. Push this project's `main` branch to that repository. Include the `.github/workflows/pages.yml` file. Do not upload `node_modules` or `dist`.
3. In the repository, open **Settings → Pages**. Under **Build and deployment**, set **Source** to **GitHub Actions**.
4. Open **Actions → Test and deploy game**. If the initial run failed because Pages was not enabled yet, rerun it; otherwise use **Run workflow** on `main`.
5. Wait for both **build** and **deploy** to succeed. Open the URL shown by the deployment.

Public repositories support Pages on GitHub Free. A public repository makes the checked-in game source visible. The original drawing photographs are ignored and stay on this computer; the game renders its own vector artwork.

## Automatic updates

Commit changes and push `main`. The workflow uses Node.js 24, installs the locked npm dependencies, runs all tests, builds the static game, and publishes only `dist`. A failed test or build prevents deployment. Pull requests run the checks without changing the live game.

GitHub's built-in workflow token handles deployment; no personal token or other secret needs to be added to the repository. The `github-pages` environment shows deployment history. The local server and `Start Game.cmd` are only for playing or developing locally.

## Verify the published game

- Open the published URL and check that the arena and all nine fighter cards load.
- Select Boss Battle. A fresh browser should show Dave ready, then Cheese, Robot, and Ninja gated in order.
- Start a match, try both players' controls, pause, and return to fighter selection.
- Win a boss encounter and refresh to confirm the unlock persists in that browser.

Each device runs its own match with two players sharing a keyboard. Browser progress on `localhost` is separate from progress on `natecus.github.io`.

## Troubleshooting

- **Site returns 404:** confirm the repository name and URL capitalization, enable Pages with GitHub Actions as the source, and check that the deployment job succeeded.
- **Pages setup failed:** enable Pages in repository settings, then rerun the workflow.
- **Build failed:** open the failed step under Actions. Tests and TypeScript errors must be fixed before publication.
- **An old version appears:** confirm the latest commit deployed successfully, then refresh the browser.

References: [GitHub custom Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) and [Vite static deployment](https://vite.dev/guide/static-deploy.html#github-pages).
