# 한게임 틀린그림찾기 2인 협동

User approved this design on 2026-10-10 and explicitly instructed skipping further design/plan approval and continuing implementation, verification and GitHub Pages publication.

Preserve the original Flash game, its picture resources, artwork, sound and both minigames. Use a small AS2 bridge and the locally bundled Ruffle runtime. Publish a new public repository `honkaiDuelMAn/hangame-difference-coop` and its GitHub Pages site. Do not change synced sources or existing InuYasha repositories.

Reuse the InuYasha Pages manual WebRTC offer/answer links and locally generated QR codes, Cloudflare STUN, candidate quiet timeout and heartbeat handling. No game server, signaling server or TURN relay. Hosting only supplies static files.

The host serializes both players' requests. User steering on 2026-10-10 superseded unrestricted character choice: because only the boy/girl have original pencil cursors, fix 1P to boy and 2P to girl. Both connected players click their assigned character to become ready. Display those original pencil cursors, with the native pencil registration point at the actual click coordinate; the other cursor moves in real time. Player one finds use red circles, player two blue circles.

Both players share found differences, picture/stage selection, score, life, glasses and timers. Life/glasses requests share a 1000 ms cooldown, including button and keyboard requests, to prevent concurrent double spending. Shared effects and minigame rewards apply once. Minigame bullets belong to each player independently; spawning, enemies, kills and deadlines are shared. Repeated/outdated events cannot apply twice. Pause and disconnect stop both players' game progression. Session reset restores fresh cooperative state and character selection.

Run one original world in the host. Capture only its generated canvas and audio into the direct WebRTC connection; the guest displays that exact world rather than running another Flash timeline. Camera, microphone and desktop capture APIs are not used. Browser integration exposes `coopStart(character)`, `coopReset()`, `coopBeginAction(seat)`, `coopEndAction()`, `coopSnapshot()`, `coopShoot()` and `coopReload()`. Events flow through `window.coopEvent(kind, data)`. The gun updates use original cursor handlers with a readiness guard, so each click runs one original shot and preserves the original shared cooldown. Internal original-game fields are inspected only using a separate test probe and are not product controls.

Verify actual original Flash execution in two browser contexts, including duplicate character selection, same-target clicks, both resource types within 1000 ms, keyboard input, blue/red rings, moving cursors, transitions and minigame bullets. Verify the deployed static files and repeat a direct connection at the final Pages URL. State clearly that two contexts on this computer cannot establish connectivity across every remote network.
