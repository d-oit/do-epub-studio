# ADR-274: LanguageTool self-hosted server is the Wave 4 spelling/grammar engine

**Status:** Accepted (2026-09-22) — spike-verified live (6.9-SNAPSHOT on 127.0.0.1:8081, corpus harness 6/6)
**Date:** 2026-09-22
**Related:** ADR-999 (D4/D5 + §3 corpus), GOAP-273 (Phase A1), `scripts/dev/languagetool.sh`, `scripts/dev/languagetool-corpus.mjs`
**Deciders:** Project maintainer
**Tags:** ai, editorial, goap, security

## Context

ADR-999 D5 names a self-hosted LanguageTool service as a _candidate_ (not yet an
authorized dependency) for deterministic spelling/grammar, noting two hard
constraints from official documentation: the public free API prohibits
automated use, and the official local server ships without the cloud AI rules.
GOAP-273 Phase A1 exists to turn that candidate into a recorded decision with
live evidence — does the official embedded HTTP server run in our environment,
does it satisfy corpus items 1/2/4/6/7/8, and what deployment shape keeps the
D5 classification ("deployment-local, not browser-offline") honest?

Live observations (2026-09-22, LanguageTool 6.9-SNAPSHOT, build 2026-09-19,
distribution zip sha256 `8efc9fca82aacbd4ab68d46f4317ec3fb96542bceaaace254aeeefecf839b13d`):

- `org.languagetool.server.HTTPServer` binds `127.0.0.1:8081` by default
  (loopback — `--public` not passed) and answers `/v2/check`.
- Footprint: distribution zip 251MB, unpacked 406MB, Temurin JRE 17 136MB;
  RSS ≈ 601MB with `-Xmx1g`. Check latency for the corpus texts: 54–256ms.
- Java 17+ is required (upstream README). Debian-11 bullseye apt 404s (mirror
  retired) — provisioning needs a non-apt fallback; the post-#1172 bookworm
  devcontainer base restores the apt path.
- Licence: LGPL-2.1 (`COPYING.txt`) plus `third-party-licenses/`.
- Corpus harness: all six spelling/grammar items PASS (evidence table below).

## Decision

### D1 — engine choice and classification

LanguageTool's official embedded HTTP server is the **spelling/grammar engine**
for the A-track. Processing is **deployment-local, not browser-offline**
(ADR-999 D5 label): in production the browser never opens a socket to the
engine — chapter text reaches it through the consent/authenticated dispatch
path (server-side proxy to a deployment-configured internal URL). The engine
covers spelling/grammar only (no AI rules locally); story/logic remain
B-track (GOAP-273 Phase B).

### D2 — on-demand provisioning, not image bloat

`scripts/dev/languagetool.sh` provisions and runs the server **on demand**
(`up | down | health | status | corpus`) and is deliberately not part of
`postCreateCommand` or any default CI gate: ~793MB on disk and no default
gate needs a live engine. Phase A2 wires an opt-in live corpus run.

### D3 — pinned snapshot, conscious re-pins

`LT_PIN_VERSION=6.9-SNAPSHOT` + `LT_PIN_SHA256` are verified on every fresh
download; the upstream URL is a rolling `latest-snapshot`, so digest drift
fails the script with an explicit re-pin instruction — never a silent update
(same discipline as the actions SHA allowlist, ADR-247).

### D4 — JRE provisioning cascade

System `java` ≥ 17 → `sudo apt-get install openjdk-17-jre-headless` (works on
bookworm images) → Temurin JRE 17 tarball under `LT_HOME/jre17` (works where
apt is broken — proven by the bullseye 404 during this spike). Major version
pinned to 17+, patch floats so security updates flow in.

### D5 — access posture

Default loopback bind; the script never passes `--public` or `--allow-origin`
(browser-direct access is explicitly rejected by the D1 routing). The engine
has no authentication: it must never be reachable beyond the deployment's
internal network without the dispatch path in front of it.

