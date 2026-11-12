// Prime Video on the TV, written by hand. It drives Prime Video's own site in
// the TV's Chromium, where you sign in on AgenTV's sign-in screen. On Linux,
// Prime Video plays in SD.
//
// What it knows about Prime Video comes from Prime Video's pages as they were
// captured from a signed-in session on my NUC, never from guesses, with one
// exception, said below. Those pages stay private. The tests here run against
// stand-ins made by hand, with only what this app reads (fixtures/README.md):
// - Signed in, Prime Video's pages have Sign Out in the account menu,
//   [data-testid=pv-nav-sign-out]. Signed out, they have Sign In,
//   [data-testid=pv-nav-sign-in], which goes on to Amazon's own sign-in page.
// - The search box sends ?phrase= to /region/<region>/search.
// - A title's page is /region/<region>/detail/<id>. A series' page is one
//   season's, with the season list linking to each season's own page, and
//   episodes as list items "2. Name", each with a play link. A title's own
//   play button, [data-testid=dp-atf-play-button], is a link too. Every play
//   link goes back to a title's page with ?autoplay=1, and the player opens
//   over that page.
// - The player draws its controls only after a pointer move over the
//   picture: the title, "S2 E1 Name", play and pause, and Next Episode. An
//   episode can start with a short video (an ad or a recap), so the
//   programme is the page's longest video.
//
// Not checked against a captured page: search's results. The capture saved
// the storefront rather than the results, so this reads results the way the
// storefront's cards are drawn, each an <article data-testid=card> with
// data-card-title, data-card-entity-type and a link to the title's page.
// The NUC's checks try a real search.
//
// Every call that reads the page waits a bounded time and fails with a plain
// reason, never a retry loop. It has no profiles: Prime Video opens on
// whichever profile you pick on its own page.

import type { AppContext, AppPage, Item, PlaybackState, TvApp } from "../../.agentv-os/apps/contract/contract.ts";

const ORIGIN = "https://www.primevideo.com";
const HOME = `${ORIGIN}/`;
const ID = /^[0-9A-Z]{10,40}$/;

function page(ctx: AppContext): AppPage {
  if (!ctx.page) throw new Error("Open Prime Video first");
  return ctx.page;
}

function here(p: AppPage): URL {
  return new URL(p.url() || HOME);
}

// Where the site is, with the region its addresses keep, like /region/eu on
// the NUC.
function base(url: URL): string {
  const region = /^\/region\/([a-z]+)\//.exec(url.pathname)?.[1];
  return `${ORIGIN}/region/${region ?? "eu"}`;
}

// The player is open over a title's page once a play link has taken it there.
function playing(url: URL): boolean {
  return url.origin === ORIGIN && /\/detail\/[0-9A-Z]+/.test(url.pathname) && url.searchParams.get("autoplay") === "1";
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// The one search result that's this title: the same name, then the same
// kind and year where Prime Video says them, so a remake or a show with the same
// name isn't picked. A year a year out still counts when there's no exact
// one, since a title can come out a year apart from one country to the
// next. Null when none is.
function sameName(a: string, b: string): boolean {
  const plain = (text: string) => text.toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/\s+/g, " ").trim();
  return plain(a) === plain(b);
}

function pick(found: Item[], item: Item): Item | null {
  const named = found.filter((title) => sameName(title.title, item.title) && (item.kind === "film") === (title.kind === "film"));
  if (!item.year) return named[0] ?? null;
  const year = (title: Item) => (title.subtitle && /^\d{4}$/.test(title.subtitle) ? Number(title.subtitle) : null);
  return (
    named.find((title) => year(title) === item.year) ??
    named.find((title) => year(title) !== null && Math.abs(year(title)! - item.year!) === 1) ??
    named.find((title) => year(title) === null) ??
    null
  );
}

// --- In the page ---------------------------------------------------------------
// Each of these runs in Prime Video's page, so it uses nothing from outside
// itself.

interface Player {
  title: string | null;
  info: string | null;
  time: number | null;
  duration: number | null;
  paused: boolean | null;
}

// The player as it is. With wake, a pointer move over the picture shows its
// controls first, the way the capture's probe did.
async function player(wake: boolean): Promise<Player> {
  const videos = [...document.querySelectorAll("video")].filter((v) => Number.isFinite(v.duration) && v.duration > 0);
  const video = videos.sort((a, b) => b.duration - a.duration)[0] ?? null;
  const title = () => document.querySelector(".atvwebplayersdk-title-text")?.textContent?.trim() || null;
  if (wake && video && !title()) {
    const box = video.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    (document.elementFromPoint(x, y) ?? video).dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: x, clientY: y, pointerType: "mouse" }));
    for (let i = 0; i < 15 && !title(); i++) await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return {
    title: title(),
    info: document.querySelector(".atvwebplayersdk-episode-info")?.textContent?.trim() || null,
    time: video ? video.currentTime : null,
    duration: video ? video.duration : null,
    paused: video ? video.paused : null,
  };
}

