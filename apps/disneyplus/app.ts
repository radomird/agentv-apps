// Disney+ on the TV, written by hand. It drives Disney+'s own site in the
// TV's Chromium, where you sign in on AgenTV's sign-in screen (ADR-032). It's
// also the yardstick for what AgenTV's builder writes (ADR-011).
//
// What it knows about Disney+ comes from Disney+'s pages as they were
// captured from a signed-in session on my NUC, and from what the capture's
// probes did there, never from guesses. Those pages stay private. The tests
// here run against stand-ins made by hand, with only what this app reads
// (fixtures/README.md):
// - Signed in, every page but the player has the profile menu's button,
//   [data-testid=dropdown-active-profile]. Signed out, the start page has
//   Log In, [data-testid=log_in]. The sign-in form is under /identity/.
// - Search is /browse/search, with #searchInput, and each title it finds is a
//   link to /browse/entity-<id>.
// - A title's page lists its episodes as links to /play/<id>, labelled
//   "Season 3 Episode 1 Bedroom ...", or has a play button for a film.
// - The player draws its controls, with the title and "S3:E1 Bedroom", the
//   timeline, play and pause, and PLAY NEXT, only while they show. A mouse
//   move over the picture shows them; the capture's probe saw that work on
//   the NUC.
//
// Every call that reads the page waits a bounded time and fails with a plain
// reason, never a retry loop. The page is all in Disney+'s own DOM, in open
// shadow roots too, so each read in the page walks into them.
//
// Not written yet, since the pages for them haven't been captured: picking a
// season other than the one a series' page shows first, and profiles
// (ADR-009) for a child watching.

import type { AppContext, AppPage, Item, PlaybackState, TvApp } from "../../.agentv-os/apps/contract/contract.ts";

const ORIGIN = "https://www.disneyplus.com";
const HOME = `${ORIGIN}/`;
const SIGN_IN = `${ORIGIN}/identity/login/enter-email`;
const ENTITY = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PLAYING = /\/play\/[0-9a-f-]{36}$/;
// How long what was read off the controls is trusted before they're shown
// again to check it.
const RELEARN_MS = 10 * 60_000;

function page(ctx: AppContext): AppPage {
  if (!ctx.page) throw new Error("Disney+'s page isn't open");
  return ctx.page;
}

// Where the site is, with the region its addresses keep, like /eu on the
// NUC. Disney+'s own links leave it out too, so without one it's the origin.
function base(url: string): string {
  const region = /^\/([a-z]{2}(?:-[a-z]{2})?)\/(?:browse|play|home)\b/.exec(new URL(url).pathname)?.[1];
  return region ? `${ORIGIN}/${region}` : ORIGIN;
}

// Where its page was after its last call.
function here(p: AppPage): URL {
  return new URL(p.url() || HOME);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// --- In the page ---------------------------------------------------------------
// Each of these runs in Disney+'s page, so it uses nothing from outside itself.

interface Player {
  src: string;
  time: number | null;
  paused: boolean | null;
  title: string | null;
  subtitle: string | null;
  now: number | null;
  max: number | null;
}

// The player as it is: its video, and what its controls say when they show.
// With wake, a mouse move over the picture shows them first, the way the
// capture's probe did.
async function player(wake: boolean): Promise<Player> {
  const deep = (root: Document | ShadowRoot, selector: string, out: Element[] = []): Element[] => {
    out.push(...root.querySelectorAll(selector));
    for (const el of root.querySelectorAll("*")) if (el.shadowRoot) deep(el.shadowRoot, selector, out);
    return out;
  };
  const area = (el: Element) => {
    const box = el.getBoundingClientRect();
    return box.width * box.height;
  };
  const video = (deep(document, "video") as HTMLVideoElement[]).sort((a, b) => area(b) - area(a))[0] ?? null;
  const shown = () => deep(document, "title-bug").length > 0;
  if (wake && video && !shown()) {
    const box = video.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    let target = document.elementFromPoint(x, y);
    for (let inner = target?.shadowRoot?.elementFromPoint(x, y); inner && inner !== target; inner = target?.shadowRoot?.elementFromPoint(x, y)) target = inner;
    for (const type of ["pointerover", "pointerenter", "pointermove"]) {
      target?.dispatchEvent(new PointerEvent(type, { bubbles: true, composed: true, clientX: x, clientY: y, pointerType: "mouse" }));
    }
    target?.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, composed: true, clientX: x + 3, clientY: y + 3 }));
    for (let i = 0; i < 15 && !shown(); i++) await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const text = (selector: string) => deep(document, selector)[0]?.textContent?.trim() || null;
  const slider = deep(document, '[data-qa="progress-bar.seekableRange"]')[0];
  const number = (name: string) => (slider?.hasAttribute(name) ? Number(slider.getAttribute(name)) : null);
  return {
    src: video?.currentSrc ?? "",
    time: video ? video.currentTime : null,
    paused: video ? video.paused : null,
    title: text('[data-qa="title-bug.title"]'),
    subtitle: text('[data-qa="title-bug.subtitle"]'),
    now: number("aria-valuenow"),
    max: number("aria-valuemax"),
  };
}

