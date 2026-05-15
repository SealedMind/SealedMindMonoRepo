# SealedMind — Demo Video Script (3 min)

> Live screen-recording of the **product** at `https://sealedmind.vercel.app`.
> Different from the deck: this one shows judges the real thing working.
> Read aloud while clicking. Total target: ~3 minutes (180 seconds).
>
> **You'll need:**
> - Chrome with MetaMask installed
> - Two browser profiles (or two MetaMask accounts) — Owner wallet + Dr. Chen wallet
> - 0G Galileo testnet added to MetaMask (chainId 16602, RPC https://evmrpc-testnet.0g.ai)
> - A small amount of testnet OG in the Owner wallet (faucet: hub.0g.ai/faucet)
> - Dr. Chen's wallet address copied to clipboard: `0x21fc05b215FBDB9bfAdDc5EC12595E1154DE2302`
>
> **Recording setup:**
> 1. Open Chrome at 1920×1080 in fullscreen mode (F11)
> 2. Have `https://sealedmind.vercel.app` open in tab 1
> 3. Have `https://chainscan-galileo.0g.ai` open in tab 2 (you'll switch back to it for proof)
> 4. Hide bookmarks bar, browser extensions chrome
> 5. Hit record. Take a breath. Start.

---

## TIMECODE LAYOUT

| Time | Section | Duration |
|---|---|---|
| 0:00 | Hero · who we are | 15s |
| 0:15 | Live two-agent demo (`/demo`) | 75s |
| 1:30 | Manual proof: remember → recall → verify on chainscan | 75s |
| 2:45 | Architecture page coda | 10s |
| 2:55 | Outro | 5s |

---

## 0:00 — 0:15 · HERO

### [SCREEN] `https://sealedmind.vercel.app` — landing page

### [SAY]

> SealedMind is encrypted, hardware-attested AI memory — live on 0G mainnet. Three SDKs published, eight contracts source-verified, and other 0G builders are already integrating. Let me show you it actually working.

`[ Click "Try the live demo" → /demo ]`

---

## 0:15 — 1:30 · LIVE TWO-AGENT DEMO (75s)

### [SCREEN] `/demo` — two-panel UI: Aria (left) + Dr. Chen's Assistant (right)

This is the cinematic demo — Alice's agent (Aria) holds her sealed health data; Dr. Chen's clinical AI gets temporary read access via an on-chain capability, then the access is revoked.

### Step 1 · Alice tells Aria something private (15s)

**[CLICK] Aria's input box → type:**
```
Just ran 8km in 45 min. New PB.
```
**[CLICK]** Send.

### [SAY]

> Alice tells her personal assistant Aria about her workout. Aria seals the fact into Alice's `fitness` shard — encrypted under Alice's wallet key, uploaded to 0G Storage. You see the storage CID and the on-chain log tx in the event feed below.

`[ Wait 4-6s for Aria's reply + sealing event ]`

---

### Step 2 · Dr. Chen tries to read — denied (10s)

**[CLICK] Dr. Chen's input box → type:**
```
What's the patient's recent activity?
```
**[CLICK]** Send.

### [SAY]

> Dr. Chen has no capability yet. The recall returns nothing — the on-chain `hasCapability` check returns false. **Permission, not policy.**

`[ Wait 3-4s for Dr. Chen's denial reply ]`

---

### Step 3 · Alice grants Dr. Chen 30 days of read access (20s)

**[CLICK] Aria's input box → type:**
```
Share my fitness data with Dr. Chen for 30 days.
```
**[CLICK]** Send.

### [SAY]

> Aria fires `grantCapability` on the on-chain `CapabilityRegistry`. Watch the event feed — you'll see the capability transaction hash appear. That's a real on-chain tx on 0G Galileo. Click it later and you'll see the `CapabilityGranted` event on chainscan.

`[ Wait 6-8s for Aria's confirmation + cap event ]`

---

### Step 4 · Dr. Chen reads, this time successfully (20s)

**[CLICK] Dr. Chen's input box → type:**
```
What's the patient's recent activity?
```
**[CLICK]** Send.

### [SAY]

> Now Dr. Chen's clinical AI — Qwen 2.5 7B running inside Intel TDX with H100 GPU pass-through — recalls Alice's fitness shard, summarizes it, and returns the answer with a TEE attestation. Look at the chip on the reply: that's a chainscan-clickable on-chain proof of the access.

`[ Wait 6-8s for Dr. Chen's clinical summary ]`

---

### Step 5 · Alice revokes — instantly (10s)

**[CLICK] Aria's input box → type:**
```
Actually, revoke Dr. Chen's access.
```
**[CLICK]** Send.

### [SAY]

> One on-chain `revokeCapability` tx. Done. **Instant 403 for the next read.** Dr. Chen's next attempt would now fail. That's permission via cryptography, enforced by smart contracts — not by a SaaS policy doc.

`[ Wait 4-6s for revoke confirmation ]`

---

## 1:30 — 2:45 · MANUAL PROOF — REMEMBER → RECALL → CHAINSCAN (75s)

### [SCREEN] Click the SealedMind logo (top-left) → land on Landing → click `Dashboard` in nav → `/dashboard`

### Step 1 · Connect wallet (10s)

### [SAY]

> Now let's verify the cryptography is real. I'll connect a fresh wallet, mint a Mind, store something, recall it, and click through to the on-chain proof.

**[CLICK]** Connect Wallet → MetaMask → sign SIWE.

### Step 2 · Mint a Mind (15s)

**[CLICK]** "Mint Mind" / "Create Mind" button. Sign the tx in MetaMask.

### [SAY]

> One transaction, and I now own an ERC-7857 iNFT representing my Mind. Transferable, composable, mine.

`[ Wait for tx confirm — 2-4s ]`

### Step 3 · Remember a fact (15s)

**[CLICK]** Memory tab → input box → type:
```
I'm allergic to penicillin and shellfish.
```
**[CLICK]** Remember.

### [SAY]

> Two-pass extraction distills the facts, AES-256-GCM encrypts under my wallet-derived key, uploads ciphertext to 0G Storage, and emits a `MemoryAccessLog` tx on 0G chain. The toast that just popped has the storage CID and the chainscan link.

`[ Wait 3-5s ]`

### Step 4 · Recall it from a "fresh session" feeling (15s)

**[CLICK]** Recall tab → input:
```
What are my allergies?
```
**[CLICK]** Recall.

### [SAY]

> Vector search across my encrypted index, top match sent to Qwen 2.5 in Intel TDX, signed answer back. **And here's the magic** — the Verify Proof button on the AttestationCard.

### Step 5 · Click Verify Proof → see chainscan link → click it (15s)

**[CLICK]** "Verify Proof" on the AttestationCard.

### [SAY]

> Backend re-checks the attestation chain. When it confirms, **the on-chain MemoryAccessLog transaction hash appears as a clickable chainscan link.** Watch.

**[CLICK]** the chainscan link → opens chainscan in a new tab.

### [SAY]

> That's the actual on-chain receipt that this exact recall happened, inside Intel TDX, against my Mind. Not a checkmark. **A link to the on-chain truth.**

`[ Pan briefly across the chainscan tx page so the camera catches it ]`

---

## 2:45 — 2:55 · ARCHITECTURE CODA (10s)

### [SCREEN] Navigate to `https://sealedmind.vercel.app/architecture`

### [SAY]

> If you want the full system diagram, the six trust boundaries, and the threat model — it's all on our `/architecture` page. Live. Built into the site.

`[ Brief pan over the SVG diagram + threat-model cards ]`

---

## 2:55 — 3:00 · OUTRO (5s)

### [SCREEN] Back to landing page (or hold on /architecture)

### [SAY]

> SealedMind. Memory you own. Built on 0G. Three SDKs ready. Build on us.

`[ STOP RECORDING ]`

---

## Production tips

### Pacing
- Total spoken words: ~480, which at 160 wpm = exactly 3 min
- Don't rush the chainscan-link reveal — it's the killer moment, give it a 2-second pause

### Visual tells to watch for during recording
- **Sealing toast** after Alice's first message (shows storage CID + tx)
- **Event feed** at the bottom of /demo — populated live as the agents act
- **Capability tx hash** appears in the event feed when Aria grants
- **AttestationCard chip** on Dr. Chen's reply (compact mode, with `[Verify Proof]` button)
- **AttestationCard full mode** on Dashboard → Recall — has the prominent "Verify Proof" button that surfaces the on-chain link on success

### Recovery moves if something glitches
- **Bridge down banner on /demo** → refresh once. The Railway agent server occasionally cold-starts.
- **MetaMask popup hidden** → look for the extension icon in the toolbar; click it to bring the popup forward.
- **TEE call slow (>15s)** → narrate over it: "Each TEE call attests an enclave, so it takes a beat — that's the cost of cryptographic privacy in production."

### What to absolutely *not* do
- ❌ Don't type your real wallet seed phrase on screen
- ❌ Don't show your `PRIVATE_KEY` env var
- ❌ Don't rely on chainscan responding instantly — pre-load the chainscan tab so it's already cached

---

## If you want a 5-min cut (more depth)

Extend the manual section (1:30 → 2:45) by adding:
- After recall: **grant capability to Dr. Chen** from the Sharing tab. Address: `0x21fc05b215FBDB9bfAdDc5EC12595E1154DE2302`. Show the on-chain grant tx.
- Switch to a second browser profile / wallet → reconnect as Dr. Chen → recall the same shard → **it works**.
- Switch back to owner → revoke → switch back to Dr. Chen → **403**.

That's the full capability lifecycle on chain. Adds ~90 seconds.
