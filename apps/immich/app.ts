// Immich on the TV: your own Immich server's web app, in the TV's Chromium,
// signed in there through AgenTV's sign-in screen (ADR-032).
//
// Immich keeps its sign-in in the page's cookies, out of reach of anything
// but the page. So this app asks Immich's API from the page itself, which
// sends them, and opens an album at its own address on Immich's web app.
// Nothing here depends on how Immich lays out its pages.

import type { AppContext, Item, TvApp } from "../../.agentv-os/apps/contract/contract.ts";

const ASK_MS = 10_000;
const OPEN_MS = 15_000;

interface ImmichAlbum {
  id: string;
  albumName: string;
  assetCount?: number;
}

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
  if (!/^https?:\/\/[^/]/.test(url)) throw new Error("Immich has no server address yet");
  return url.replace(/\/+$/, "");
}

function pageOf(ctx: AppContext) {
  if (!ctx.page) throw new Error("Immich's page isn't open");
  return ctx.page;
}

// One request to Immich's API, made by the page with its own cookies. Says
// whether Immich's web app thinks it's signed in, too: it keeps a cookie
// that says so beside the one with the token, which it can't read.
async function ask<T>(ctx: AppContext, path: string): Promise<{ signedIn: boolean; status: number; body: T | null }> {
  const url = `${serverOf(ctx)}${path}`;
  return timed(
    pageOf(ctx).evaluate(async (address: string) => {
      const signedIn = document.cookie.split(/;\s*/).includes("immich_is_authenticated=true");
      if (!signedIn) return { signedIn, status: 401, body: null };
      const response = await fetch(address, { headers: { Accept: "application/json" }, credentials: "same-origin" });
      return { signedIn, status: response.status, body: response.ok ? await response.json() : null };
    }, url),
    ASK_MS,
    "Immich",
  ) as Promise<{ signedIn: boolean; status: number; body: T | null }>;
}

async function albums(ctx: AppContext): Promise<ImmichAlbum[]> {
  const reply = await ask<ImmichAlbum[]>(ctx, "/api/albums");
  if (reply.status === 401) throw new Error("Immich isn't signed in");
  if (reply.status !== 200) throw new Error(`Immich answered ${reply.status}`);
  return reply.body ?? [];
}

const app: TvApp = {
  id: "agentv.immich",

  async launch(ctx) {
    await pageOf(ctx).goto(`${serverOf(ctx)}/`);
  },

  // Signed out, Immich's page shows its own sign-in at its home address.
  signIn: {
    async isSignedIn(ctx) {
      const reply = await ask(ctx, "/api/users/me");
      if (reply.status === 401) return false;
      if (reply.status !== 200) throw new Error(`Immich answered ${reply.status}`);
      return true;
    },
  },

  // Your albums, and the ones shared with you, by their names.
  async search(ctx, query) {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return (await albums(ctx))
      .filter((album) => words.every((word) => album.albumName.toLowerCase().includes(word)))
      .map(
        (album): Item => ({
          id: album.id,
          kind: "photo-album",
          title: album.albumName,
          ...(album.assetCount !== undefined ? { subtitle: `${album.assetCount} ${album.assetCount === 1 ? "photo" : "photos"}` } : {}),
        }),
      );
  },

  playback: {
    // Shows the album on Immich's own page. Resolves when the page is there.
    async open(ctx, item) {
      if (item.kind !== "photo-album" || !/^[0-9a-f-]{36}$/i.test(item.id)) throw new Error(`Immich can't open ${item.title}`);
      const page = pageOf(ctx);
      const address = `${serverOf(ctx)}/albums/${item.id}`;
      await timed(page.goto(address), OPEN_MS, `opening ${item.title}`);
      if (!page.url().startsWith(address)) throw new Error(`Immich didn't open ${item.title}`);
    },

    // An album looked at isn't something watched, so it goes in no ledger
    // row: there's never a playback state.
    async readPlaybackState() {
      return null;
    },
  },
};

export default app;
