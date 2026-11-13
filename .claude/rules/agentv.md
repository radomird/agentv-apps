# AgenTV

This repo is `agentv-apps`: AgenTV's official apps, one folder each under `apps/`, and the signed app index built from them (ADR-036). It's public. AgenTV itself lives in `agentv-os`, whose app contract, contract runner and installer the checks here use, at the commit in `.github/agentv-os`.

The plan lives in `agentv-planning`: read its `HANDOFF.md` first, then the ADRs in `DECISION-RECORD.md` (ADR-010, ADR-032 and ADR-036 above all), then `PHASE-1-PLAN.md`, "App contract". The ADRs are decisions, so don't re-open one without asking Radomir. AgenTV's skills live in `agentv-os/.claude/skills/`; `agentv-copy` and `agentv-quality-gates` matter most here.

## Rules

- **An app is a folder** with `manifest.json`, its code and `fixtures/`. It imports the contract's types with `import type` from `.agentv-os/apps/contract/contract.ts` (`bin/fetch-agentv-os` puts agentv-os there) and imports nothing else from outside its folder.
- **A streaming app stays in its own folder.** The official streaming apps (Disney+, Netflix, Prime Video, HBO Max, YouTube and YouTube Kids) each live in `apps/<id>/`, and a service's names, hosts and selectors appear only in its own folder (ADR-066). `test/agentv/policy/service-folders` says which folder is whose, and the policy check refuses them anywhere else. Nothing here automates Spotify or SkyShowtime.
- **Written by hand, against real pages.** A streaming app's selectors and addresses come from the pages Radomir captured from his signed-in sessions (`bin/capture` in the private `agentv-adapters` repo), never from guesses, and never from fetching the service's pages yourself. A service with no captures yet waits. The captures never come here.
- **No passwords kept** (ADR-032). An app signs in on its service's own page, through AgenTV's sign-in screen, and reads what it needs from that page.
- **Fixtures are recorded or made by hand.** A server you run yourself (Jellyfin, Immich, Plex) has its replies recorded from its own server in CI (`test/record/`), never made up. A page in `fixtures/pages/` is a stand-in made by hand, with only what the app reads, and its README says so. A streaming app's stand-ins are never its captured pages. No sign-in material: tokens become `fixture-token`.
- **A changed app gets a newer version** in its manifest (`test/versions`), since the index lists each app at the last commit that changed it.
- **No secrets.** The index is signed in CI with the `AGENTV_SIGNING_KEY` secret, AgenTV's own key.
- **The owner name is never in code.** Scripts read it from GitHub's context or the clone's origin.
- **Copy** reads like an indie dev explaining the project to another dev: short sentences, plain words before project words, what actually happens in order, and no inside references (ADRs, acceptance ids) in public text. "Coming soon" for what isn't built, "Powered by Omarchy", and no em dashes anywhere. The `agentv-copy` skill has the rules and examples.

## Before you commit

- Run `test/run`. A task isn't done until it's green.
- Commit with this repo's own git identity. Leave out any AI attribution: no Co-Authored-By or session trailers in commit messages, and no "Generated with" line in pull requests. Log progress in `agentv-planning`'s `LOG.md`.
