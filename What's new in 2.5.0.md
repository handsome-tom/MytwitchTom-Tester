# What's new in Twitch Space 2.5.0

**Streamer Buddy System is back in Twitch Space**, rebuilt so mods can look out for the streamer without getting in the way. Click the **handshake button** (in Twitch's top bar, right of the search box, or in the chat header) to open it in Chrome's side panel. The streamer uses it in OBS, with no extension needed on that side (see the guide).

## For mods (the side panel)

- **Streamer View.** The top of the panel shows what the streamer's OBS dock is showing right now: its glow colour, everything waiting there, answers not yet marked seen, and the notes in the streamer's bar. It follows the channel you're watching.
- **Simple Ask box.** One typing bar; pick **Ask**, **Quick info** or **!vanish** at its left. It starts with the streamer of the stream you're in. Questions are answered with ♥, ✓ or ✗, or a typed reply.
- **Nudge instead of a timer.** Every question arrives green. If it isn't answered, tap **Nudge**: orange, then yellow, then white, one soft beep each, at least 15 seconds apart.
- **Send the streamer a warning** when something needs attention right now (trouble in chat, a safety issue): tap Nudge six times quickly. It turns red on the streamer's screen with a louder double beep. It's a mod looking out for the streamer, not a mark against anyone. At most one every 30 seconds.
- **Slim lists, newest first.** Answers to your questions and messages to you are one line each; hovering one turns it into a glowing pill. Click an answer to mark it seen; messages have small ♥ ✓ ✗ or Seen buttons, a reply box only when you want it, and × to dismiss.
- **Status menu:** Online, Idle or Offline, picked from a small menu.
- **Flag a chat line:** point at a line in Twitch's chat and click the small flag. It goes to the streamer (with who said it and who flagged it) and glows in the chat of everyone connected with the streamer who's watching. The flag only shows on channels where you and the streamer have both connected.

## For the streamer (OBS chat dock)

- **A message area that doesn't badger.** What's waiting shows just under the bar, slightly larger, in a soft glow coloured by how urgent it is. With several, they take turns every 6 seconds, pausing while the mouse is over them or a reply is being typed; a small "2 of 5 ▾" chip drops down a short list.
- **One-tap answers:** ♥ ✓ ✗ (heart on the left), or a typed reply. No pop-out windows.
- **A glow that rests:** the edge glows for a couple of seconds, fades to almost nothing, and only comes back while a question is unanswered (after 15 seconds, then every 10).
- **Quick info and !vanish notes** take the full width like questions; !vanish notes bloom into a pink haze.
- **Who's in chat:** each mod's picture is ringed green, orange, yellow, then white by how recently they chatted; lit with no ring when they're quiet; gray once they've left.
- **Custom chat extras:** bookmark a message for later with its icon (the bookmark counter goes back to them), click a message to draw an orange "where I was" line, and lines a mod flags glow in the chat (their pin sits at the top for 10 seconds).
- **Settings gear:** sound, volume, reminder beeps, edge glow, the quick-questions row, custom or Twitch chat, chat text size, and whether to share Streamer View.

Everything else is as in 2.4.3. The side panel needs the **side panel** permission and access to handsome-tom.github.io again, so Chrome may ask when you reload the extension.
