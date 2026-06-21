const storageKey = "hitorigotter-web-state-v1";

const defaultState = {
  activeAccountId: "default",
  accounts: [
    {
      id: "default",
      name: "hitorigotter",
      posts: [
        {
          id: crypto.randomUUID(),
          text: "ここはローカルだけのメモ置き場です。アカウントを分けると、ジャンル別に書き残せます。 #first",
          pinned: false,
          createdAt: new Date().toISOString(),
        },
      ],
    },
  ],
};

let state = loadState();
let currentScreen = "home";

const elements = {
  homeScreen: document.querySelector("#homeScreen"),
  searchScreen: document.querySelector("#searchScreen"),
  accountScreen: document.querySelector("#accountScreen"),
  settingsScreen: document.querySelector("#settingsScreen"),
  navButtons: document.querySelectorAll(".bottom-nav-button"),
  postInput: document.querySelector("#postInput"),
  postButton: document.querySelector("#postButton"),
  charCount: document.querySelector("#charCount"),
  searchInput: document.querySelector("#searchInput"),
  sortSelect: document.querySelector("#sortSelect"),
  homeTimeline: document.querySelector("#homeTimeline"),
  searchTimeline: document.querySelector("#searchTimeline"),
  activeAccountLabel: document.querySelector("#activeAccountLabel"),
  accountNameInput: document.querySelector("#accountNameInput"),
  addAccountButton: document.querySelector("#addAccountButton"),
  accountList: document.querySelector("#accountList"),
  exportButton: document.querySelector("#exportButton"),
  importInput: document.querySelector("#importInput"),
  postTemplate: document.querySelector("#postTemplate"),
};

bindEvents();
render();

function bindEvents() {
  elements.navButtons.forEach((button) => {
    button.addEventListener("click", () => setScreen(button.dataset.screen));
  });

  elements.postInput.addEventListener("input", renderComposerState);
  elements.postInput.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      addPost();
    }
  });
  elements.postButton.addEventListener("click", addPost);
  elements.searchInput.addEventListener("input", renderTimeline);
  elements.sortSelect.addEventListener("change", renderTimeline);
  elements.addAccountButton.addEventListener("click", addAccount);
  elements.exportButton.addEventListener("click", exportState);
  elements.importInput.addEventListener("change", importState);
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    return normalizeState(saved);
  } catch {
    localStorage.removeItem(storageKey);
  }
  return structuredClone(defaultState);
}

function normalizeState(value) {
  if (value?.accounts && Array.isArray(value.accounts)) {
    const accounts = value.accounts.map(normalizeAccount).filter(Boolean);
    if (accounts.length > 0) {
      return {
        activeAccountId: accounts.some((account) => account.id === value.activeAccountId)
          ? value.activeAccountId
          : accounts[0].id,
        accounts,
      };
    }
  }

  if (value?.profile && Array.isArray(value.posts)) {
    const account = normalizeAccount({
      id: "default",
      name: value.profile.name || "hitorigotter",
      posts: value.posts,
    });
    return {
      activeAccountId: account.id,
      accounts: [account],
    };
  }

  return structuredClone(defaultState);
}

function normalizeAccount(account) {
  if (!account) return null;
  return {
    id: String(account.id || crypto.randomUUID()),
    name: String(account.name || "hitorigotter").slice(0, 28),
    posts: Array.isArray(account.posts)
      ? account.posts
          .filter((post) => !post.archived)
          .map((post) => ({
            id: String(post.id || crypto.randomUUID()),
            text: String(post.text || "").slice(0, 280),
            pinned: Boolean(post.pinned),
            createdAt: Number.isNaN(new Date(post.createdAt).getTime())
              ? new Date().toISOString()
              : new Date(post.createdAt).toISOString(),
          }))
      : [],
  };
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function render() {
  renderScreens();
  renderComposerState();
  renderTimeline();
  renderAccounts();
}

function setScreen(screen) {
  currentScreen = screen;
  renderScreens();
  renderTimeline();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderScreens() {
  const screens = {
    home: elements.homeScreen,
    search: elements.searchScreen,
    account: elements.accountScreen,
    settings: elements.settingsScreen,
  };

  Object.entries(screens).forEach(([name, panel]) => {
    panel.hidden = currentScreen !== name;
  });

  elements.navButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.screen === currentScreen);
  });

  elements.activeAccountLabel.textContent = activeAccount().name;
}

function activeAccount() {
  return (
    state.accounts.find((account) => account.id === state.activeAccountId) ||
    state.accounts[0]
  );
}

function renderComposerState() {
  const length = elements.postInput.value.length;
  elements.charCount.textContent = `${length} / 280`;
  elements.postButton.disabled = length === 0 || length > 280;
}

function addPost() {
  const text = elements.postInput.value.trim();
  if (!text) return;

  activeAccount().posts.unshift({
    id: crypto.randomUUID(),
    text,
    pinned: false,
    createdAt: new Date().toISOString(),
  });

  elements.postInput.value = "";
  saveState();
  renderComposerState();
  renderTimeline();
}