// The controls' PLAY NEXT, clicked, after showing the controls the same way.
// False when there's none, as for a film.
async function playNext(): Promise<boolean> {
  const deep = (root: Document | ShadowRoot, selector: string, out: Element[] = []): Element[] => {
    out.push(...root.querySelectorAll(selector));
    for (const el of root.querySelectorAll("*")) if (el.shadowRoot) deep(el.shadowRoot, selector, out);
    return out;
  };
  const find = () => deep(document, '[data-qa="play-next.button-container"]')[0] as HTMLElement | undefined;
  if (!find()) {
    const video = deep(document, "video").sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0];
    const box = video?.getBoundingClientRect();
    if (box) {
      let target = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      for (let inner = target?.shadowRoot?.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2); inner && inner !== target; inner = target?.shadowRoot?.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)) target = inner;
      target?.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, composed: true, clientX: box.left + box.width / 2, clientY: box.top + box.height / 2 }));
    }
    for (let i = 0; i < 15 && !find(); i++) await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const next = find();
  if (!next) return false;
  next.click();
  return true;
}

// The player's own play and pause control, pressed when the video isn't the
// way it's asked to be yet, after showing the controls the same way. Null
// once the video says so, or a reason.
async function playOrPause(want: string): Promise<string | null> {
  const deep = (root: Document | ShadowRoot, selector: string, out: Element[] = []): Element[] => {
    out.push(...root.querySelectorAll(selector));
    for (const el of root.querySelectorAll("*")) if (el.shadowRoot) deep(el.shadowRoot, selector, out);
    return out;
  };
  const area = (el: Element) => {
    const box = el.getBoundingClientRect();
    return box.width * box.height;
  };
  const video = (deep(document, "video") as HTMLVideoElement[]).sort((a, b) => area(b) - area(a))[0];
  if (!video) return "nothing is playing on Disney+";
  const done = () => (want === "paused" ? video.paused : !video.paused);
  if (done()) return null;
  const find = () => {
    const all = deep(document, '[data-qa~="toggle-play-pause.buttonContainer"]') as HTMLElement[];
    return all.find((el) => el.getClientRects().length > 0) ?? all[0];
  };
  if (!find()) {
    const box = video.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    let target = document.elementFromPoint(x, y);
    for (let inner = target?.shadowRoot?.elementFromPoint(x, y); inner && inner !== target; inner = target?.shadowRoot?.elementFromPoint(x, y)) target = inner;
    target?.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, composed: true, clientX: x + 3, clientY: y + 3 }));
    for (let i = 0; i < 15 && !find(); i++) await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const button = find();
  if (!button) return "Disney+'s player didn't show its play and pause";
  button.click();
  for (let i = 0; i < 30 && !done(); i++) await new Promise((resolve) => setTimeout(resolve, 100));
  return done() ? null : `Disney+'s player didn't ${want === "paused" ? "pause" : "play"}`;
}

interface Found {
  id: string;
  title: string;
  label: string;
  year: string;
}

