// The side panel (hub.html): Streamer Buddy System's page in a frame, the same
// page the streamer uses in OBS, so both sides always match and it updates
// itself from GitHub.
//
// Signing in: Twitch's sign-in page won't open inside a frame, so when the hub
// asks ("hub-signin"), this opens it in a small window, picks the sign-in out of
// the address Twitch sends that window back to (the hub's own address, after
// "#"), closes the window and hands the sign-in to the hub ("hub-token").
const HUB = "https://handsome-tom.github.io/streamer-buddy-system/";
const HUB_ORIGIN = new URL(HUB).origin;
const CLIENT_ID = "v6pt264d6puelgyjk5nqbph90j25zz";

const frame = document.getElementById("hub");
frame.src = `${HUB}?embed=ext`;

addEventListener("message", (e) => {
  if (e.origin !== HUB_ORIGIN || e.source !== frame.contentWindow) return;
  if (e.data?.t === "hub-signin") signIn();
  // The hub's sign-in, for flagging chat lines from Twitch's page (background.js).
  if (e.data?.t === "hub-signed-in") {
    if (e.data.token) chrome.storage.local.set({ hubToken: e.data.token });
    else chrome.storage.local.remove("hubToken");
  }
});

async function signIn() {
  const state = crypto.randomUUID();
  // Who you are, plus your channel's mods and the channels you mod (Streamer Buddy System
  // fills its "Your mods" and "Channels I mod" groups from them). Nothing else.
  const q = new URLSearchParams({ response_type: "token", client_id: CLIENT_ID, redirect_uri: HUB, scope: "moderation:read user:read:moderated_channels", state });
  const win = await chrome.windows.create({ url: `https://id.twitch.tv/oauth2/authorize?${q}`, type: "popup", width: 520, height: 760 });
  const tabId = win.tabs[0].id;
  const watch = (id, change) => {
    if (id !== tabId || !change.url?.startsWith(HUB)) return;
    chrome.tabs.onUpdated.removeListener(watch);
    chrome.windows.remove(win.id).catch(() => {});
    const back = new URLSearchParams(new URL(change.url).hash.slice(1));
    if (back.get("state") === state && back.get("access_token")) {
      frame.contentWindow.postMessage({ t: "hub-token", token: back.get("access_token") }, HUB_ORIGIN);
    }
  };
  chrome.tabs.onUpdated.addListener(watch);
}

// Streamer View: the hub shows the streamer whose channel is open in this window's
// Twitch tab, so it's told the channel whenever the tab or its address changes.
const NOT_CHANNELS = /^(directory|videos|settings|search|subscriptions|inventory|wallet|drops|downloads|following|embed|p|u|turbo|messages|login|signup)$/;
function channelOf(url) {
  try {
    const u = new URL(url);
    if (!/(^|\.)twitch\.tv$/.test(u.hostname)) return "";
    const parts = u.pathname.split("/").filter(Boolean);
    const name = (parts[0] === "popout" || parts[0] === "moderator" ? parts[1] : parts[0]) || "";
    return /^[a-z0-9_]{2,25}$/i.test(name) && !NOT_CHANNELS.test(name.toLowerCase()) ? name.toLowerCase() : "";
  } catch {
    return "";
  }
}
let toldChannel = null;
async function tellChannel() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true }).catch(() => []);
  if (!tab?.url) return; // not a Twitch tab (no address shown to us): keep the last one
  const channel = channelOf(tab.url);
  if (channel === toldChannel) return;
  toldChannel = channel;
  frame.contentWindow?.postMessage({ t: "hub-channel", channel }, HUB_ORIGIN);
}
frame.addEventListener("load", () => {
  toldChannel = null;
  tellChannel();
});
chrome.tabs.onActivated.addListener(tellChannel);
chrome.tabs.onUpdated.addListener((id, change) => change.url && tellChannel());
chrome.windows.onFocusChanged.addListener(tellChannel);
