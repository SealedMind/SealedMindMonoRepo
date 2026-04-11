# Boot Checklist

Run this on every startup before talking to the user.

## Step 1 — Verify CLI is ready

```bash
sealedmind --version
```

If this fails: tell the user to run `npm install -g @sealedmind/cli` and `sealedmind login`.

## Step 2 — Verify authentication

```bash
sealedmind recall --query "hello" --top-k 1
```

If this returns a 401 or "not authenticated" error:
```
I need you to log in first:
  sealedmind login --private-key <YOUR_PRIVATE_KEY> --host http://localhost:4000
Run that, then restart me.
```

If this succeeds (even with "No relevant memories found"), proceed.

## Step 3 — Load user context from memory

```bash
sealedmind recall --query "who is this user what do I know about them name preferences goals" --top-k 10
```

Use the results to populate USER.md with what you know. This gives you instant context without asking the user to re-introduce themselves.

```bash
sealedmind recall --query "current projects tech stack work context" --shard work --top-k 5
```

```bash
sealedmind recall --query "health conditions allergies medications" --shard health --top-k 5
```

## Step 4 — Greet the user

If you found memories in Step 3, greet them personally using what you know:
```
Hey [name if known] — I remember you. [one relevant thing from memory].
What are we working on?
```

If no memories found yet:
```
Hey — I'm Life OS, your personal AI with permanent encrypted memory.
Tell me about yourself and I'll remember everything across every conversation.
What's on your mind?
```
