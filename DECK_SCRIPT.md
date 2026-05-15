# SealedMind — Deck Speaking Script

> Live narration script for the 15-slide `/deck` recording.
> Read aloud while pressing `→` between slides. Total target: ~8 minutes.
>
> **Setup before recording:**
> 1. Open `https://sealedmind.vercel.app/deck` in Chrome
> 2. Press **F11** for browser fullscreen, then **F** inside the deck
> 3. Wait 4 seconds for the cursor to auto-hide
> 4. Press **1** (Home) to reset to slide 1
> 5. Take a breath, hit record, start speaking

---

## SLIDE 01 · HERO — *~25 sec*

> **SealedMind. Your AI's lifetime memory — encrypted, permanent, transferable.**
>
> We're live on 0G mainnet today. Eight contracts deployed and source-verified. Three SDKs published. An architecture that actually works under real adversaries. Let me show you why we built this — and what it unlocks for every AI agent that needs memory.

`[ → NEXT ]`

---

## SLIDE 02 · PROBLEM — *~50 sec*

> Every useful AI agent gets smarter with memory. But today that memory is broken in three ways.
>
> **One — AI has no persistent memory.** Every conversation starts from zero. You explain yourself to ChatGPT, then to Claude, then to your company's internal AI. There is no standard way for an agent to remember you across sessions.
>
> **Two — when AI does remember, you don't own it.** Your ChatGPT history belongs to OpenAI's servers. You can't take it with you. You can't sell it. You can't will it to your kid.
>
> **Three — zero privacy, zero proof.** "We don't read your data" is a policy, not math. There is no cryptographic receipt that the LLM ever processed your data inside a sealed environment.

`[ → NEXT ]`

---

## SLIDE 03 · WHY NOW — *~40 sec*

> For years this couldn't be fixed because two primitives didn't exist. Both shipped in the last eighteen months.
>
> **One.** ERC-7857 — the standard for AI agent identity as a transferable iNFT — landed in 2025.
>
> **Two.** Intel TDX with NVIDIA H100 confidential GPUs went into production data centers in 2024. 0G's Sealed Inference exposes them with signed attestations.
>
> Memory ownership and hardware-attested inference. Both finally exist. SealedMind composes them.

`[ → NEXT ]`

---

## SLIDE 04 · THREE PILLARS — *~45 sec*

> SealedMind is three things at once.
>
> **Sealed.** Every memory is AES-256-GCM encrypted under a key derived from your wallet signature. We are mathematically blind to your plaintext. Not even with a court order.
>
> **Portable.** Your Mind is an ERC-7857 iNFT. Sell it, lease it, inherit it. Switch from Claude to GPT to your company's internal LLM — your memory follows you.
>
> **Provable.** Every recall runs Qwen 2.5 7B inside Intel TDX with H100 GPU pass-through. Signed TEE attestation per query. On-chain MemoryAccessLog for every read and write. Math, not promises.

`[ → NEXT ]`

---

## SLIDE 05 · THREE OPERATIONS — *~50 sec*

> That's the whole API. Three calls.
>
> **Remember** distills a fact via two-pass extraction, AES-256-GCM encrypts it under your wallet key, uploads ciphertext to 0G Storage, and emits an on-chain audit log.
>
> **Recall** does vector search across your encrypted index, sends the top matches to a TEE-attested LLM, and returns a signed answer.
>
> **Grant** issues an on-chain capability — time-bound, scope-limited, revocable in a single transaction.
>
> The killer detail: every operation now returns a chainscan-clickable proof. The Verify Proof button isn't a checkmark. It's a link to the on-chain transaction.

`[ → NEXT ]`

---

## SLIDE 06 · ARCHITECTURE — *~50 sec*

> Six trust boundaries. Eight contracts. Zero hand-waving.
>
> Your wallet holds the master key. Your browser derives per-mind keys via HKDF. The backend cannot read your plaintext — by design. 0G Storage holds only ciphertext. The TEE enclave processes prompts with remote attestation, returning signed receipts. The 0G chain holds your iNFT, your capabilities, and your access log.
>
> Every node here is deployed. Every line is a flow that runs in production. Click any contract on chainscan — you'll see verified source code.

`[ → NEXT ]`

---

## SLIDE 07 · THREAT MODEL — *~50 sec*

> For every realistic adversary, we point to a specific math primitive that defeats them.
>
> Honest-but-curious operator? Sees ciphertext, can't decrypt.
>
> Malicious storage node? Same — opaque blobs.
>
> Compromised inference host? Sees nothing — sealed in TDX, attested.
>
> Capability bearer over-using their access? One on-chain revocation. Instant 403.
>
> Operator's wallet stolen? It's just a relayer — can't decrypt anything.
>
> User's wallet stolen? Out of scope, but we revoke shared capabilities the moment they notice.
>
> Six adversaries. Six receipts.

`[ → NEXT ]`

---

## SLIDE 08 · 0G STACK — *~40 sec*

> SealedMind couldn't be built anywhere else. Every layer of the 0G stack is load-bearing.
>
> **Storage** holds the encrypted blobs — fast enough for real-time writes.
>
> **Compute** runs Qwen 2.5 inside Intel TDX with H100 pass-through. Signed attestation per call.
>
> **Chain** settles the iNFT, the capability registry, and the access log.
>
> Try doing this on Ethereum and AWS. You'll spend six months stitching together trust boundaries that 0G already collapsed into one stack.

`[ → NEXT ]`

---