// One of the player's own controls, pressed after showing them the same way.
// For play and pause it waits until the video is as asked. Null, or a reason.
async function press(want: string): Promise<string | null> {
  const videos = [...document.querySelectorAll("video")].filter((v) => Number.isFinite(v.duration) && v.duration > 0);
  const video = videos.sort((a, b) => b.duration - a.duration)[0];
  if (!video) return "Nothing is playing on Prime Video";
  const done = () => (want === "paused" ? video.paused : want === "playing" ? !video.paused : false);
  if (done()) return null;
  const id = want === "next" ? "#atvwebplayersdk-next-episode-button" : "#atvwebplayersdk-play-pause-button";
  if (!document.querySelector(id)) {
    const box = video.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    (document.elementFromPoint(x, y) ?? video).dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: x, clientY: y, pointerType: "mouse" }));
    for (let i = 0; i < 15 && !document.querySelector(id); i++) await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const button = document.querySelector<HTMLElement>(id);
  if (!button) return want === "next" ? "There's no next episode" : "Couldn't play or pause Prime Video";
  button.click();
  if (want === "next") return null;
  for (let i = 0; i < 30 && !done(); i++) await new Promise((resolve) => setTimeout(resolve, 100));
  return done() ? null : `Couldn't ${want === "paused" ? "pause" : "play"} Prime Video`;
}

