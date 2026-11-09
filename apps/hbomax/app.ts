// HBO Max on the TV, written by hand. It drives HBO Max's own site in the
// TV's Chromium, where you sign in on AgenTV's sign-in screen.
//
// What it knows about HBO Max comes from HBO Max's pages as they were
// captured from a signed-in session on my NUC, never from guesses. Those
// pages stay private. The tests here run against stand-ins made by hand,
// with only what this app reads (fixtures/README.md):
// - Signed in, HBO Max's pages have the profile button,
//   [data-testid=profile_button], or ask who's watching. Signed out, the
//   start page has a Sign In link. The sign-in form is under /auth/.
// - Search is /search, with [data-testid=searchBar_field]. Each title it
//   finds is a tile linking to /show/<id>, /mini-series/<id>, /movie/<id> or
//   /standalone/<id>. Sports and clips link elsewhere, and aren't titles.
// - A show's page lists one season's episodes, and ?season=<n> picks the
//   season. Each episode is a link to /video/watch/<id>, labelled "Watch
//   Season 1, Episode 2: ...". A film's page, and a show's, has a play
//   button, and a trailer button with the same test id.
// - The player keeps its controls in the page while they're hidden: the
//   title, "S1 E2:", play and pause, and the timeline, whose aria-valuemax
//   is the video's length. Near the end it adds Next Episode. The video's
//   own clock is the position.
//
// Every call that reads the page waits a bounded time and fails with a plain
// reason, never a retry loop. It has no profiles: HBO Max opens on whichever
// profile you pick on its own page.

import type { AppContext, AppPage, Item, PlaybackState, TvApp } from "../../.agentv-os/apps/contract/contract.ts";

const ORIGIN = "https://www.hbomax.com";
const HOME = `${ORIGIN}/`;
const SIGN_IN = `${ORIGIN}/auth/login`;
const TITLE = /^(show|mini-series|movie|standalone)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PLAYING = /^\/video\/watch\/[0-9a-f-]{36}$/;

function page(ctx: AppContext): AppPage {
  if (!ctx.page) throw new Error("HBO Max's page isn't open");
  return ctx.page;
}

