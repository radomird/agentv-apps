# HBO Max test data

This is what the HBO Max app's tests use (`contract.json`).

HBO Max has no server you can run, so there's nothing to record. The pages in `pages/` are small stand-ins I made by hand, at HBO Max's own addresses. Between them, they have only what the app reads:

- the profile button, the profile picker's heading, and the start page's Sign In link;
- the sign-in form's email field, inside shadow roots;
- the search box and the tiles it finds, with a sports event and a clip it should leave out;
- a show's page at two seasons, with its episodes, play button and trailer button, and a film's page;
- the player's title, season and episode, play and pause, timeline and Next Episode.

They aren't copies of HBO Max's pages, and the titles in them are made up. The app itself is written against HBO Max's real pages, saved from my own signed-in session on my NUC. Those stay private.

A few of the stand-ins do a little in a script, the way HBO Max's pages do:

- The sign-in form draws its fields inside two shadow roots.
- The player plays and pauses its video, and Next Episode goes to the next one. The video has no picture, so the stand-in gives its clock a value.
- At `?fixture=paused` the video starts paused, and at `?fixture=loading` the player hasn't drawn its controls yet.

The d-pad checks press your phone's arrows, OK and Back in those pages, as they'd reach them on your TV, and look at where the focus lands.