// Whether the page says you're signed in, once its menu is drawn. Null after
// 3 s.
async function signedIn(): Promise<boolean | null> {
  for (let i = 0; i < 30; i++) {
    if (document.querySelector('[data-testid="pv-nav-sign-out"]')) return true;
    if (document.querySelector('[data-testid="pv-nav-sign-in"]')) return false;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return null;
}

interface Found {
  id: string;
  title: string;
  series: boolean;
}

// Search's results, read as the storefront draws its cards (not checked
// against a captured results page). Waits up to 4 s for the first.
async function results(): Promise<Found[]> {
  const cards = () =>
    [...document.querySelectorAll('article[data-testid="card"]')]
      .map((card) => ({
        id: /\/detail\/([0-9A-Z]{10,40})/.exec(card.querySelector('a[href*="/detail/"]')?.getAttribute("href") ?? "")?.[1] ?? "",
        title: (card.getAttribute("data-card-title") ?? "").replace(/ - Season \d+$/, "").trim(),
        series: card.getAttribute("data-card-entity-type") === "TV Show",
      }))
      .filter((found, i, all) => found.id && found.title && all.findIndex((other) => other.id === found.id) === i);
  for (let i = 0; i < 40 && cards().length === 0; i++) await new Promise((resolve) => setTimeout(resolve, 100));
  return cards();
}

// On a series' page: the link to the season asked for, when it's another
// season's page than this one.
function seasonLink(season: number): string | null {
  const link = document.querySelector(`a[href*="atv_dp_season_select_s${season}"]`);
  const href = link?.getAttribute("href") ?? "";
  const id = (url: string) => /\/detail\/([0-9A-Z]+)/.exec(url)?.[1];
  return href && id(href) !== id(location.pathname) ? href : null;
}

// On a season's page: the episode's play link, or null.
function episodeLink(episode: number): string | null {
  const item = [...document.querySelectorAll('[data-testid="episode-list-item"]')].find((li) => (li.querySelector("h3")?.textContent?.trim() ?? "").startsWith(`${episode}. `));
  const href = item?.querySelector('a[data-testid="episodes-playbutton"]')?.getAttribute("href");
  return href ?? null;
}

// --- The app -------------------------------------------------------------------

const app: TvApp = {
  id: "agentv.primevideo",

  async launch(ctx) {
    await page(ctx).goto(HOME);
  },

  signIn: {
    async isSignedIn(ctx) {
      const p = page(ctx);
      const url = here(p);
      if (url.origin !== ORIGIN) return false;
      if (url.pathname.includes("/profiles")) return true;
      const said = await p.evaluate(signedIn);
      if (said === null) throw new Error("Still checking if you're signed in to Prime Video");
      return said;
    },
    // Prime Video's own Sign In, which goes on to Amazon's sign-in page for
    // the phone to fill: on this page, or on the start page when this one
    // doesn't say. Someone signed in already stays where they are.
    async open(ctx) {
      const p = page(ctx);
      let said = here(p).origin === ORIGIN ? await p.evaluate(signedIn) : null;
      if (said === null) {
        await p.goto(HOME);
        said = await p.evaluate(signedIn);
      }
      if (said === null) throw new Error("Couldn't open Prime Video's sign-in");
      if (!said) await p.click('[data-testid="pv-nav-sign-in"]');
    },
  },

  async search(ctx, query) {
    const p = page(ctx);
    await p.goto(`${base(here(p))}/search?phrase=${encodeURIComponent(query)}`);
    const found = await p.evaluate(results);
    return found.slice(0, 10).map((title): Item => ({ id: title.id, kind: title.series ? "series" : "film", title: title.title }));
  },

  playback: {
    // A title from search by its id, or one from the ledger by its name; then
    // its season's page and the episode's play link, or its own play button.
    // Resolves once the player is up over the page, which plays on its own.
    async open(ctx, item) {
      const p = page(ctx);
      let id = ID.test(item.id) ? item.id : null;
      if (!id) {
        const found = (await app.search!(ctx, item.title)).find((title) => title.title.toLowerCase() === item.title.toLowerCase());
        if (!found) throw new Error(`Couldn't find ${item.title} on Prime Video`);
        id = found.id;
      }
      const at = base(here(p));
      await p.goto(`${at}/detail/${id}`);
      await p.waitForSelector('[data-testid="dp-atf-play-button"]', { timeout: 10_000 });
      let href: string | null;
      if (item.season !== undefined && item.episode !== undefined) {
        const season = await p.evaluate(seasonLink, item.season);
        if (season) {
          await p.goto(new URL(season, ORIGIN).href);
          await p.waitForSelector('[data-testid="dp-atf-play-button"]', { timeout: 10_000 });
        }
        href = await p.evaluate(episodeLink, item.episode);
        if (!href) throw new Error(`Couldn't find season ${item.season}, episode ${item.episode}`);
      } else {
        href = await p.evaluate(() => document.querySelector('[data-testid="dp-atf-play-button"]')?.getAttribute("href") ?? null);
        if (!href) throw new Error(`Couldn't play ${item.title}`);
      }
      await p.goto(new URL(href, ORIGIN).href);
      await p.waitForSelector("video", { timeout: 15_000, state: "attached" });
    },

    // A title's own page, without playing it: by its id, or found by its
    // name and kind. Resolves true on its page, where Play is one press
    // away, or false when Prime Video doesn't have it, left on its own
    // search for the name.
    async show(ctx, item) {
      const p = page(ctx);
      let id = ID.test(item.id) ? item.id : null;
      if (!id) {
        const found = pick(await app.search!(ctx, item.title), item);
        if (!found) return false;
        id = found.id;
      }
      await p.goto(`${base(here(p))}/detail/${id}`);
      await p.waitForSelector('[data-testid="dp-atf-play-button"]', { timeout: 10_000 });
      return true;
    },

    // Off the player's controls, shown with a pointer move when they're
    // hidden, and the programme's own clock.
    async readPlaybackState(ctx): Promise<PlaybackState | null> {
      const p = page(ctx);
      if (!playing(here(p))) return null;
      const now = await p.evaluate(player, true);
      if (!now.title || now.duration === null) throw new Error("Couldn't tell what's playing on Prime Video");
      const numbers = /^S(\d+)\s*E(\d+)\b/.exec(now.info ?? "");
      return {
        title: now.title,
        ...(numbers ? { season: Number(numbers[1]), episode: Number(numbers[2]) } : {}),
        position: Math.min(Math.max(0, Math.round((now.time ?? 0) * 10) / 10), now.duration),
        duration: now.duration,
        playing: now.paused === false,
      };
    },

    // The player's Next Episode. Resolves once the page has moved on.
    async next(ctx) {
      const p = page(ctx);
      const before = here(p).href;
      if (!playing(here(p))) throw new Error("Nothing is playing on Prime Video");
      const why = await p.evaluate(press, "next");
      if (why) throw new Error(why);
      for (let waited = 0; waited < 7_000; waited += 250) {
        await sleep(250);
        if ((await p.evaluate(() => location.href)) !== before) return;
      }
      throw new Error("Couldn't skip to the next episode");
    },

    // The player's own play and pause, so Prime Video's player knows. Play and
    // pause on the phone come here first, then to the video on the page.
    async pause(ctx) {
      const p = page(ctx);
      if (!playing(here(p))) throw new Error("Nothing is playing on Prime Video");
      const why = await p.evaluate(press, "paused");
      if (why) throw new Error(why);
    },

    async resume(ctx) {
      const p = page(ctx);
      if (!playing(here(p))) throw new Error("Nothing is playing on Prime Video");
      const why = await p.evaluate(press, "playing");
      if (why) throw new Error(why);
    },
  },
};

export default app;