function here(p: AppPage): URL {
  return new URL(p.url() || HOME);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// --- In the page ---------------------------------------------------------------
// Each of these runs in HBO Max's page, so it uses nothing from outside itself.

interface Player {
  title: string | null;
  numbers: string | null;
  time: number | null;
  duration: number | null;
  paused: boolean | null;
}

// The player as it is: its video, and what its controls say, shown or not.
function player(): Player {
  const video = document.querySelector<HTMLVideoElement>('video[data-testid="VideoElement"]');
  const text = (selector: string) => document.querySelector(selector)?.textContent?.trim() || null;
  const max = Number(document.querySelector('[data-testid="player-ux-scrubber-position"]')?.getAttribute("aria-valuemax"));
  return {
    title: text('[data-testid="player-ux-asset-title"]'),
    numbers: text('[data-testid="player-ux-season-episode"]'),
    time: video ? video.currentTime : null,
    duration: max > 0 ? max : video && Number.isFinite(video.duration) ? video.duration : null,
    paused: video ? video.paused : null,
  };
}

// The player's own play and pause button, pressed when the video isn't the
// way it's asked to be yet. Null once the video says so, or a reason.
async function playOrPause(want: string): Promise<string | null> {
  const video = document.querySelector<HTMLVideoElement>('video[data-testid="VideoElement"]');
  if (!video) return "nothing is playing on HBO Max";
  const done = () => (want === "paused" ? video.paused : !video.paused);
  if (done()) return null;
  const all = [...document.querySelectorAll<HTMLElement>('[data-testid="player-ux-play-pause-button"]')];
  const button = all.find((el) => el.getClientRects().length > 0) ?? all[0];
  if (!button) return "HBO Max's player has no play and pause";
  button.click();
  for (let i = 0; i < 30 && !done(); i++) await new Promise((resolve) => setTimeout(resolve, 100));
  return done() ? null : `HBO Max's player didn't ${want === "paused" ? "pause" : "play"}`;
}

interface Found {
  path: string;
  title: string;
  year: string;
}

// The titles search shows, once they're for what was typed: the box's value
// is it, and a title mentions its first word, or 4 s have gone.
async function results(query: string): Promise<Found[]> {
  const word = query.trim().toLowerCase().split(/\s+/)[0] ?? "";
  const tiles = () =>
    [...document.querySelectorAll('a[data-testid$="_tile"][data-sonic-id]')]
      .map((a) => ({
        path: /^\/((?:show|mini-series|movie|standalone)\/[0-9a-f-]{36})$/.exec(a.getAttribute("href") ?? "")?.[1] ?? "",
        title: a.querySelector(":scope > p > span")?.textContent?.trim() ?? "",
        year: a.querySelector('[data-testid="metadata_release_year"]')?.textContent?.trim() ?? "",
      }))
      .filter((found) => found.path && found.title);
  const input = document.querySelector<HTMLInputElement>('[data-testid="searchBar_field"]');
  for (let i = 0; i < 40; i++) {
    const now = tiles();
    if (input?.value === query && now.some((found) => found.title.toLowerCase().includes(word))) return now;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return tiles();
}

// On a show's page at the season asked for: the link to the episode. A reason
// instead when there's none.
function episodeLink(want: { season: number; episode: number }): { href?: string; error?: string } {
  const plain = (s: string) => s.replace(/[⁦-⁩]/g, "");
  const label = new RegExp(`^Watch(?: Again:)? Season ${want.season}, Episode ${want.episode}:`);
  const link = [...document.querySelectorAll('a[href*="/video/watch/"]')].find((a) => label.test(plain(a.getAttribute("aria-label") ?? "")));
  return link ? { href: link.getAttribute("href") ?? "" } : { error: `Season ${want.season} Episode ${want.episode} isn't on its page` };
}

// The sign-in form's email field, which HBO Max draws inside shadow roots,
// or the profile button of someone signed in already. False after 15 s.
async function formOrSignedIn(): Promise<boolean> {
  const deep = (root: Document | ShadowRoot, selector: string): Element | null => {
    const found = root.querySelector(selector);
    if (found) return found;
    for (const el of root.querySelectorAll("*")) {
      const inner = el.shadowRoot && deep(el.shadowRoot, selector);
      if (inner) return inner;
    }
    return null;
  };
  for (let i = 0; i < 150; i++) {
    if (deep(document, '#sign-in-phoneEmail-input, [data-testid="profile_button"]')) return true;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return false;
}

// A film's or a show's own play button, pressed: the one that isn't the
// trailer's. False when there's none.
function pressPlay(): boolean {
  const plain = (s: string) => s.replace(/[⁦-⁩]/g, "");
  const play = [...document.querySelectorAll<HTMLElement>('[data-testid="play_button"]')].find((el) => !/^Watch trailer\b/.test(plain(el.getAttribute("aria-label") ?? "")));
  play?.click();
  return !!play;
}

// --- The app -------------------------------------------------------------------

const app: TvApp = {
  id: "agentv.hbomax",

  async launch(ctx) {
    await page(ctx).goto(HOME);
  },

  signIn: {
    async isSignedIn(ctx) {
      const p = page(ctx);
      const url = here(p);
      if (url.origin !== ORIGIN || url.pathname.startsWith("/auth/")) return false;
      // Only someone signed in gets the player.
      if (PLAYING.test(url.pathname)) return true;
      const said = await p.evaluate(() =>
        document.querySelector('[data-testid="profile_button"], [data-testid="whoIsWatching_label"]')
          ? "in"
          : document.querySelector("#header-secondary-cta-default, #header-secondary-cta-mobile")
            ? "out"
            : null,
      );
      if (said === null) throw new Error("HBO Max's page doesn't say yet whether you're signed in");
      return said === "in";
    },
    // The form that asks for the email, which the phone then fills. Someone
    // signed in already may be sent on past it, so the profile button ends
    // the wait too.
    async open(ctx) {
      const p = page(ctx);
      await p.goto(SIGN_IN);
      if (!(await p.evaluate(formOrSignedIn))) throw new Error("HBO Max's sign-in form didn't show");
    },
  },

  async search(ctx, query) {
    const p = page(ctx);
    if (!here(p).pathname.startsWith("/search")) await p.goto(`${ORIGIN}/search`);
    await p.waitForSelector('[data-testid="searchBar_field"]', { timeout: 5_000 });
    await p.fill('[data-testid="searchBar_field"]', query);
    const found = await p.evaluate(results, query);
    return found.slice(0, 10).map(
      (title): Item => ({
        id: title.path,
        kind: /^(show|mini-series)\//.test(title.path) ? "series" : "film",
        title: title.title,
        ...(title.year ? { subtitle: title.year } : {}),
      }),
    );
  },

  playback: {
    // A title from search by its id, or one from the ledger by its name; then
    // its episode at the season asked for, or its own play button. Resolves
    // once the player is up, which plays on its own.
    async open(ctx, item) {
      const p = page(ctx);
      let path = TITLE.test(item.id) ? item.id : null;
      if (!path) {
        const found = (await app.search!(ctx, item.title)).find((title) => title.title.toLowerCase() === item.title.toLowerCase());
        if (!found) throw new Error(`HBO Max has nothing called ${item.title}`);
        path = found.id;
      }
      const episode = item.season !== undefined && item.episode !== undefined;
      await p.goto(`${ORIGIN}/${path}${episode ? `?season=${item.season}` : ""}`);
      await p.waitForSelector('[data-testid="play_button"]', { timeout: 10_000 });
      if (episode) {
        const link = await p.evaluate(episodeLink, { season: item.season!, episode: item.episode! });
        if (!link.href) throw new Error(`${item.title}: ${link.error}`);
        await p.goto(new URL(link.href, ORIGIN).href);
      } else if (!(await p.evaluate(pressPlay))) {
        throw new Error(`${item.title}: its page has nothing to play`);
      }
      await p.waitForSelector('video[data-testid="VideoElement"]', { timeout: 15_000, state: "attached" });
    },

    // Off the player's controls, which stay in the page while they're hidden,
    // and the video's own clock.
    async readPlaybackState(ctx): Promise<PlaybackState | null> {
      const p = page(ctx);
      const url = here(p);
      if (url.origin !== ORIGIN || !PLAYING.test(url.pathname)) return null;
      const now = await p.evaluate(player);
      if (!now.title || now.duration === null) throw new Error("HBO Max's player doesn't say what's playing");
      const numbers = /^S(\d+)\s*E(\d+)\b/.exec(now.numbers ?? "");
      return {
        title: now.title,
        ...(numbers ? { season: Number(numbers[1]), episode: Number(numbers[2]) } : {}),
        position: Math.min(Math.max(0, Math.round((now.time ?? 0) * 10) / 10), now.duration),
        duration: now.duration,
        playing: now.paused === false,
      };
    },

    // The player's Next Episode, which HBO Max shows near an episode's end.
    // Resolves once the player has moved on.
    async next(ctx) {
      const p = page(ctx);
      const before = here(p).pathname;
      if (!PLAYING.test(before)) throw new Error("nothing is playing on HBO Max");
      const pressed = await p.evaluate(() => {
        const next = document.querySelector<HTMLElement>('[data-testid="player-ux-up-next-button"]');
        next?.click();
        return !!next;
      });
      if (!pressed) throw new Error("HBO Max offers no next episode here");
      for (let waited = 0; waited < 7_000; waited += 250) {
        await sleep(250);
        if ((await p.evaluate(() => location.pathname)) !== before) return;
      }
      throw new Error("HBO Max didn't move to the next episode");
    },

    // The player's own play and pause, so HBO Max's player knows. Play and
    // pause on the phone come here first, then to the video on the page.
    async pause(ctx) {
      const p = page(ctx);
      if (!PLAYING.test(here(p).pathname)) throw new Error("nothing is playing on HBO Max");
      const why = await p.evaluate(playOrPause, "paused");
      if (why) throw new Error(why);
    },

    async resume(ctx) {
      const p = page(ctx);
      if (!PLAYING.test(here(p).pathname)) throw new Error("nothing is playing on HBO Max");
      const why = await p.evaluate(playOrPause, "playing");
      if (why) throw new Error(why);
    },
  },
};

export default app;
