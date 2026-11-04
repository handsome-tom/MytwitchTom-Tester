// Feature switches. Clicking the extension's icon opens a list of the bigger
// features, each with an on/off switch (switches.html); a feature that's
// switched off doesn't start at all, from the next time Twitch loads.
//
// This loads before the other scripts. Each of them starts through
// whenOn(key, label, start), which also puts it on the list, and the list is
// saved for the icon's pop-up, so it only shows the features this copy has.
//
// Saved in chrome.storage.local:
//   "featuresOff"  [key]              features switched off (everything else is on)
//   "featureList"  [{ key, label }]   the features this copy has, for the pop-up

const tbcFeatures = []; // [{ key, label }], in the order the scripts load
let tbcOff = null;      // keys switched off, once loaded
const tbcWaiting = [];

chrome.storage.local.get(["featuresOff", "featureList"], (d) => {
  tbcOff = d.featuresOff || [];
  tbcWaiting.splice(0).forEach((go) => go());
  // Every script has registered by now (they all run before this answer comes back).
  if (window.top === window && JSON.stringify(d.featureList) !== JSON.stringify(tbcFeatures)) {
    chrome.storage.local.set({ featureList: tbcFeatures });
  }
});

function whenOn(key, label, start) {
  if (!tbcFeatures.some((f) => f.key === key)) tbcFeatures.push({ key, label });
  const go = () => {
    if (!tbcOff.includes(key)) start();
  };
  tbcOff ? go() : tbcWaiting.push(go);
}

// ===== One page watcher for every script =====================================
// Twitch changes the page constantly: every chat line, every hover. Instead of
// each script watching the whole page itself (and running on every change), they
// all register here with tbcWatch(fn, every): there's one MutationObserver, and
// each fn runs at most once per `every` ms, after the page has been busy, with
// the changes gathered since its last run (or null when there were too many to
// keep). `every` of 0 runs fn inside the observer itself, before the browser
// draws (myname.js needs that so lines don't shift when they get boxed).
//
// After the extension is reloaded, the copy still running in already-open tabs
// loses chrome.* ("Extension context invalidated"); the watcher then stops.
const tbcWatchers = []; // { fn, every, due, records, full }
let tbcObserver = null;
const TBC_KEEP_RECORDS = 400;

function tbcAlive() {
  try {
    return !!chrome.runtime?.id;
  } catch {
    return false;
  }
}

function tbcWatch(fn, every = 250) {
  const w = { fn, every, due: 0, records: [], full: false };
  tbcWatchers.push(w);
  if (tbcObserver) return;
  tbcObserver = new MutationObserver((records) => {
    if (!tbcAlive()) return tbcObserver.disconnect();
    for (const w of tbcWatchers) {
      if (!w.every) {
        w.fn(records);
        continue;
      }
      if (w.full) continue;
      if (w.records.length + records.length > TBC_KEEP_RECORDS) {
        w.full = true;
        w.records = [];
      } else {
        for (const r of records) w.records.push(r);
      }
      if (!w.due) {
        w.due = setTimeout(() => {
          w.due = 0;
          const got = w.full ? null : w.records;
          w.records = [];
          w.full = false;
          if (tbcAlive()) w.fn(got);
        }, w.every);
      }
    }
  });
  tbcObserver.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
}
