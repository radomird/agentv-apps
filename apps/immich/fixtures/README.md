# Immich fixtures

The Immich app's contract tests (`contract.json`), run by agentv-os's contract runner (S3.1).

The `*.json` replies and `preview.jpeg` come from Immich's own server, recorded by `test/record/immich` in CI from its official container images. `recording.json` says which release and when. The server was a throwaway one with three photos of a test pattern made with ffmpeg for this, so they're ours to give away, under [CC0](https://creativecommons.org/publicdomain/zero/1.0/). Its access token is replaced with `fixture-token`, and the ids it made up with plain numbered ones.

`pages/` are stand-ins for Immich's web app, not copies of it: a page at its address with the cookie that says it's signed in, or without it, and an album's address. The app only needs a page there, since it asks Immich's API from it.

To record the replies again, push a branch named `record/immich`: the Record fixtures workflow pushes fresh ones back to it.
