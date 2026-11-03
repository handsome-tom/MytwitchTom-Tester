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
  const q = new URLSearchParams({ response_type: "token", client_id: CLIENT_ID, redirect_uri: HUB, scope: "", state });
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
