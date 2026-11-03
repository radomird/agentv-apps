# agentv-apps

The apps that come with [AgenTV](https://github.com/radomird/agentv-os), the world's first open-source agentic TV OS. Powered by [Omarchy](https://omarchy.org).

If you run AgenTV, this is where the apps in _Apps_ on your TV come from. If you write code, it's also the place to see how an AgenTV app is put together.

## What you get

Right now there are four:

- **Jellyfin.** Your Jellyfin films and shows on the TV. Search, open something, and pick up where you left off.
- **Immich.** Your Immich photos on the TV. Search your albums and open one.
- **Steam.** Steam Big Picture, full screen. Go back to home and your game keeps running, with a Quit button on its tile. If Steam isn't on the box yet, adding the app installs it, and you sign in right on the TV.
- **Plex.** Your Plex server's own web app on the TV, signed in with your Plex account. Search and picking up where you left off are coming soon.

To add one, open _Apps_ on the TV and pick it. That's it.

## Your passwords stay yours

Jellyfin, Immich and Plex only talk to the server you point them at (and Plex to its own sign-in page). You sign in on your server's own page, inside AgenTV's sign-in screen, and the box never keeps your password.

Steam is just Steam. The box starts it like any other program, and the app itself doesn't talk to anything.

## How your box gets the apps

Every time an app changes here, CI builds a fresh list of apps (`index.json`), signs it with AgenTV's key, and puts it in this repo's `index` release.

Your box downloads that list and checks the signature, so it knows the list really came from AgenTV. Then it downloads the app at the exact commit the list names, checks that it follows AgenTV's app rules, and only then runs it. Updating one app never touches the others.

## For developers

Each app is a folder in `apps/` with a `manifest.json` (what the app is and what it's allowed to reach), its code, and recorded test data.

To run every check on your machine:

```
test/run
```

That's what CI runs on a pull request:

- the basic checks every AgenTV repo has: no em dashes, no secrets, nothing that automates a streaming service, and clean shell scripts
- type checks against the app rules in [agentv-os](https://github.com/radomird/agentv-os)
- each app against replies recorded from its real server, in a real Chromium with no network
- a real install, from a test list signed with a throwaway key

Steam doesn't talk to a server, so there's nothing to record for it. Its tests just make sure it follows the rules and doesn't try anything else.

To record fresh test data, push a branch named `record/jellyfin`, `record/immich` or `record/plex`. CI starts the service's official Docker image, records new replies, and pushes them back to your branch. Each app's `fixtures` folder has a short README about what's in it.

## What you won't find here

Anything that automates Disney+, Prime Video, Netflix or Spotify. And the apps AgenTV's agent builds on your box stay on your box.

## License

MIT, like Omarchy. AgenTV isn't made or endorsed by the Omarchy project.
