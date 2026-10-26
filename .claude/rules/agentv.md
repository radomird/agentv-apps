# AgenTV

This repo is `agentv-apps`: AgenTV's official apps, one folder each under `apps/`, and the signed app index built from them (ADR-036). It's public. AgenTV itself lives in `agentv-os`, whose app contract, contract runner and installer the checks here use, at the commit in `.github/agentv-os`.

The plan lives in `agentv-planning`: read its `HANDOFF.md` first, then the ADRs in `DECISION-RECORD.md` (ADR-010, ADR-032 and ADR-036 above all), then `PHASE-1-PLAN.md`, "App contract". The ADRs are decisions, so don't re-open one without asking Radomir. AgenTV's skills live in `agentv-os/.claude/skills/`; `agentv-copy` and `agentv-quality-gates` matter most here.

## Rules

- **An app is a folder** with `manifest.json`, its code and `fixtures/`. It imports the contract's types with `import type` from `.agentv-os/apps/contract/contract.ts` (`bin/fetch-agentv-os` puts agentv-os there) and imports nothing else from outside its folder.
- **No service automation.** Nothing here automates Disney+, Prime Video, Netflix or Spotify. The Disney+ adapter lives in the private `agentv-adapters` repo.
- **No passwords kept** (ADR-032). An app signs in on its service's own page, through AgenTV's sign-in screen, and reads what it needs from that page.
- **Fixtures are recorded,** from the service's own server in CI (`test/record/`), never made up. A page in `fixtures/pages/` is a stand-in for the service's web app, and its README says so. No sign-in material: tokens become `fixture-token`.
- **A changed app gets a newer version** in its manifest (`test/versions`), since the index lists each app at the last commit that changed it.
- **No secrets.** The index is signed in CI with the `AGENTV_SIGNING_KEY` secret, AgenTV's own key.
- **The owner name is never in code.** Scripts read it from GitHub's context or the clone's origin.
- **Copy** follows Omarchy's voice: plain words, "coming soon" for what isn't built, "Powered by Omarchy", and no em dashes anywhere.

## Before you commit

- Run `test/run`. A task isn't done until it's green.
- Commit with this repo's own git identity, and end the message with the Co-Authored-By trailer. Log progress in `agentv-planning`'s `LOG.md`.
