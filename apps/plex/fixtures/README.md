# Plex test data

This is what the Plex app's tests use (`contract.json`).

The `*.json` replies were recorded in CI from Plex Media Server's official Docker image, by `test/record/plex`. `recording.json` says which image and when.

The server was a throwaway one with no account. Plex answers networks it's told to trust without a sign-in, so it answered the recorder the same way it answers the app with a signed-in page's token. Its random id is swapped for a plain number.

`pages/` aren't copies of Plex's web app. They're small stand-ins at its address: one with what Plex's page saves after you sign in (the account's token in `myPlexAccessToken`), and one with nothing saved. The recorder checks that the web app in the same image still saves its sign-in under that name, and `recording.json` notes it.

Search and opening an episode aren't tested yet. They need Plex's web player signed in to a real account, both to write the tests and to record them.

To record new replies, push a branch called `record/plex`. The Record fixtures workflow pushes fresh ones back to it.
