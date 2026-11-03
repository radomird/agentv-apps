# agentv-apps

The official apps for [AgenTV](https://github.com/radomird/agentv-os), the world's first open-source agentic TV OS. Powered by [Omarchy](https://omarchy.org).

There are four so far, each in its own folder under `apps/`. This repo also publishes the signed list your box installs them from.

## The apps

- **Jellyfin** puts your Jellyfin library on the TV. Search it, open a film or a show, and pick up where you left off.
- **Immich** puts your Immich photos on the TV. Search your albums and open one.
- **Steam** opens Steam Big Picture full screen. Go back to home and your game keeps running, with a Quit button on its tile. Add Steam from _Apps_ on the TV and the box installs Steam itself too, then you sign in right there.
- **Plex** opens your Plex server's own web app on the TV, where you sign in with your Plex account. Search and picking up where you left off are coming soon.

## What's in an app

An app is just a folder with a `manifest.json`, its code and some test data. The manifest says what the app is, what it can do, and what it's allowed to talk to.

That last part matters. Jellyfin, Immich and Plex can only reach the server you point them at in setup (and Plex its own sign-in page). They drive your server's own web app in the TV's browser, so you sign in on AgenTV's sign-in screen and the box never keeps your password. Each app runs on its own, apart from the others.

Steam is the odd one out. It's a normal program, so the box just starts it, and the app itself doesn't talk to anything.

## How your box gets an app

Whenever an app changes, CI rebuilds `index.json`, the list of apps. For each one it records this repo, the app's folder and the exact commit to use. Then it signs the list with AgenTV's key (the same one the packages are signed with) and publishes it as the `index` release here.

Your box downloads that list, checks the signature against the key it already has, and fetches the app's folder at exactly that commit. It checks the app against AgenTV's app rules before running any of it, and leaves the test data behind. Changing one app never touches the others, and every change gets a new version.

## Running the tests

```
test/run
```

That runs everything a pull request runs, on your own machine:

- the fast gate every AgenTV repo has (`bin/agentv-check`), which catches em dashes, secrets, anything that automates a streaming service, and messy shell scripts
- type checks against the app rules in [agentv-os](https://github.com/radomird/agentv-os), at the commit pinned in `.github/agentv-os`
- each app against replies recorded from its real server, in a real Chromium with no network (`test/contract`)
- a real install, where an index built from your change and signed with a throwaway key is installed app by app with AgenTV's own installer (`test/index-test.sh`)

Steam doesn't talk to a server, so there's nothing to record for it. Its tests just check that it follows the app rules and doesn't try to do anything else.

## Recording new test data

The recorded replies come from each service's official Docker image, set up fresh in CI. To refresh them, push a branch named after the app:

```
git push origin HEAD:record/jellyfin
```

The Record fixtures workflow records new replies and pushes them back to that branch. The same goes for `record/immich` and `record/plex`. Each app's `fixtures` folder has a short README that explains what's in it.

## What isn't here

Nothing that automates Disney+, Prime Video, Netflix or Spotify. And the apps AgenTV's own agent builds on your box stay on your box.

## License

MIT, like Omarchy. AgenTV isn't made or endorsed by the Omarchy project.
