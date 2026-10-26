// The recorded replies in the apps' fixtures: each says what was asked and
// is an answer, holds no token but fixture-token and only plain ids, and
// Jellyfin's agree with each other and with the stand-in pages.

import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const ROOT = join(import.meta.dirname, "..");
const json = (path: string) => JSON.parse(readFileSync(path, "utf8"));

test("every recorded reply says what was asked, holds no token but fixture-token, and only plain ids", () => {
  for (const app of readdirSync(join(ROOT, "apps"))) {
    const dir = join(ROOT, "apps", app, "fixtures");
    if (!existsSync(join(dir, "recording.json"))) continue;
    for (const name of readdirSync(dir).filter((file) => file.endsWith(".json") && !["recording.json", "contract.json"].includes(file))) {
      const text = readFileSync(join(dir, name), "utf8");
      const recorded = JSON.parse(text);
      assert.match(recorded.request?.method ?? "", /^(GET|POST)$/, `${app}/${name} names its request`);
      assert.match(recorded.request?.path ?? "", /^\//, `${app}/${name} names its path`);
      assert.ok(recorded.status >= 200 && recorded.status < 300, `${app}/${name} is an answer`);
      // A real token, or an id the server made up, would be long and random.
      for (const id of text.match(/[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}/gi) ?? []) {
        assert.match(id, /^0{8}-?0{4}-?0{4}-?0[0-9a-f]{3}-?[0-9a-f]{12}$/, `${app}/${name} has a plain id, not ${id}`);
      }
      assert.ok(!/"(AccessToken|accessToken)":\s*"(?!fixture-token")/.test(text), `${app}/${name} keeps no token`);
    }
  }
});

test("Jellyfin's agree: the film is the one to resume, at 2:30, and the page's session plays it", () => {
  const dir = join(ROOT, "apps/jellyfin/fixtures");
  const ids = json(join(dir, "recording.json"));
  const resume = json(join(dir, "resume.json")).body.Items[0];
  assert.deepEqual([resume.Id, resume.UserData.PlaybackPositionTicks], [ids.film, 1_500_000_000]);
  assert.equal(json(join(dir, "next-up.json")).body.Items[0].Id, ids.episode);
  assert.equal(json(join(dir, "next-up-series.json")).body.Items[0].Id, ids.episode);
  const session = json(join(dir, "session-playing.json")).body[0];
  assert.deepEqual([session.Id, session.DeviceId, session.SupportsRemoteControl, session.NowPlayingItem.Id], [ids.session, ids.device, true, ids.film]);
  assert.match(json(join(dir, "play-now.json")).request.path, new RegExp(`^/Sessions/${ids.session}/Playing\\?playCommand=PlayNow&itemIds=${ids.film}&`));
  // The stand-in pages keep the recorded user and the page's device.
  for (const page of ["home.html", "playing.html"]) {
    const text = readFileSync(join(dir, "pages", page), "utf8");
    assert.ok(text.includes(`UserId: "${ids.user}"`) && text.includes(`"_deviceId2", "${ids.device}"`), `pages/${page} is the recorded viewer's page`);
  }
});
