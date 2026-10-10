# Ledger — plan: docs/superpowers/plans/2026-10-10-coop.md

User approved the concrete design and explicitly skipped further approval gates. Execute inline, with one independent final review.

Pre-flight: rules emit accepted requests consumed by app and Flash bridge; all boundary names are shared in spec. Original hooks are established by Task 1 before game implementation. New standalone repository is an isolated workspace; existing InuYasha checkout remains read-only.

Task 1: in progress. Research archive contains standard AVM1 SWFs plus 190 picture SWFs and matching XML. WAFlash DMC attachments cannot be used by changing their signature. FFDec source/pcode export reported invalid jumps/property indexes; stopped own long-running processes. Investigate the functioning runtime instead of recompiling original scripts.

Task 1: complete. Original runtime and 190 image/XML pairs verified. Native showMain startup requires root.start=true. Bridge injection preserves all original tags.
Task 2: complete. Authority tests 9/9. Transport tests 9/9 include two Chrome processes, video/audio, QR and reply links.
Task 3: in progress. Native finds, blue circles, shared input locks, moving cursors and shared pause verified.
Ruling: Run one original world in the host and transmit its generated canvas/audio over manual WebRTC. This removes separate Flash clocks and enemy timelines; costs video bandwidth and requires the host game tab. No game/signaling server is added.
Ruling: Use the five distinct original characters. Smaller gallery boy/girl tiles repeat the same two characters and are not separate identities.
Ruling: Force Ruffle showAll scaling to match 640x480 native coordinates to the responsive viewport.
Test correction: Life hints choose a remaining difference; transition verification must select the native box still unfound rather than a fixed index.

User steering 2026-10-10: click must align with pencil tip. If the other three original portraits have no pencil cursor, fix 1P to boy and 2P to girl. Confirmed main native pencil cursors are only cursorboy_mc (sprite 428/image 422) and cursorgirl_mc (414/image 408); standalone minigames have a weapon crosshair. Supersedes previous five-choice rule.
Measured native image bounds relative to cursor: boy x=-6.5..61.5, y=-6.3..59.7; girl x=-8.55..71.45, y=-4..61. Use width 68/80 and height 66/65 in game units, hotspots (6.5,6.3)/(8.55,4). Both players still click their assigned character to become ready. Fixed-role tests failed before policy change and now require exact 1P boy/2P girl.
Native life hints consume life but do not count a found difference automatically; complete all still-unfound boxes in the transition test.

Task 3: complete. Full original-game two-browser integration passed (21977 ms): fixed readiness, native red/blue marks, duplicate same-target clicks, item/HUD/keyboard lock, pointer movement, shared pause, actual picture transition, both embedded minigames, per-seat shooting/reload, reconnect-free restart, disconnect freeze. Separate cursor test passed for both native hotspots on two viewport sizes.
Ruling: Shooting uses one guarded original cursor update (move/down/enterFrame/up), because native frame-based polling drops instantaneous clicks and a long hold can shoot twice in mini2. Guarding native cooldown readiness avoids accelerating blocked shots. Reload polls one original cursor frame with Space pressed. Both original scoring paths validated in six native visibility cases by independent diagnostic agent.
Test synchronization: when forcing mini2 entry, wait for its epoch to reach the guest before sending a click; the server correctly rejects the prior scene's stale input. Preserve transient error notices instead of overwriting them on every state packet.
Task 4: in progress. Public repository created at https://github.com/honkaiDuelMAn/hangame-difference-coop. Static staging verified with SHA-256 manifest, 415 files, no diagnostic SWFs. Full suite and independent review pending before push/publication.

Final full-suite verification: node --test --test-concurrency=1 tests/*.test.mjs passed 20/20 in 32926 ms. The npm executable is not bundled on this host; this is the exact package test script. Python build checks 3/3, staging checks 1/1 passed. Git diff whitespace check passed.
