// Clear all, for Twitch's notifications. Twitch only has a delete button on each
// notification, so this adds a "Clear all" button to the header of the panel the
// bell opens, and it clicks those delete buttons for you, on both tabs (My Twitch
// and My Channel). Deleted notifications don't come back, so it takes two clicks.
//
// Twitch only shows some notifications until you scroll, so each tab is scrolled to
// the bottom first. Anything Twitch won't delete is skipped, not retried.
//
// Wrapped so its names don't clash with the other scripts, and only started if
// it's switched on (settings.js).
whenOn("clearnotifs", "Clear all notifications", () => {
  if (window.top !== window) return;

  const TITLE = "#OnsiteNotificationPopover-header";
  const LEFT_SLOT = ".tw-popover-header__icon-slot--left";
  const TABS = '[data-test-selector="center-window__tabs"] [role="tab"]';
  const DELETE = '[data-test-selector="persistent-notification__delete"]';
  const SURE_MS = 3000;         // how long "Sure?" waits for the second click
  const DELETE_GAP_MS = 200;    // between deletes, to go easy on Twitch
  const LOAD_WAIT_MS = 800;     // for Twitch to load more after scrolling
  const TAB_WAIT_MS = 2500;     // for a tab's list to show up
  const MAX_DELETES = 1000;

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const deleteButtons = () => [...document.querySelectorAll(DELETE)];

  async function loadEverything() {
    for (let waited = 0; !deleteButtons().length && waited < TAB_WAIT_MS; waited += 250) await wait(250);
    let seen = -1;
    while (deleteButtons().length !== seen) {
      seen = deleteButtons().length;
      deleteButtons().at(-1)?.scrollIntoView({ block: "end" });
      await wait(LOAD_WAIT_MS);
    }
  }

  // Clicked buttons are remembered, in case Twitch keeps showing one it didn't delete.
  async function clearTab(clicked, onDelete) {
    await loadEverything();
    let next;
    while ((next = deleteButtons().find((b) => !clicked.has(b))) && clicked.size < MAX_DELETES) {
      clicked.add(next);
      next.click();
      onDelete();
      await wait(DELETE_GAP_MS);
    }
  }

  async function clearAll(btn) {
    btn.disabled = true;
    const clicked = new Set();
    const tabs = [...document.querySelectorAll(TABS)];
    const shown = tabs.find((t) => t.getAttribute("aria-selected") === "true");
    let count = 0;
    btn.textContent = "Clearing…";
    for (const tab of tabs.length ? tabs : [null]) {
      tab?.click();
      await wait(300);
      await clearTab(clicked, () => {
        btn.textContent = `Clearing… ${++count}`;
      });
    }
    shown?.click();
    btn.textContent = count ? `Cleared ${count}` : "Nothing to clear";
    await wait(SURE_MS);
    btn.disabled = false;
    btn.textContent = "Clear all";
  }

  function addButton() {
    if (document.querySelector(".tbc-clearnotifs")) return;
    const slot = document.querySelector(TITLE)?.parentElement.querySelector(LEFT_SLOT);
    if (!slot) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tbc-clearnotifs";
    btn.textContent = "Clear all";
    btn.title = "Delete every notification on both tabs";
    let sure = 0;
    btn.addEventListener("click", () => {
      if (!sure) {
        btn.classList.add("tbc-clearnotifs--sure");
        btn.textContent = "Sure?";
        sure = setTimeout(() => {
          sure = 0;
          btn.classList.remove("tbc-clearnotifs--sure");
          btn.textContent = "Clear all";
        }, SURE_MS);
        return;
      }
      clearTimeout(sure);
      sure = 0;
      btn.classList.remove("tbc-clearnotifs--sure");
      clearAll(btn);
    });
    slot.append(btn);
  }

  // The panel is only there while the bell is open.
  let pending = 0;
  const observer = new MutationObserver(() => {
    if (!chrome.runtime?.id) return observer.disconnect();
    if (pending) return;
    pending = setTimeout(() => {
      pending = 0;
      addButton();
    }, 300);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
});
