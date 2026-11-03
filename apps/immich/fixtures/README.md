# Immich test data

This is what the Immich app's tests use (`contract.json`).

The `*.json` replies and `preview.jpeg` were recorded in CI from Immich's official Docker image, by `test/record/immich`. `recording.json` says which release and when.

The server was a throwaway one with three test-pattern photos made with ffmpeg just for this, so they're free to share under [CC0](https://creativecommons.org/publicdomain/zero/1.0/). Its access token is swapped for `fixture-token`, and its random ids for plain numbers.

`pages/` aren't copies of Immich's web app. They're small stand-ins at its address: one signed in (with the cookie that says so), one not, and an album page. That's all the app needs, since it talks to Immich's API from that page.

To record new replies, push a branch called `record/immich`. The Record fixtures workflow pushes fresh ones back to it.
