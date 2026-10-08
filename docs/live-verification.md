# Live verification

Status: pending. Automated tests use adapters for Foundry document APIs.

On Foundry v12.343 with Cyberpunk RED and libWrapper:

- Start a GM world. Confirm all three tools register and document-type-specific SceneTools folders appear.
- Import one original Scene export without edits, then with overrides and overlay tiles. Inspect saved walls, lighting, flags, grid and asset paths; reload the world and confirm persistence.
- Import several static/animated variants sharing JSONs. Confirm one Scene per selection. Cause an unavailable asset/read failure, cancel preparation, reopen, and retry.
- In a disposable world, interrupt a save. Inspect completed and incomplete Scenes before retrying. Network loss or browser termination cannot guarantee client cleanup.
- Open two MookMaker windows for one unlinked token. Attempt overlapping Apply/Purge/Promote actions. Confirm rejection of conflicting writes, correct ActorDelta changes, promotion linkage, and unchanged template Actors.
- Move and rename a current default template; empty its inventory deliberately. Reload and confirm no replacement or reset.
- Open Scanner with many Actors and Scenes. Move an AP/runner, update unrelated HP, and check relevant rows refresh without constant full-panel rebuilding.
- Connect a GM and two players. Verify private AP visibility, pulses, and native Scanner roll integration. Operation guards are client-local; concurrent writes from different GMs are not serialized.

Record Foundry/system versions and outcomes before marking live compatibility verified.