## SLIDE 09 · WHAT'S SHIPPED — *~45 sec*

> Ten things shipped — all on chain, all public, all auditable.
>
> Eight contracts source-verified on mainnet AND testnet. MemoryAccessLog wired end-to-end with chainscan-clickable proofs. TEE inference live. Three SDKs published — TypeScript on npm, Python on PyPI, drop-in addon for 0G Memory also on PyPI. A live two-agent demo. The architecture page. A scriptable CLI. Eighty-one tests across four suites.
>
> Mainnet contract addresses on the right. Click any one — verified source on chainscan.

`[ → NEXT ]`

---

## SLIDE 10 · USE CASES — *~45 sec*

> SealedMind is infrastructure. It works in any vertical where memory ownership matters.
>
> Healthcare: grant a specialist's AI temporary access to your health shard. Revoke when the appointment is over. Audit log proves what they read.
>
> Finance: your advisor reads your finance shard. Switch fintech apps without losing context.
>
> Legal: privileged data inside a TEE, with a cryptographic receipt.
>
> Education: a learning profile that grows with you for thirty years.
>
> Enterprise: agent-to-agent delegation with on-chain audit.
>
> Personal AI: a companion that genuinely knows you.
>
> Same three calls. Six verticals. Infinite apps.

`[ → NEXT ]`

---

## SLIDE 11 · COLLABORATIONS — *~45 sec*

> SealedMind is the memory layer in **both** Daimon and VeilSolver.
>
> **Daimon** built tradeable AI trading agents. Each agent's brain is a SealedMind iNFT. Marketplace contract live on Galileo and 0G mainnet right now. Their entire product depends on our primitive.
>
> **VeilSolver** is the MEV-resistant intent solver. They moved their bespoke encrypted-storage layer onto SealedMind SDK calls. Joint integration guide published in our repo.
>
> Three projects, one stack, composed on 0G. We didn't ship alone — we shipped the foundation.

`[ → NEXT ]`

---

## SLIDE 12 · BUSINESS MODEL — *~55 sec*

> Four revenue streams. Real path to a million ARR.
>
> **One — metered API.** Stripe Metered Billing wired to our API keys. Three-tenths of a cent per remember call. Sixty to seventy percent gross margin at scale.
>
> **Two — subscriptions.** Hobby is free. Builder twenty-nine. Team one-forty-nine. Enterprise two thousand and up.
>
> **Three — compliance premium. This is the moat.** Attestation certificate exports, audit log exports, HIPAA Business Associate Agreements. A healthcare AI startup blocked from a hospital deal will pay two thousand a month to unblock something worth two hundred thousand a year.
>
> **Four — self-host licenses.** Twenty-five to one-hundred-fifty K a year for regulated buyers who can't touch SaaS.
>
> LTV-to-CAC of thirteen-x, ten-x, seven-and-a-half-x across the three buyer segments.

`[ → NEXT ]`

---

## SLIDE 13 · TRACTION — *~40 sec*

> Live, on chain, being composed on. Not vapor.
>
> Three public X threads documenting the launch. Three SDKs on npm and PyPI. Daimon — the first non-team builder — shipping on top of us. VeilSolver — paired primitive — joint integration. Every memory operation emits an on-chain audit log on 0G, growing daily.
>
> And — this matters — we have been at every 0G builder showcase and every builder meet from day one of the program. We're not flying in for a hackathon. We're part of the ecosystem.

`[ → NEXT ]`

---

## SLIDE 14 · ROADMAP — *~40 sec*

> Twelve months from primitive to platform.
>
> Phase one — billing live in four weeks. Stripe metered, plan pages on the developer portal.
>
> Phase two — developer growth across the 0G ecosystem and adjacent agent communities. Five to fifteen K MRR.
>
> Phase three — compliance pipeline. Three to ten enterprise pilots in healthcare, finance, and legal. HIPAA template drafted, SOC 2 Type One started.
>
> Phase four — first self-host license to a healthcare or financial institution.
>
> Conservative end-of-year-one: half a million ARR. Aggressive: a million.

`[ → NEXT ]`

---

## SLIDE 15 · CLOSING — *~30 sec*

> We didn't build an app. We built the **memory primitive** that every AI agent will need.
>
> Encrypted under your wallet key. Attested by Intel TDX. Logged on 0G chain. Owned by you forever.
>
> Two QR codes — site and source. Scan either one and you'll be on chainscan within thirty seconds, looking at our live mainnet contracts.
>
> SealedMind. Thank you.

`[ STOP RECORDING ]`

---

## Recording tips

- **Pace:** ~140 words per minute is comfortable. The script above is ~1,250 words → roughly 9 minutes.
- **Pause for slide transitions.** Each `→` press takes ~520ms. Hit it on a sentence break, then wait one beat before continuing.
- **Don't read the slide.** Use the slide as your visual anchor; the script delivers the *story* the slide can't convey.
- **One take is fine.** If you stumble, keep going — judges value energy over perfection.
- **Watch the cursor.** It auto-hides after 3 seconds. If you accidentally move the mouse, wait for it to disappear before pressing the next arrow key.

## If you need a shorter version

For a **5-minute pitch**, cut these slides and keep the others:
- Skip slide 7 (Threat model) — fold its strongest line into slide 6
- Skip slide 8 (0G stack) — folded into slide 6
- Skip slide 14 (Roadmap) — fold into slide 12

That gives you 12 slides at the same per-slide pacing → ~6 min including transitions.
