# agentv-apps

AgenTV's official apps, one folder each, and the signed index a box installs them from. Powered by [Omarchy](https://omarchy.org).

- **Jellyfin** (`apps/jellyfin`) puts your Jellyfin library on the TV. Search it, open a film or a series, and pick up where you left off.
- **Immich** (`apps/immich`) puts your Immich photos on the TV. Search your albums and open one.
- **Plex** (coming soon).
- **Steam** (coming soon), as Steam Big Picture.

Each app is a folder with its `manifest.json`, its code and its contract fixtures. It runs on the box in a worker of its own, reaches only the server you give it in setup, and drives your server's own web app in the TV's Chromium. You sign in there, on AgenTV's sign-in screen, and the box keeps no password for it.

## How a box gets them

CI builds `index.json` from the apps' manifests. For each app it names this repo, the app's folder and the last commit that changed it, and it signs the file with AgenTV's key, the same one the packages are signed with. The index is published as the `index` release here.

A box reads it, checks the signature against the key it already has, and fetches the app's folder at exactly that commit. It checks the app against the app contract before anything of it runs, and leaves its fixtures out. A change to one app doesn't touch the others, and an app that changes gets a new version.

## Checks

Every pull request runs:

- the same fast gate as AgenTV's other repos (`bin/agentv-check`): no em dashes, no secrets, no service automation, and clean shell;
- the apps' types, against the app contract in [agentv-os](https://github.com/radomird/agentv-os) at the commit in `.github/agentv-os`;
- every app against its fixtures, with agentv-os's own contract runner: replies recorded from Jellyfin's and Immich's own servers, a page in a real Chromium and no network (`test/contract`);
- an index built from the change and signed with a throwaway key, which agentv-os's own installer then installs each app from (`test/index-test.sh`).

`test/run` runs them all on your machine.

## Fixtures

The replies come from the services' official container images, recorded in CI. Push a branch named `record/jellyfin` or `record/immich`, and the Record fixtures workflow pushes fresh ones back to it. Each app's `fixtures/README.md` says what's in them.

## What isn't here

Nothing that automates Disney+, Prime Video, Netflix or Spotify. Apps an agent builds on a box stay on that box.

## License

MIT, like Omarchy. AgenTV isn't made or endorsed by the Omarchy project.
