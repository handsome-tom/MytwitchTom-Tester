// Background helper for the Auto Streak Saver (streaksaver.js). Pages can't open
// windows by themselves without a click (Chrome's pop-up blocker), but the
// extension can, so the page asks this to open, recognise and close the saver window.
// It also opens the hub's side panel for the handshake button (hub.js).
//
// Saved in chrome.storage.local:
//   "streakSaverTab"  id of the tab inside the saver window

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  // Minimized, so it stays out of sight, and the tab muted, so nothing is heard
  // (the player itself still plays at 1%, which is what Twitch sees).
  if (msg.type === "openStreakSaver") {
    chrome.windows.create({ url: msg.url, type: "popup", state: "minimized", focused: false }, (win) => {
      const tab = win.tabs[0].id;
      chrome.tabs.update(tab, { muted: true });
      chrome.storage.local.set({ streakSaverTab: tab });
    });
  }

  if (msg.type === "amStreakSaver") {
    chrome.storage.local.get("streakSaverTab", (d) => reply(!!sender.tab && d.streakSaverTab === sender.tab.id));
    return true; // reply comes later
  }

  // You X'd the row of the channel it's working on (streaksaver.js).
  if (msg.type === "stopStreakSaver") {
    chrome.storage.local.get("streakSaverTab", (d) => {
      if (!d.streakSaverTab) return;
      chrome.storage.local.remove("streakSaverTab");
      chrome.tabs.remove(d.streakSaverTab).catch(() => {});
    });
  }

  if (msg.type === "streakSaverDone" && sender.tab) {
    chrome.storage.local.remove("streakSaverTab");
    chrome.windows.remove(sender.tab.windowId);
  }

  // The handshake button (hub.js): open the hub (hub.html) in Chrome's side
  // panel for this tab. Called straight away, so it still counts as the click
  // Chrome needs; if Chrome won't, the hub opens in a small window instead.
  if (msg.type === "openHub" && sender.tab) {
    chrome.sidePanel
      .open({ tabId: sender.tab.id })
      .catch(() => chrome.windows.create({ url: "hub.html", type: "popup", width: 400, height: 680 }));
  }
});

// ===== The relay, for flagging chat lines (flag.js) ===================================
// Twitch pages connect here with a port; while any is open this keeps one
// connection to Streamer Buddy System's relay, signed in with the sign-in the
// hub handed over (hub-panel.js), and passes messages both ways. It also tells
// them who you're signed in as and who you're connected with, so flag.js only
// offers its flag in those channels.
//
// Saved in chrome.storage.local:
//   "hubToken"  the hub's Twitch sign-in

const RELAY_URL = "wss://streamer-buddy-relay.handsome-tom.workers.dev/ws";
const hubPorts = new Set();
let hubSocket = null;
let hubPing = 0;
let hubReady = false;
const hubWaiting = []; // flags from before the connection was ready
let hubPeople = null; // { me, mutual: [logins] } from the relay, kept through a dropped connection

function tellPeople(port) {
  const m = { t: "people", me: hubPeople?.me || null, mutual: hubPeople?.mutual || [] };
  for (const p of port ? [port] : hubPorts) p.postMessage(m);
}

async function hubConnect() {
  if (hubSocket || !hubPorts.size) return;
  const { hubToken } = await chrome.storage.local.get("hubToken");
  if (!hubToken || hubSocket) return;
  const ws = new WebSocket(RELAY_URL);
  hubSocket = ws;
  ws.onopen = () => ws.send(JSON.stringify({ t: "auth", token: hubToken }));
  ws.onmessage = (e) => {
    if (e.data === "pong") return;
    const m = JSON.parse(e.data);
    if (m.t === "state") {
      hubPeople = { me: m.me, mutual: (m.connections || []).filter((c) => c.mutual).map((c) => c.login) };
      tellPeople();
    }
    if (m.t === "state" && !hubReady) {
      hubReady = true;
      for (const flag of hubWaiting.splice(0)) ws.send(JSON.stringify(flag));
    }
    if (m.t === "flash" || m.t === "unflash" || m.t === "flashed" || m.t === "error") {
      for (const port of hubPorts) port.postMessage(m);
    }
  };
  ws.onclose = (e) => {
    if (ws !== hubSocket) return;
    hubSocket = null;
    hubReady = false;
    clearInterval(hubPing);
    if (e.code === 4001) chrome.storage.local.remove("hubToken"); // the sign-in ran out (hubPeople is cleared below)
    else if (hubPorts.size) setTimeout(hubConnect, 5000);
  };
  clearInterval(hubPing);
  hubPing = setInterval(() => ws.readyState === 1 && ws.send("ping"), 20000); // also keeps this worker awake
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "hub") return;
  hubPorts.add(port);
  if (hubPeople) tellPeople(port);
  hubConnect();
  port.onDisconnect.addListener(() => {
    hubPorts.delete(port);
    if (!hubPorts.size) hubSocket?.close();
  });
  port.onMessage.addListener(async (m) => {
    if (m.t === "unflag") {
      if (hubReady) hubSocket.send(JSON.stringify({ t: "unflash", id: m.id }));
      return;
    }
    if (m.t !== "flag") return;
    const { hubToken } = await chrome.storage.local.get("hubToken");
    if (!hubToken) return port.postMessage({ t: "needSignin" });
    const flag = { t: "flash", kind: "chat", channel: m.channel, chatter: m.chatter, chatterName: m.chatterName, chatterColor: m.chatterColor, emotes: m.emotes, text: m.text, color: m.color };
    if (hubReady) hubSocket.send(JSON.stringify(flag));
    else {
      hubWaiting.push(flag);
      hubConnect();
    }
  });
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes.hubToken) return;
  hubPeople = null;
  tellPeople();
  hubSocket?.close();
  hubConnect();
});

