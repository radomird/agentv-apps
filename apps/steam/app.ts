// Steam on the TV: Steam Big Picture, full screen in a gamescope of its own
// (ADR-031). The box starts it from this manifest's exec, since an app's
// worker starts no processes. The screen daemon puts it in front, keeps a
// game running behind home with Quit on its tile (S2.15), and brings home
// back when Steam quits.
//
// Signing in, the library and the games are Steam's own, on the TV.

import type { TvApp } from "../../.agentv-os/apps/contract/contract.ts";

const app: TvApp = {
  id: "agentv.steam",

  // The box opens Steam itself, so there's nothing for the app to do.
  async launch() {},
};

export default app;
