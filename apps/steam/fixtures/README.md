# Steam fixtures

The Steam app's contract tests (`contract.json`), run by agentv-os's contract runner (S3.1).

There's nothing recorded here. Steam is a native app: the box starts it from the manifest's `exec`, in a gamescope of its own, and the app has no page and asks no server anything. So the checks are that its package passes the app contract as an official app, that `launch` does nothing and asks nothing, and that it can't be asked for anything else.

Steam opening full screen, home keeping a game running with Quit on its tile, and home coming back when Steam quits are agentv-iso's S3.5 image check, with a stand-in for Steam, and Radomir's on the NUC with Steam itself.
