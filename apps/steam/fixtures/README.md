# Steam test data

This is what the Steam app's tests use (`contract.json`).

There's nothing recorded here. Steam is a normal program: the box starts it from the `exec` line in its manifest, in its own gamescope window. The app has no page and doesn't talk to a server.

So the tests check three things:

- the app follows AgenTV's app rules for an official app;
- opening it doesn't do or ask for anything;
- it can't be asked to do anything else.

The rest is checked on an installed box. agentv-iso's image tests use a stand-in for Steam to check that it opens full screen, that a game keeps running behind home with Quit on its tile, and that home comes back when Steam quits. I'll check the same with Steam itself on my NUC.
