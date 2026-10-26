# Jellyfin fixtures

The Jellyfin app's contract tests (`contract.json`), run by agentv-os's contract runner (S3.1).

The `*.json` replies come from Jellyfin's own server, recorded by `test/record/jellyfin` in CI from its official container image. `recording.json` says which image and when. The server was a throwaway one with a film and an episode of a test pattern made with ffmpeg for this, so they're ours to give away, under [CC0](https://creativecommons.org/publicdomain/zero/1.0/). Its tokens are replaced with `fixture-token`, and the ids it made up with plain numbered ones.

The app asks with the token of Jellyfin's page on the TV, so the recorder signs in a second device the way that page does, with a websocket open, and records what the app asks as that page's session.

`pages/` are stand-ins for Jellyfin's web app, not copies of it: a page at its address that keeps what Jellyfin's page keeps once someone has signed in there (its server and token in `jellyfin_credentials`, its device id in `_deviceId2`), one that keeps nothing, and one with a video of a test pattern playing, also made with ffmpeg for this.

To record the replies again, push a branch named `record/jellyfin`: the Record fixtures workflow pushes fresh ones back to it.
