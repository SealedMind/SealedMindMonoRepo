# sealedmind — Python SDK

Encrypted, capability-gated AI memory on 0G — Python edition.

```bash
pip install sealedmind
```

```python
import asyncio
from sealedmind import SealedMind

async def main():
    client = SealedMind(api_key="sm_...")  # get one at sealedmind.io/developer

    mind = await client.create_mind("my-agent")

    await client.remember(mind.id, content="user prefers vegetarian meals")

    result = await client.recall(mind.id, query="what does the user prefer to eat?")
    print(result.answer)
    print("attested in:", result.attestation.enclave)

    await client.aclose()

asyncio.run(main())
```

Or just hit the TEE inference gateway directly (no Mind needed):

```python
from sealedmind import SealedMind

client = SealedMind(api_key="sm_...")
content, att = await client.chat(
    [{"role": "user", "content": "Summarize the patient's recent activity"}]
)
print(content)
print(att.chat_id, att.verified, att.enclave)
```

## Endpoints exposed

| Method | What it wraps |
|---|---|
| `client.create_mind(name)` | `POST /v1/minds` |
| `client.list_minds()` | `GET /v1/minds` |
| `client.get_mind(id)` | `GET /v1/minds/:id` |
| `client.remember(id, content=...)` | `POST /v1/minds/:id/remember` |
| `client.recall(id, query=...)` | `POST /v1/minds/:id/recall` |
| `client.grant_capability(id, ...)` | `POST /v1/minds/:id/capabilities` |
| `client.list_capabilities(id)` | `GET  /v1/minds/:id/capabilities` |
| `client.revoke_capability(id, capId)` | `DELETE /v1/minds/:id/capabilities/:capId` |
| `client.audit_log(id)` | `GET /v1/minds/:id/audit` |
| `client.chat(messages)` | `POST /v1/inference/chat` |
| `client.verify_attestation(chatId)` | `POST /v1/attestations/verify` |

## Already on 0G Memory?

Use the addon instead — drop-in for `KVStorageInterface`:

```bash
pip install evermemos-sealedmind
export MEMSYS_ENTRYPOINTS_FILTER=core,sealedmind
export KV_STORAGE_TYPE=sealedmind
```

## Auth

Get an API key:
1. Visit `sealedmind.io/developer`
2. Connect your wallet, sign a SIWE message
3. Copy the `sm_*` key
4. Pass it to `SealedMind(api_key=...)` or set `SEALEDMIND_API_KEY` env var

## License

MIT — see the monorepo at https://github.com/SealedMind/SealedMindMonoRepo