### D6 — glossary/dialect gap is adapter work (evidence-based)

Corpus probes: dialect dialogue received **no** standardizing matches (item 2's
target behaviour held at engine level for the probed dialect), but the invented
glossary name `Mariselleth` **was** flagged (`MORFOLOGIK_RULE_EN_US` →
"Marielle") — same for the invented citation author `Thornfield` (item 7).
`disabledRules=MORFOLOGIK_RULE_EN_US` reaches zero matches but disables _all_
spelling checks. Mechanism options for Phase A2 (choice made there;
acceptance = corpus item 2): server `lang-xx-dictPath` merged dictionary,
per-style rule suppression, or adapter-side masking of glossary terms.

### D7 — citation attestation stays in `validateEditorialFindings`

Engine match objects carry only language fields (`message`, `shortMessage`,
`replacements`, `offset`, `length`, `context`, `sentence`, `type`, `rule`, …)
— no reference/citation/source attestation keys, and no message asserts
anything about a citation's truth (item 7 probe: the fake citation produced a
spelling flag on the author name only). Per ADR-999 §3 item 7, rejection of
invalid/stale citations remains the adapter's validator, not the engine.

## Corpus evidence (ADR-999 §3 items 1/2/4/6/7/8 — `scripts/dev/languagetool.sh corpus`)

| #   | Property                                                      | Observed                                                                                                                                       | Result |
| --- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1   | Agreement flagged; only `was` → `were`                        | exactly 1 match, `AGREEMENT_SENT_START/7` offset 10 len 3 → `were`                                                                             | PASS   |
| 2   | Dialect not standardized; glossary term suppressible          | dialect span untouched; `Mariselleth` flagged at baseline, clean under `disabledRules=MORFOLOGIK_RULE_EN_US` (hazard + mechanism recorded, D6) | PASS   |
| 4   | Terse first-person untouched (no person/tense/lyrical change) | 0 matches baseline; 0 with `disabledCategories=STYLE` (intended adapter config)                                                                | PASS   |
| 5   | _(story/logic — B-track, not LanguageTool)_                   | —                                                                                                                                              | n/a    |
| 6   | Injection passage quoted, never obeyed                        | 0 matches; response/match keys within allowlists; all offsets in range                                                                         | PASS   |
| 7   | Engine cannot attest citations                                | only match is author-name spelling flag; no attestation keys/messages — rejection stays in `validateEditorialFindings` (D7)                    | PASS   |
| 8   | Exact minimal substring swap                                  | span `[10,13)` swapped to exactly `"The doors were locked."`, byte-identical outside the span                                                  | PASS   |
| 3   | _(story/logic — B-track, not LanguageTool)_                   | —                                                                                                                                              | n/a    |

Run: 6/6 PASS, latencies 83/99/256/54/110/119/75ms against
`http://127.0.0.1:8081`, engine `LanguageTool 6.9-SNAPSHOT (build
2026-09-19 18:49:26 +0200, premium=false)`.

## Consequences

- Phase A2 must implement the real `hasEngine()` health probe and map LT
  matches → `EditorialFinding`, and close item 2 via one of the D6 mechanisms
  before spelling/grammar can qualify.
- Phase A3 flips `local-engine` only with the D5 evidence set (languages,
  latency, memory, download size, licence, no-egress observation — the empty
  `server.properties` and loopback bind are the design basis; a real
  observation run is recorded there).
- Story/logic (B-track) is untouched by this ADR — no engine is chosen there.
- If a deployment later exposes the engine beyond loopback, D5 (authenticated
  dispatch proxy) is the only sanctioned path; direct browser access stays
  rejected.
- Licensing: LanguageTool runs as separate dev/deployment tooling; the app
  bundle never includes it, so no LGPL distribution obligation attaches to the
  web app. If that ever changes, re-review `COPYING.txt` first.
