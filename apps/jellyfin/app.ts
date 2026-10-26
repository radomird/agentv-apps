// Jellyfin on the TV: your own Jellyfin server's web app, in the TV's
// Chromium, signed in there through AgenTV's sign-in screen (ADR-032).
//
// The page keeps Jellyfin's sign-in, the way Jellyfin's web app always does.
// This app reads the page's token to ask Jellyfin's API for what to show, and
// to tell the page what to play: Jellyfin lets one of your sessions start
// something on another, and the page is one. So nothing here depends on how
// Jellyfin lays out its pages, only on its API.

import type { AppContext, Item, PlaybackState, TvApp } from "../../.agentv-os/apps/contract/contract.ts";

const ASK_MS = 10_000;
const READ_MS = 5_000;
const START_MS = 30_000;

interface JellyfinItem {
  Id: string;
  Name: string;
  Type: string;
  SeriesName?: string | null;
  SeriesId?: string | null;
  SeriesPrimaryImageTag?: string | null;
  ParentIndexNumber?: number | null;
  IndexNumber?: number | null;
  ProductionYear?: number | null;
  ImageTags?: { Primary?: string };
  UserData?: { PlaybackPositionTicks?: number };
}

interface JellyfinSession {
  Id: string;
  DeviceId: string;
  NowPlayingItem?: JellyfinItem;
}

// The page's sign-in: whose it is, and the device its session goes by.
interface Signed {
  base: string;
  token: string;
  user: string;
  device: string | null;
}

class SignedOut extends Error {}