function renderTimeline() {
  const container =
    currentScreen === "search" ? elements.searchTimeline : elements.homeTimeline;
  const posts = getVisiblePosts();

  container.replaceChildren();

  if (posts.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "表示できる投稿がありません。";
    container.append(empty);
    return;
  }

  posts.forEach((post) => {
    const node = elements.postTemplate.content.firstElementChild.cloneNode(true);
    node.classList.toggle("pinned", post.pinned);
    node.querySelector(".post-avatar").textContent = getInitial();
    node.querySelector(".post-name").textContent = activeAccount().name;
    node.querySelector(".post-time").textContent = formatDate(post.createdAt);
    node.querySelector(".post-time").dateTime = post.createdAt;
    node.querySelector(".post-text").textContent = post.text;

    const tagContainer = node.querySelector(".post-tags");
    extractTags(post.text).forEach((tag) => {
      const item = document.createElement("span");
      item.textContent = `#${tag}`;
      tagContainer.append(item);
    });

    const pinButton = node.querySelector(".pin-button");
    pinButton.textContent = post.pinned ? "固定を外す" : "固定";
    pinButton.addEventListener("click", () => togglePinPost(post.id));
    node.querySelector(".delete-button").addEventListener("click", () => deletePost(post.id));

    container.append(node);
  });
}

function getVisiblePosts() {
  const query = elements.searchInput.value.trim().toLowerCase();
  const direction = elements.sortSelect.value;

  return activeAccount()
    .posts.filter((post) => {
      if (currentScreen !== "search" || !query) return true;
      const haystack = `${post.text} ${extractTags(post.text).join(" ")}`.toLowerCase();
      return haystack.includes(query);
    })
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      const result = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return direction === "newest" ? result : -result;
    });
}

function togglePinPost(id) {
  const post = activeAccount().posts.find((item) => item.id === id);
  if (!post) return;
  post.pinned = !post.pinned;
  saveState();
  renderTimeline();
}

function deletePost(id) {
  const account = activeAccount();
  const post = account.posts.find((item) => item.id === id);
  if (!post) return;
  const confirmed = window.confirm("この投稿を削除しますか。");
  if (!confirmed) return;
  account.posts = account.posts.filter((item) => item.id !== id);
  saveState();
  renderTimeline();
}

function addAccount() {
  const name = elements.accountNameInput.value.trim();
  if (!name) return;

  const account = {
    id: crypto.randomUUID(),
    name: name.slice(0, 28),
    posts: [],
  };

  state.accounts.push(account);
  state.activeAccountId = account.id;
  elements.accountNameInput.value = "";
  saveState();
  render();
}

function renderAccounts() {
  elements.accountList.replaceChildren();

  state.accounts.forEach((account) => {
    const item = document.createElement("div");
    item.className = "account-item";
    item.classList.toggle("active", account.id === state.activeAccountId);

    const button = document.createElement("button");
    button.className = "account-select";
    button.type = "button";
    button.innerHTML = `<span>${escapeHtml(account.name)}</span><small>${account.posts.length} posts</small>`;
    button.addEventListener("click", () => {
      state.activeAccountId = account.id;
      saveState();
      render();
      setScreen("home");
    });

    const deleteButton = document.createElement("button");
    deleteButton.className = "account-delete";
    deleteButton.type = "button";
    deleteButton.textContent = "削除";
    deleteButton.disabled = state.accounts.length === 1;
    deleteButton.addEventListener("click", () => deleteAccount(account.id));

    item.append(button, deleteButton);
    elements.accountList.append(item);
  });
}

function deleteAccount(id) {
  if (state.accounts.length === 1) return;
  const account = state.accounts.find((item) => item.id === id);
  if (!account) return;
  const confirmed = window.confirm(`${account.name} を削除しますか。`);
  if (!confirmed) return;

  state.accounts = state.accounts.filter((item) => item.id !== id);
  if (state.activeAccountId === id) {
    state.activeAccountId = state.accounts[0].id;
  }
  saveState();
  render();
}

function extractTags(text) {
  return [...text.matchAll(/(?:^|\s)#([A-Za-z0-9_\u3040-\u30ff\u3400-\u9fff-]+)/g)].map(
    (match) => match[1],
  );
}

function formatDate(value) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getInitial() {
  return (activeAccount().name || "h").trim().charAt(0) || "h";
}

function exportState() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `hitorigotter-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function importState(event) {
  const [file] = event.target.files;
  if (!file) return;

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      state = normalizeState(JSON.parse(String(reader.result)));
      saveState();
      render();
    } catch (error) {
      window.alert("読み込めないJSONです。");
    } finally {
      event.target.value = "";
    }
  });
  reader.readAsText(file);
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return entities[char];
  });
}