// ===== Account switcher (accounts.js) ================================================
// Twitch has no account switcher, so this remembers each account's Twitch sign-in
// cookies and swaps them. Content scripts can't touch cookies, so the page asks here.
//
// Saved in chrome.storage.local:
//   "accounts"       { login: { login, name, cookies: [cookie], savedAt } }
//   "accountAdding"  true while you're signing into a new account

const twitchCookies = () => chrome.cookies.getAll({ domain: "twitch.tv" });
const cookieUrl = (c) => `https://${c.domain.replace(/^\./, "")}${c.path}`;

// Save the signed-in account's cookies (if anyone is signed in). Returns its login.
async function saveCurrentAccount() {
  const cookies = await twitchCookies();
  const login = cookies.find((c) => c.name === "login")?.value;
  if (!login) return null;
  const name = decodeURIComponent(cookies.find((c) => c.name === "name")?.value || login);
  const { accounts = {} } = await chrome.storage.local.get("accounts");
  accounts[login] = { login, name, cookies, savedAt: Date.now() };
  await chrome.storage.local.set({ accounts });
  return login;
}

// Remove Twitch's cookies from this browser only. This is not Twitch's "Log out"
// (which would cancel the saved sign-in on Twitch's side too).
async function clearTwitchCookies() {
  for (const c of await twitchCookies()) {
    await chrome.cookies.remove({ url: cookieUrl(c), name: c.name, storeId: c.storeId });
  }
}

async function restoreCookies(cookies) {
  for (const c of cookies) {
    const d = {
      url: cookieUrl(c), name: c.name, value: c.value, path: c.path,
      secure: c.secure, httpOnly: c.httpOnly, sameSite: c.sameSite, storeId: c.storeId,
    };
    if (!c.hostOnly) d.domain = c.domain;
    if (!c.session && c.expirationDate) d.expirationDate = c.expirationDate;
    try {
      await chrome.cookies.set(d);
    } catch {
      // A cookie Chrome won't take back as-is isn't needed to stay signed in.
    }
  }
}

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  const run = {
    async accountsList() {
      const { accounts = {} } = await chrome.storage.local.get("accounts");
      const current = (await twitchCookies()).find((c) => c.name === "login")?.value || null;
      return { current, accounts: Object.values(accounts).map(({ login, name }) => ({ login, name })) };
    },
    async accountSave() {
      const login = await saveCurrentAccount();
      await chrome.storage.local.remove("accountAdding");
      return { login };
    },
    async accountSwitch() {
      const { accounts = {} } = await chrome.storage.local.get("accounts");
      const target = accounts[msg.login];
      if (!target) return { ok: false };
      await saveCurrentAccount(); // keep the account you're leaving up to date
      await clearTwitchCookies();
      await restoreCookies(target.cookies);
      return { ok: true };
    },
    async accountAdd() {
      await saveCurrentAccount();
      await chrome.storage.local.set({ accountAdding: true });
      await clearTwitchCookies();
      return { ok: true };
    },
    async accountForget() {
      const { accounts = {} } = await chrome.storage.local.get("accounts");
      delete accounts[msg.login];
      await chrome.storage.local.set({ accounts });
      return { ok: true };
    },
  }[msg.type];
  if (!run) return;
  run().then(reply, (e) => reply({ ok: false, error: String(e) }));
  return true; // reply comes later
});

// ===== Extension pages in a small window ============================================
// A page of this extension (like an editor too big for a drop-down), opened in a
// small window of its own when a Twitch page asks.
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type !== "openPage" || !/^[a-z-]+\.html$/.test(msg.page || "")) return;
  chrome.windows.create({ url: chrome.runtime.getURL(msg.page), type: "popup", width: 340, height: 620, focused: true });
});

// ===== Follow list refresh (people.js) ==============================================
// Opens the Following page in a small window in front, where it loads fully;
// people.js reads it and saves "follows", then this closes the window.
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type !== "syncFollows") return;
  chrome.windows.create({ url: msg.url, type: "popup", width: 520, height: 700, focused: true }, (win) => {
    const close = () => {
      chrome.storage.onChanged.removeListener(done);
      chrome.windows.remove(win.id).catch(() => {});
    };
    const done = (changes, area) => {
      if (area === "local" && changes.follows) close();
    };
    chrome.storage.onChanged.addListener(done);
    setTimeout(close, 2 * 60 * 1000); // give up after 2 minutes either way
  });
});
