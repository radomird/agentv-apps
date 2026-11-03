# agentv-apps

The official apps for [AgenTV](https://github.com/radomird/agentv-os), the world's first open-source agentic TV OS. Powered by [Omarchy](https://omarchy.org).

Each app lives in its own folder here. This repo also publishes the list of apps your box installs from.

## The apps

- **Jellyfin** (`apps/jellyfin`) puts your Jellyfin library on the TV. You can search it, open a film or a show, and pick up where you left off.
- **Immich** (`apps/immich`) puts your Immich photos on the TV. Search your albums and open one.
- **Steam** (`apps/steam`) opens Steam Big Picture full screen. Your game keeps running when you go back to home, and its tile gets a Quit button. When you add Steam from Apps on the TV, the box installs Steam too, and you sign in on the TV.
- **Plex** (`apps/plex`) opens your Plex server's web app on the TV, and you sign in with your Plex account. Search and picking up where you left off are coming soon.

## How an app works

An app is a folder with a `manifest.json`, its code and its test data. The manifest says what the app is, what it can do and what it's allowed to reach.

On the box, every app runs on its own, apart from the others. Jellyfin, Immich and Plex only talk to the server you point them at in setup (Plex also reaches its own sign-in page). They use your server's own web app in the TV's browser. You sign in there, on AgenTV's sign-in screen, and the box never keeps your password.

Steam is different. It's a normal program, so the box just starts it, and the app itself doesn't talk to anything.

## How your box installs an app

1. When an app changes, CI rebuilds the list of apps, `index.json`. For each app, the list says where its folder is and which commit to use.
2. CI signs the list with AgenTV's key, the same one the packages use, and puts it in this repo's `index` release.
3. Your box downloads the list and checks the signature, so it knows the list really came from AgenTV.
4. It downloads the app's folder at exactly that commit and checks that the app follows AgenTV's app rules. Only then does anything in it run. The test data stays behind.

Changing one app doesn't touch the others, and every change gets a new version number.

## Running the tests

Every pull request runs four checks:

- **The basics,** the same as AgenTV's other repos (`bin/agentv-check`): no em dashes, no secrets, nothing that automates a streaming service, and clean shell scripts.
- **Types,** against the app rules in [agentv-os](https://github.com/radomird/agentv-os) at the commit pinned in `.github/agentv-os`.
- **Each app against real replies.** Jellyfin, Immich and Plex are tested against replies recorded from their real servers, in a real Chromium, with no network (`test/contract`). Steam doesn't talk to a server, so there's nothing to record. Its tests just check that it follows the app rules and doesn't try to do anything else.
- **A real install.** CI builds a test list from your change, signs it with a throwaway key, and has AgenTV's own installer install each app from it (`test/index-test.sh`).

Run `test/run` to do all of it on your machine.

## Recording new test data

The recorded replies come from each service's official Docker image, recorded in CI. To record fresh ones, push a branch called `record/jellyfin`, `record/immich` or `record/plex`. The Record fixtures workflow records them and pushes them back to that branch.

Each app's `fixtures` folder has a short README that explains what's in it.

## What isn't here

Nothing that automates Disney+, Prime Video, Netflix or Spotify. And the apps AgenTV's agent builds on someone's box stay on that box.

## License

MIT, like Omarchy. AgenTV isn't made or endorsed by the Omarchy project.