function timed<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${what} took longer than ${ms / 1000} s`)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

function serverOf(ctx: AppContext): string {
  const url = ctx.settings.serverUrl ?? "";
  if (!/^https?:\/\/[^/]/.test(url)) throw new Error("Jellyfin has no server address yet");
  return url.replace(/\/+$/, "");
}

function pageOf(ctx: AppContext) {
  if (!ctx.page) throw new Error("Jellyfin's page isn't open");
  return ctx.page;
}

// What Jellyfin's web app keeps of its sign-in, read from the page: its
// servers, each with the token and the user it signed in as, and the page's
// own device id.
async function signed(ctx: AppContext): Promise<Signed | null> {
  const base = serverOf(ctx);
  const kept = await timed(
    pageOf(ctx).evaluate(() => ({
      credentials: localStorage.getItem("jellyfin_credentials"),
      device: localStorage.getItem("_deviceId2"),
    })),
    READ_MS,
    "reading Jellyfin's sign-in from its page",
  );
  let servers: { ManualAddress?: string; LocalAddress?: string; RemoteAddress?: string; AccessToken?: string; UserId?: string }[] = [];
  try {
    servers = JSON.parse(kept.credentials ?? "{}").Servers ?? [];
  } catch {
    return null;
  }
  const origin = new URL(base).origin;
  const sameServer = (address?: string) => {
    try {
      return !!address && new URL(address).origin === origin;
    } catch {
      return false;
    }
  };
  const withToken = servers.filter((server) => server.AccessToken && server.UserId);
  const server =
    withToken.find((s) => sameServer(s.ManualAddress) || sameServer(s.LocalAddress) || sameServer(s.RemoteAddress)) ??
    (withToken.length === 1 ? withToken[0] : undefined);
  if (!server) return null;
  return { base, token: server.AccessToken!, user: server.UserId!, device: kept.device };
}

async function need(ctx: AppContext): Promise<Signed> {
  const who = await signed(ctx);
  if (!who) throw new Error("Jellyfin isn't signed in");
  return who;
}

// One request to Jellyfin's API with the page's token alone, so Jellyfin
// keeps that token's device as it is.
async function ask<T>(who: Signed, path: string, method = "GET"): Promise<T | null> {
  const response = await timed(
    fetch(`${who.base}${path}`, { method, headers: { Authorization: `MediaBrowser Token="${who.token}"` } }),
    ASK_MS,
    "Jellyfin",
  );
  if (response.status === 401) throw new SignedOut("Jellyfin isn't signed in");
  if (!response.ok) throw new Error(`Jellyfin answered ${response.status}`);
  if (response.status === 204) return null;
  return (await response.json()) as T;
}

function picture(who: Signed, id: string, tag?: string | null): string | undefined {
  return tag ? `${who.base}/Items/${id}/Images/Primary?tag=${tag}&maxHeight=480` : undefined;
}

// A Jellyfin item as the contract's, with only the parts it has.
function toItem(who: Signed, found: JellyfinItem): Item | null {
  const item = (fields: Item): Item => Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)) as unknown as Item;
  if (found.Type === "Movie") {
    return item({
      id: found.Id,
      kind: "film",
      title: found.Name,
      subtitle: found.ProductionYear ? String(found.ProductionYear) : undefined,
      poster: picture(who, found.Id, found.ImageTags?.Primary),
    });
  }
  if (found.Type === "Series") {
    return item({ id: found.Id, kind: "series", title: found.Name, poster: picture(who, found.Id, found.ImageTags?.Primary) });
  }
  if (found.Type === "Episode") {
    return item({
      id: found.Id,
      kind: "episode",
      title: found.SeriesName ?? found.Name,
      season: found.ParentIndexNumber ?? undefined,
      episode: found.IndexNumber ?? undefined,
      subtitle: found.Name,
      poster: found.SeriesId ? picture(who, found.SeriesId, found.SeriesPrimaryImageTag) : undefined,
      still: picture(who, found.Id, found.ImageTags?.Primary),
    });
  }
  return null;
}

// The page's own session, which Jellyfin can tell what to play.
async function pageSession(who: Signed): Promise<JellyfinSession> {
  if (!who.device) throw new Error("Jellyfin's page has no device id, so it can't be told what to play");
  const sessions = await ask<JellyfinSession[]>(who, `/Sessions?deviceId=${encodeURIComponent(who.device)}`);
  const own = sessions?.find((session) => session.DeviceId === who.device);
  if (!own) throw new Error("Jellyfin doesn't see its page as a session yet");
  return own;
}

// The video on the page, if there is one with a length.
async function video(ctx: AppContext): Promise<{ position: number; duration: number; playing: boolean } | null> {
  return timed(
    pageOf(ctx).evaluate(() => {
      const found = document.querySelector("video");
      if (!found || !Number.isFinite(found.duration) || found.duration <= 0) return null;
      return { position: found.currentTime, duration: found.duration, playing: !found.paused && !found.ended };
    }),
    READ_MS,
    "reading Jellyfin's player",
  );
}

const app: TvApp = {
  id: "agentv.jellyfin",

  async launch(ctx) {
    await pageOf(ctx).goto(`${serverOf(ctx)}/web/`);
  },

  // Signed out, Jellyfin's page shows its own sign-in at its home address.
  signIn: {
    async isSignedIn(ctx) {
      const who = await signed(ctx);
      if (!who) return false;
      try {
        await ask(who, "/Users/Me");
        return true;
      } catch (error) {
        if (error instanceof SignedOut) return false;
        throw error;
      }
    },
  },

  async search(ctx, query) {
    const who = await need(ctx);
    const found = await ask<{ Items?: JellyfinItem[] }>(
      who,
      `/Items?userId=${who.user}&searchTerm=${encodeURIComponent(query)}&Recursive=true&IncludeItemTypes=Movie,Series,Episode&Limit=20`,
    );
    return (found?.Items ?? []).map((one) => toItem(who, one)).filter((one): one is Item => one !== null);
  },

  playback: {
    // A series plays its next episode. Anything else starts where it was
    // left, as Jellyfin keeps it, on the page's own player.
    async open(ctx, item) {
      const who = await need(ctx);
      let id = item.id;
      if (item.kind === "series") {
        const next = await ask<{ Items?: JellyfinItem[] }>(who, `/Shows/NextUp?userId=${who.user}&seriesId=${id}&Limit=1`);
        const episode = next?.Items?.[0];
        if (!episode) throw new Error(`Jellyfin has nothing next in ${item.title}`);
        id = episode.Id;
      }
      const kept = await ask<JellyfinItem>(who, `/Items/${id}?userId=${who.user}`);
      const start = kept?.UserData?.PlaybackPositionTicks ?? 0;
      const session = await pageSession(who);
      await ask(who, `/Sessions/${session.Id}/Playing?playCommand=PlayNow&itemIds=${id}&startPositionTicks=${start}`, "POST");
      const started = Date.now();
      while (Date.now() - started < START_MS) {
        if ((await video(ctx))?.playing) return;
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      throw new Error(`Jellyfin didn't start ${item.title}`);
    },

    // Where it is from the page's video, and what it is from Jellyfin, which
    // the page tells as it plays.
    async readPlaybackState(ctx): Promise<PlaybackState | null> {
      const playing = await video(ctx);
      if (!playing) return null;
      const now = (await pageSession(await need(ctx))).NowPlayingItem;
      if (!now) return null;
      const episode = now.Type === "Episode";
      return {
        title: episode ? (now.SeriesName ?? now.Name) : now.Name,
        ...(episode && now.ParentIndexNumber != null ? { season: now.ParentIndexNumber } : {}),
        ...(episode && now.IndexNumber != null ? { episode: now.IndexNumber } : {}),
        position: Math.floor(playing.position),
        duration: Math.floor(playing.duration),
        playing: playing.playing,
      };
    },
  },
};

export default app;
