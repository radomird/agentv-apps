# Jellyfin test data

This is what the Jellyfin app's tests use (`contract.json`).

The `*.json` replies were recorded in CI from Jellyfin's official Docker image, by `test/record/jellyfin`. `recording.json` says which image and when.

The server was a throwaway one with a film and an episode of a test pattern, made with ffmpeg just for this, so they're free to share under [CC0](https://creativecommons.org/publicdomain/zero/1.0/). Its tokens are swapped for `fixture-token`, and its random ids for plain numbers.

On the TV, the app uses the token from Jellyfin's own page. So the recorder signs in a second device the same way that page does, with a websocket open, and records the app's requests as that page's session.

`pages/` aren't copies of Jellyfin's web app. They're small stand-ins at its address. One has what Jellyfin's page saves after you sign in (the server and token in `jellyfin_credentials`, the device id in `_deviceId2`), one has nothing saved, and one plays a test-pattern video, also made with ffmpeg.

To record new replies, push a branch called `record/jellyfin`. The Record fixtures workflow pushes fresh ones back to it.
