# Prime Video test data

This is what the Prime Video app's tests use (`contract.json`).

Prime Video has no server you can run, so there's nothing to record. The pages in `pages/` are small stand-ins I made by hand, at Prime Video's own addresses. Between them, they have only what the app reads:

- Sign Out in the menu when you're signed in, and Sign In when you're not;
- search's results, as cards;
- a series' page at two seasons, with the season list, its episodes and its play button, and a film's page;
- the player over a title's page: its title, season and episode, play and pause, and Next Episode.

They aren't copies of Prime Video's pages, and the titles in them are made up. The app itself is written against Prime Video's real pages, saved from my own signed-in session on my NUC. Those stay private.

One part isn't from a saved page: search's results. Prime Video's results page wasn't saved, so the stand-in draws its results the way Prime Video's storefront draws its cards. The app reads them the same way, and the first real search on the TV is where that gets checked.

A few of the stand-ins do a little in a script, the way Prime Video's pages do:

- The player shows its controls only after a pointer move over the picture.
- It has two videos, a short one first, as an episode can start with, then the programme. They have no picture, so the stand-in gives each a clock and a length.
- Play and pause work, and Next Episode goes to the next one. At `&fixture=paused` the programme starts paused.

The d-pad checks press your phone's arrows, OK and Back in those pages, as they'd reach them on your TV, and look at where the focus lands.
