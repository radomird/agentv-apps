# Plex fixtures

The Plex app's contract tests (`contract.json`), run by agentv-os's contract runner (S3.1).

The `*.json` replies come from Plex Media Server itself, recorded by `test/record/plex` in CI from its official container image. `recording.json` says which image and when. The server was a throwaway one with no account: Plex lets a server answer the networks it's told to trust without a sign-in, so it answered the recorder as it answers the app with a signed-in page's token. The id it made up for itself is replaced with a plain numbered one.

`pages/` are stand-ins for Plex's web app, not copies of it: a page at its address that keeps what Plex's page keeps once someone has signed in there (the account's token in `myPlexAccessToken`), and one that keeps nothing. The recorder checks the web app in the same image keeps its sign-in under that name, and `recording.json` says so.

Searching and opening an episode aren't here yet. They need Plex's web player signed in to a real account, to write them against and to record.

To record the replies again, push a branch named `record/plex`: the Record fixtures workflow pushes fresh ones back to it.