// The titles search shows, once they're for what was typed: the box's
// value is it, and a title mentions its first word, or 4 s have gone.
async function results(query: string): Promise<Found[]> {
  const word = query.trim().toLowerCase().split(/\s+/)[0] ?? "";
  const tiles = () =>
    [...document.querySelectorAll('a[data-testid="set-item"][href*="/browse/entity-"]')]
      // Live events' ids join three, and they aren't titles to play.
      .filter((a) => !(a.getAttribute("data-item-id") ?? "").includes(":"))
      .map((a) => ({
        id: /\/browse\/entity-([0-9a-f-]{36})/.exec(a.getAttribute("href") ?? "")?.[1] ?? "",
        title: a.querySelector(":scope > div:not([data-testid]) > span")?.textContent?.trim() ?? "",
        label: a.getAttribute("aria-label") ?? "",
        year: /^\d{4}/.exec(a.querySelector(":scope > div:not([data-testid]) > div > span")?.textContent?.trim() ?? "")?.[0] ?? "",
      }))
      .filter((found) => found.id && found.title);
  const input = document.querySelector<HTMLInputElement>("#searchInput");
  for (let i = 0; i < 40; i++) {
    const now = tiles();
    if (input?.value === query && now.some((found) => found.title.toLowerCase().includes(word))) return now;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return tiles();
}

// On a title's page: the link to play the episode asked for, or the film or
// the series' own play button. A reason instead when there's none.
function watchLink(want: { season: number | null; episode: number | null }): { href?: string; error?: string } {
  if (want.season !== null && want.episode !== null) {
    const label = `Season ${want.season} Episode ${want.episode} `;
    const link = [...document.querySelectorAll('a[data-testid="set-item"][href*="/play/"]')].find((a) => (a.getAttribute("aria-label") ?? "").startsWith(label));
    if (link) return { href: link.getAttribute("href") ?? "" };
    const showing = document.querySelector('[data-testid="dropdown-button"]')?.textContent?.trim();
    if (showing && showing !== `Season ${want.season}`) return { error: `Disney+ shows ${showing} first, and picking Season ${want.season} isn't written yet` };
    return { error: `Season ${want.season} Episode ${want.episode} isn't on its page` };
  }
  const play = document.querySelector('a[data-testid="playback-action-button"][href*="/play/"]');
  return play ? { href: play.getAttribute("href") ?? "" } : { error: "its page has nothing to play" };
}

// --- The app -------------------------------------------------------------------

// What the controls said about what's playing, while they showed: its
// title, season and episode, and how the video's own clock lines up with
// the timeline. Kept for the video it was read from, so the controls aren't
// shown over the picture every time it's asked.
let learned: { key: string; title: string; season?: number; episode?: number; offset: number; duration: number; at: number } | null = null;

// The contract's playback, with the pause and resume the box will call once
// AgenTV's app contract has them. Play and pause on the phone go to these
// first, then to the video on the page.
type Playback = NonNullable<TvApp["playback"]> & {
  pause(ctx: AppContext): Promise<void>;
  resume(ctx: AppContext): Promise<void>;
};

const app: TvApp & { playback: Playback } = {
  id: "agentv.disneyplus",

  async launch(ctx) {
    await page(ctx).goto(HOME);
  },

  signIn: {
    async isSignedIn(ctx) {
      const p = page(ctx);
      const url = here(p);
      if (url.origin !== ORIGIN || url.pathname.startsWith("/identity/")) return false;
      // Only someone signed in gets the player.
      if (PLAYING.test(url.pathname)) return true;
      const said = await p.evaluate(() =>
        document.querySelector('[data-testid="dropdown-active-profile"]') ? "in" : document.querySelector('[data-testid="log_in"]') ? "out" : null,
      );
      if (said === null) throw new Error("Disney+'s page doesn't say yet whether you're signed in");
      return said === "in";
    },
    // The form that asks for the email, which the phone then fills
    // (ADR-032). Someone signed in already is sent on past it, as on the NUC
    // on 2026-10-27, so the profile menu's button ends the wait too.
    async open(ctx) {
      const p = page(ctx);
      await p.goto(SIGN_IN);
      await p.waitForSelector('#email, [data-testid="dropdown-active-profile"]', { timeout: 15_000 });
    },
  },

  async search(ctx, query) {
    const p = page(ctx);
    const at = `${base(here(p).href)}/browse/search`;
    if (here(p).pathname !== new URL(at).pathname) await p.goto(at);
    await p.waitForSelector("#searchInput", { timeout: 5_000 });
    await p.fill("#searchInput", query);
    const found = await p.evaluate(results, query);
    return found.slice(0, 10).map(
      (title): Item => ({
        id: title.id,
        // Disney+'s tiles say a title is a series only for some Originals;
        // open() plays either from the title's own page.
        kind: /\bSeries\b/.test(title.label) ? "series" : "film",
        title: title.title,
        ...(title.year ? { subtitle: title.year } : {}),
      }),
    );
  },

  playback: {
    // A title from search by its id, or one from the ledger by its name; then
    // its episode, or its own play button. Resolves once the player is up,
    // which plays on its own.
    async open(ctx, item) {
      const p = page(ctx);
      let entity = ENTITY.test(item.id) ? item.id : null;
      if (!entity) {
        const found = (await app.search!(ctx, item.title)).find((title) => title.title.toLowerCase() === item.title.toLowerCase());
        if (!found) throw new Error(`Disney+ has nothing called ${item.title}`);
        entity = found.id;
      }
      await p.goto(`${base(here(p).href)}/browse/entity-${entity}`);
      await p.waitForSelector('[data-testid="playback-action-button"]', { timeout: 10_000 });
      const link = await p.evaluate(watchLink, { season: item.season ?? null, episode: item.episode ?? null });
      if (!link.href) throw new Error(`${item.title}: ${link.error}`);
      await p.goto(new URL(link.href, ORIGIN).href);
      await p.waitForSelector("disney-web-player", { timeout: 15_000, state: "attached" });
    },

    // From the player's own controls once, then the video's clock.
    async readPlaybackState(ctx): Promise<PlaybackState | null> {
      const p = page(ctx);
      const url = here(p);
      if (url.origin !== ORIGIN || !PLAYING.test(url.pathname)) return null;
      let now = await p.evaluate(player, false);
      const key = `${url.pathname} ${now.src}`;
      const fresh = learned?.key === key && Date.now() - learned.at < RELEARN_MS;
      if (!now.title && !fresh) now = await p.evaluate(player, true);
      if (now.title && now.now !== null && now.max) {
        const numbers = /^S(\d+):E(\d+)\b/.exec(now.subtitle ?? "");
        learned = {
          key,
          title: now.title,
          ...(numbers ? { season: Number(numbers[1]), episode: Number(numbers[2]) } : {}),
          offset: (now.time ?? 0) - now.now,
          duration: now.max,
          at: Date.now(),
        };
      }
      if (!learned || learned.key !== key) throw new Error("Disney+'s player didn't show what's playing");
      const position = now.title && now.now !== null ? now.now : Math.round(((now.time ?? 0) - learned.offset) * 10) / 10;
      return {
        title: learned.title,
        ...(learned.season !== undefined ? { season: learned.season, episode: learned.episode } : {}),
        position: Math.min(Math.max(0, position), learned.duration),
        duration: learned.duration,
        playing: now.paused === false,
      };
    },

    // The controls' PLAY NEXT. Resolves once the player has moved on.
    async next(ctx) {
      const p = page(ctx);
      const before = here(p).pathname;
      if (!PLAYING.test(before)) throw new Error("nothing is playing on Disney+");
      if (!(await p.evaluate(playNext))) throw new Error("Disney+ offers no next episode here");
      for (let waited = 0; waited < 7_000; waited += 250) {
        await sleep(250);
        if ((await p.evaluate(() => location.pathname)) !== before) return;
      }
      throw new Error("Disney+ didn't move to the next episode");
    },

    // The controls' own play and pause, so Disney+'s player knows.
    async pause(ctx) {
      const p = page(ctx);
      if (!PLAYING.test(here(p).pathname)) throw new Error("nothing is playing on Disney+");
      const why = await p.evaluate(playOrPause, "paused");
      if (why) throw new Error(why);
    },

    async resume(ctx) {
      const p = page(ctx);
      if (!PLAYING.test(here(p).pathname)) throw new Error("nothing is playing on Disney+");
      const why = await p.evaluate(playOrPause, "playing");
      if (why) throw new Error(why);
    },
  },
};

export default app;
