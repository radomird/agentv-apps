# Disney+ test data

This is what the Disney+ app's tests use (`contract.json`).

Disney+ has no server you can run, so there's nothing to record. The pages in `pages/` are small stand-ins I made by hand, at Disney+'s own addresses. Between them, they have only what the app reads:

- the profile menu's button, and the start page's Log In link;
- the search box and the titles it finds;
- a series' episodes, and a film's play button;
- the player's title, timeline, play and pause, and PLAY NEXT, each in a shadow root of its own.

They aren't copies of Disney+'s pages, and the titles in them are made up. The app itself is written against Disney+'s real pages, saved from my own signed-in session on my NUC. Those stay private.

A few of the stand-ins do a little in a script, the way Disney+'s pages do:

- The player plays and pauses its video, and PLAY NEXT goes to the next episode. The video has no picture, so its clock stays at 0 s.
- One player shows its controls only after a mouse move.
- The sign-in form sends you on to a series' page if a page before it said you were signed in.

That last one is why the checks keep their order: a signed-out page comes before the sign-in form.

The d-pad checks press your phone's arrows, OK and Back in those pages, as they'd reach them on your TV, and look at where the focus lands.
