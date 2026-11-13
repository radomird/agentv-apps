# agentv-apps

The apps that come with [AgenTV](https://github.com/radomird/agentv-os), the world's first open-source agentic TV OS. Powered by [Omarchy](https://omarchy.org).

If you run AgenTV, this is where the apps in _Apps_ on your TV come from. If you write code, it's also the place to see how an AgenTV app is put together.

## What you get

Right now there are seven:

- **Disney+.** Disney+'s own site on the TV. You sign in from your phone, with its password manager. Then you can search, ask for something by name, and pick up where you left off from its tile. Your phone's arrows get you around Disney+'s pages. It opens on whichever Disney+ profile you're signed in to.
- **HBO Max.** HBO Max's own site on the TV, the same way: sign in from your phone, search, ask for an episode by name and season, and pick up where you left off. HBO Max asks who's watching on its own page, and your phone's arrows pick.
- **Prime Video.** Prime Video's own site on the TV, the same way. On Linux, Prime Video plays in SD. It picks any season from the series' own season list, and Prime Video asks who's watching on its own page.
- **Jellyfin.** Your Jellyfin films and shows on the TV. Search, open something, and pick up where you left off.
- **Plex.** Your Plex server's own web app on the TV, signed in with your Plex account. Search and picking up where you left off are coming soon.
- **Immich.** Your Immich photos on the TV. Search your albums and open one.
- **Steam.** Steam Big Picture, full screen. Go back to home and your game keeps running. To quit it, hold OK on its tile and pick Quit. If Steam isn't on the box yet, adding the app installs it, and you sign in right on the TV.

To add one, open _Apps_ on the TV and pick it. That's it.

Netflix, YouTube and YouTube Kids are coming soon.

## Your passwords stay yours

Jellyfin, Immich and Plex only talk to the server you point them at (and Plex to its own sign-in page). Disney+, HBO Max and Prime Video only open their own sites (and Prime Video sends you to Amazon's own page to sign in). Either way, you sign in on that site's own page, inside AgenTV's sign-in screen, and the box never keeps your password.

Steam is just Steam. The box starts it like any other program, and the app itself doesn't talk to anything.

## How your box gets the apps

Every time an app changes here, CI builds a fresh list of apps (`index.json`), signs it with AgenTV's key, and puts it in this repo's `index` release.

Your box downloads that list and checks the signature, so it knows the list really came from AgenTV. Then it downloads the app at the exact commit the list names, checks that it follows AgenTV's app rules, and only then runs it. Updating one app never touches the others.

## For developers

Each app is a folder in `apps/` with a `manifest.json` (what the app is and what it's allowed to reach), its code, and its test data.

To run every check on your machine:

```
test/run
```

That's what CI runs on a pull request:

- the basic checks every AgenTV repo has: no em dashes, no secrets, no streaming service named outside its own app's folder, and clean shell scripts
- type checks against the app rules in [agentv-os](https://github.com/radomird/agentv-os)
- each app against its test data (replies recorded from its real server, or pages made by hand), in a real Chromium with no network
- a real install, from a test list signed with a throwaway key
- a check that every app you changed has a newer version in its manifest

Steam doesn't talk to a server, so there's nothing to record for it. Its tests just make sure it follows the rules and doesn't try anything else.

Disney+ doesn't have a server you can run either. Like every streaming app here, I write it by hand against pages I saved from my own signed-in sessions, and those pages stay private. So its tests use small pages I made by hand, at Disney+'s addresses, with only what the app reads. The tests press your phone's arrows in them too.

To record fresh test data, push a branch named `record/jellyfin`, `record/immich` or `record/plex`. CI starts the service's official Docker image, records new replies, and pushes them back to your branch. Each app's `fixtures` folder has a short README about what's in it.

## What you won't find here

Anything for Spotify. And the apps you make on your box stay there.

Each streaming app keeps its service's addresses, and the parts of its pages it reads, in its own folder. Nothing else in this repo has them.

## Whose names these are

Disney+, Netflix, Prime Video, HBO Max and YouTube are trademarks of their owners. I only name them to say which services the apps work with. The apps aren't made or endorsed by any of them.

## Something's broken?

A streaming service changes its pages now and then, and an app here can stop finding its way around them. When that happens the tile still opens the service's site. [Tell me](https://github.com/radomird/agentv-apps/issues/new/choose) which app and what you pressed, and I'll fix it. For a security problem, please [tell me privately](https://github.com/radomird/agentv-apps/security/advisories/new) first.

## License

MIT, like Omarchy. AgenTV isn't made or endorsed by the Omarchy project.
