// Plex on the TV: your own Plex Media Server's web app, in the TV's Chromium,
// signed in there with your Plex account through AgenTV's sign-in screen
// (ADR-032), with the phone's keyboard for the password.
//
// Plex's web app keeps the account's token in its page's localStorage, as
// myPlexAccessToken (test/record/plex checks the web app in Plex's own server
// image does). This app reads it to ask the server, with Plex's API, whether
// the page is signed in. Searching and opening an episode will come once
// they're written against Plex's web player with a real account.

import type { AppContext, TvApp } from "../../.agentv-os/apps/contract/contract.ts";

const ASK_MS = 10_000;
const READ_MS = 5_000;

// Who's asking, as Plex wants every client to say.
const CLIENT = { "X-Plex-Product": "AgenTV", "X-Plex-Client-Identifier": "agentv-plex", Accept: "application/json" };

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
  if (!/^https?:\/\/[^/]/.test(url)) throw new Error("Plex has no server address yet");
  return url.replace(/\/+$/, "");
}

function pageOf(ctx: AppContext) {
  if (!ctx.page) throw new Error("Plex's page isn't open");
  return ctx.page;
}

// The account's token, as Plex's web app keeps it once someone has signed in.
async function token(ctx: AppContext): Promise<string | null> {
  const kept = await timed(
    pageOf(ctx).evaluate(() => localStorage.getItem("myPlexAccessToken")),
    READ_MS,
    "reading Plex's sign-in from its page",
  );
  return typeof kept === "string" && kept !== "" ? kept : null;
}

const app: TvApp = {
  id: "agentv.plex",

  async launch(ctx) {
    await pageOf(ctx).goto(`${serverOf(ctx)}/web/index.html`);
  },

  signIn: {
    // Signed in when the page has a token the server takes.
    async isSignedIn(ctx) {
      const kept = await token(ctx);
      if (!kept) return false;
      const response = await timed(fetch(`${serverOf(ctx)}/library/sections`, { headers: { ...CLIENT, "X-Plex-Token": kept } }), ASK_MS, "Plex");
      if (response.status === 401) return false;
      if (!response.ok) throw new Error(`Plex answered ${response.status}`);
      return true;
    },
  },
};

export default app;
