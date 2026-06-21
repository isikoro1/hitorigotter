const storageKey = "hitorigotter-web-state-v2";
const legacyStorageKey = "hitorigotter-web-state-v1";
const maxPostLength = 1000;

const defaultState = {
  activeAccountId: "default",
  settings: {
    enterToPost: false,
    theme: "default",
  },
  accounts: [
    {
      id: "default",
      name: "ひとりごったー",
      posts: [
        {
          id: crypto.randomUUID(),
          shortId: "1",
          text: "ここはローカルだけのメモ置き場です。\n- アカウントを分ける\n- [ ] todoを書く\n#first",
          pinned: false,
          parentId: null,
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
  analyticsScreen: document.querySelector("#analyticsScreen"),
  settingsScreen: document.querySelector("#settingsScreen"),
  navButtons: document.querySelectorAll(".bottom-nav-button"),
  postInput: document.querySelector("#postInput"),
  postButton: document.querySelector("#postButton"),
  insertListButton: document.querySelector("#insertListButton"),
  insertTodoButton: document.querySelector("#insertTodoButton"),
  insertTagButton: document.querySelector("#insertTagButton"),
  charCount: document.querySelector("#charCount"),
  searchInput: document.querySelector("#searchInput"),
  sortSelect: document.querySelector("#sortSelect"),
  dateInput: document.querySelector("#dateInput"),
  dateModeSelect: document.querySelector("#dateModeSelect"),
  homeTimeline: document.querySelector("#homeTimeline"),
  searchTimeline: document.querySelector("#searchTimeline"),
  activeAccountLabel: document.querySelector("#activeAccountLabel"),
  accountNameInput: document.querySelector("#accountNameInput"),
  addAccountButton: document.querySelector("#addAccountButton"),
  accountList: document.querySelector("#accountList"),
  dailyChart: document.querySelector("#dailyChart"),
  hourChart: document.querySelector("#hourChart"),
  weekdayChart: document.querySelector("#weekdayChart"),
  wordList: document.querySelector("#wordList"),
  enterToPostInput: document.querySelector("#enterToPostInput"),
  themeSelect: document.querySelector("#themeSelect"),
  exportButton: document.querySelector("#exportButton"),
  importInput: document.querySelector("#importInput"),
  exportMarkdownButton: document.querySelector("#exportMarkdownButton"),
  importMarkdownInput: document.querySelector("#importMarkdownInput"),
  textModal: document.querySelector("#textModal"),
  textModalTitle: document.querySelector("#textModalTitle"),
  textModalInput: document.querySelector("#textModalInput"),
  textModalSaveButton: document.querySelector("#textModalSaveButton"),
  postTemplate: document.querySelector("#postTemplate"),
};

let modalSaveHandler = null;

bindEvents();
render();

function bindEvents() {
  elements.navButtons.forEach((button) => {
    button.addEventListener("click", () => setScreen(button.dataset.screen));
  });

  elements.postInput.addEventListener("input", renderComposerState);
  elements.postInput.addEventListener("keydown", (event) => {
    const modifierSubmit = (event.ctrlKey || event.metaKey) && event.key === "Enter";
    const enterSubmit = state.settings.enterToPost && event.key === "Enter" && !event.shiftKey;
    if (modifierSubmit || enterSubmit) {
      event.preventDefault();
      addPost();
      return;
    }
    if (event.key === "Enter") {
      const continuation = getListContinuation();
      if (continuation !== false) {
        event.preventDefault();
        if (continuation) insertComposerText(continuation, { forceInline: true });
      }
    }
  });

  elements.postButton.addEventListener("click", () => addPost());
  elements.insertListButton.addEventListener("click", () => insertComposerText("- "));
  elements.insertTodoButton.addEventListener("click", () => insertComposerText("- [ ] "));
  elements.insertTagButton.addEventListener("click", () => insertComposerText("#"));
  elements.searchInput.addEventListener("input", renderTimeline);
  elements.sortSelect.addEventListener("change", renderTimeline);
  elements.dateInput.addEventListener("change", renderTimeline);
  elements.dateModeSelect.addEventListener("change", renderTimeline);
  elements.addAccountButton.addEventListener("click", addAccount);
  elements.enterToPostInput.addEventListener("change", () => {
    state.settings.enterToPost = elements.enterToPostInput.checked;
    saveState();
  });
  elements.themeSelect.addEventListener("change", () => {
    state.settings.theme = elements.themeSelect.value;
    saveState();
    applyTheme();
  });
  elements.exportButton.addEventListener("click", exportState);
  elements.importInput.addEventListener("change", importState);
  elements.exportMarkdownButton.addEventListener("click", exportMarkdown);
  elements.importMarkdownInput.addEventListener("change", importMarkdown);
  window.addEventListener("hashchange", focusHashPost);
}

function loadState() {
  try {
    const saved =
      JSON.parse(localStorage.getItem(storageKey)) ||
      JSON.parse(localStorage.getItem(legacyStorageKey));
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
        settings: {
          enterToPost: Boolean(value.settings?.enterToPost),
          theme: normalizeTheme(value.settings?.theme),
        },
        accounts,
      };
    }
  }

  if (value?.profile && Array.isArray(value.posts)) {
    const account = normalizeAccount({
      id: "default",
      name: value.profile.name || "ひとりごったー",
      posts: value.posts,
    });
    return {
      activeAccountId: account.id,
      settings: structuredClone(defaultState.settings),
      accounts: [account],
    };
  }

  return structuredClone(defaultState);
}

function normalizeAccount(account) {
  if (!account) return null;
  const normalized = {
    id: String(account.id || crypto.randomUUID()),
    name: String(account.name || "ひとりごったー").replace("hitorigotter", "ひとりごったー").slice(0, 28),
    posts: Array.isArray(account.posts)
      ? account.posts
          .filter((post) => !post.archived)
          .map(normalizePost)
          .filter(Boolean)
      : [],
  };
  ensureSequentialPostIds(normalized);
  return normalized;
}

function normalizePost(post) {
  if (!post) return null;
  const id = String(post.id || crypto.randomUUID());
  const parentId =
    typeof post.parentId === "string" && post.parentId !== "[object Object]"
      ? post.parentId
      : null;
  return {
    id,
    shortId: String(post.shortId || ""),
    text: String(post.text || "").slice(0, maxPostLength),
    pinned: Boolean(post.pinned),
    parentId,
    createdAt: Number.isNaN(new Date(post.createdAt).getTime())
      ? new Date().toISOString()
      : new Date(post.createdAt).toISOString(),
  };
}

function normalizeTheme(value) {
  return ["default", "terminal", "dragon", "line"].includes(value) ? value : "default";
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function render() {
  applyTheme();
  renderScreens();
  renderComposerState();
  renderTimeline();
  renderAccounts();
  renderAnalytics();
  renderSettings();
  window.setTimeout(focusHashPost, 0);
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
    analytics: elements.analyticsScreen,
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

function renderSettings() {
  elements.enterToPostInput.checked = state.settings.enterToPost;
  elements.themeSelect.value = state.settings.theme;
}

function applyTheme() {
  document.body.dataset.theme = state.settings.theme;
}

function activeAccount() {
  return (
    state.accounts.find((account) => account.id === state.activeAccountId) ||
    state.accounts[0]
  );
}

function renderComposerState() {
  const length = elements.postInput.value.length;
  elements.charCount.textContent = `${length} / ${maxPostLength}`;
  elements.postButton.disabled = length === 0 || length > maxPostLength;
}

function insertComposerText(text, options = {}) {
  const input = elements.postInput;
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? input.value.length;
  const needsLineBreak = !options.forceInline && start > 0 && input.value[start - 1] !== "\n";
  const insertText = `${needsLineBreak ? "\n" : ""}${text}`;
  input.value = `${input.value.slice(0, start)}${insertText}${input.value.slice(end)}`;
  const cursor = start + insertText.length;
  input.focus();
  input.setSelectionRange(cursor, cursor);
  renderComposerState();
}

function getListContinuation() {
  const input = elements.postInput;
  const cursor = input.selectionStart ?? input.value.length;
  const beforeCursor = input.value.slice(0, cursor);
  const currentLine = beforeCursor.split("\n").pop() ?? "";

  if (/^\s*-\s+\[( |x|X)\]\s*$/.test(currentLine) || /^\s*-\s*$/.test(currentLine)) {
    const lineStart = beforeCursor.lastIndexOf("\n") + 1;
    input.value = `${input.value.slice(0, lineStart)}${input.value.slice(cursor)}`;
    input.setSelectionRange(lineStart, lineStart);
    renderComposerState();
    return "";
  }

  if (/^\s*-\s+\[( |x|X)\]\s+/.test(currentLine)) return "\n- [ ] ";
  if (/^\s*-\s+/.test(currentLine)) return "\n- ";
  return false;
}

function addPost(parentId = null, textOverride = "") {
  const text = (textOverride || elements.postInput.value).trim();
  if (!text) return;

  const id = crypto.randomUUID();
  const account = activeAccount();
  account.posts.unshift({
    id,
    shortId: nextSequentialPostId(account),
    text,
    pinned: false,
    parentId,
    createdAt: new Date().toISOString(),
  });

  if (!textOverride) {
    elements.postInput.value = "";
    renderComposerState();
  }
  saveState();
  render();
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
    container.append(renderPost(post, currentScreen === "search"));
  });
}

function renderPost(post, showContext = false) {
  const node = elements.postTemplate.content.firstElementChild.cloneNode(true);
  node.id = `post-${post.shortId}`;
  node.dataset.postId = post.shortId;
  node.classList.toggle("pinned", post.pinned);
  node.classList.toggle("reply-card", Boolean(post.parentId));
  node.querySelector(".post-avatar").textContent = getInitial();
  node.querySelector(".post-name").textContent = activeAccount().name;

  const idLink = node.querySelector(".post-id-link");
  idLink.textContent = `>>${post.shortId}`;
  idLink.href = `#post-${post.shortId}`;
  idLink.addEventListener("click", () => copyPostLink(post.shortId));

  node.querySelector(".post-time").textContent = formatDate(post.createdAt);
  node.querySelector(".post-time").dateTime = post.createdAt;
  renderMarkdownish(post, node.querySelector(".post-text"));

  const tagContainer = node.querySelector(".post-tags");
  extractTags(post.text).forEach((tag) => {
    const item = document.createElement("button");
    item.type = "button";
    item.textContent = `#${tag}`;
    item.addEventListener("click", () => searchByTag(tag));
    tagContainer.append(item);
  });

  if (showContext && post.parentId) {
    const context = document.createElement("span");
    context.className = "reply-context";
    context.textContent = "返信";
    tagContainer.prepend(context);
  }

    const pinButton = node.querySelector(".pin-button");
    pinButton.textContent = post.pinned ? "固定を外す" : "固定";
    pinButton.addEventListener("click", () => togglePinPost(post.id));
    node.querySelector(".edit-button").addEventListener("click", () => editPost(post.id));
    node.querySelector(".quote-button").addEventListener("click", () => quotePost(post.shortId));
    node.querySelector(".reply-button").addEventListener("click", () => replyToPost(post.id));
    node.querySelector(".delete-button").addEventListener("click", () => deletePost(post.id));

  const replies = getReplies(post.id);
  const replyList = node.querySelector(".reply-list");
  replies.forEach((reply) => replyList.append(renderPost(reply)));

  return node;
}

function renderMarkdownish(post, container) {
  container.replaceChildren();
  const lines = post.text.split(/\r?\n/);
  let list = null;

  lines.forEach((line, lineIndex) => {
    const todoMatch = line.match(/^\s*-\s+\[( |x|X)\]\s+(.*)$/);
    const listMatch = line.match(/^\s*-\s+(.*)$/);

    if (todoMatch || listMatch) {
      if (!list) {
        list = document.createElement("ul");
        container.append(list);
      }
      const li = document.createElement("li");
      if (todoMatch) {
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = todoMatch[1].toLowerCase() === "x";
        checkbox.addEventListener("change", () => toggleTodo(post.id, lineIndex, checkbox.checked));
        li.append(checkbox, " ");
        appendInlineText(li, todoMatch[2]);
      } else {
        appendInlineText(li, listMatch[1]);
      }
      list.append(li);
      return;
    }

    list = null;
    const paragraph = document.createElement("p");
    if (line.trim()) {
      appendInlineText(paragraph, line);
    } else {
      paragraph.append(document.createElement("br"));
    }
    container.append(paragraph);
  });
}

function toggleTodo(postId, lineIndex, checked) {
  const post = activeAccount().posts.find((item) => item.id === postId);
  if (!post) return;
  const lines = post.text.split(/\r?\n/);
  const line = lines[lineIndex];
  if (!/^\s*-\s+\[( |x|X)\]\s+/.test(line)) return;
  lines[lineIndex] = line.replace(
    /^(\s*-\s+\[)( |x|X)(\]\s+)/,
    `$1${checked ? "x" : " "}$3`,
  );
  post.text = lines.join("\n");
  saveState();
  render();
}

function appendInlineText(parent, text) {
  const pattern = /(#([A-Za-z0-9_\u3040-\u30ff\u3400-\u9fff-]+)|>>([0-9]+)|@?post:([A-Za-z0-9-]+))/g;
  let lastIndex = 0;
  for (const match of text.matchAll(pattern)) {
    parent.append(document.createTextNode(text.slice(lastIndex, match.index)));
    if (match[2]) {
      const button = document.createElement("button");
      button.className = "inline-tag";
      button.type = "button";
      button.textContent = `#${match[2]}`;
      button.addEventListener("click", () => searchByTag(match[2]));
      parent.append(button);
    } else {
      const id = match[3] || match[4];
      const link = document.createElement("a");
      link.href = `#post-${id}`;
      link.textContent = match[0];
      link.addEventListener("click", () => copyPostLink(id));
      parent.append(link);
    }
    lastIndex = match.index + match[0].length;
  }
  parent.append(document.createTextNode(text.slice(lastIndex)));
}

function getVisiblePosts() {
  const query = elements.searchInput.value.trim().toLowerCase();
  const direction = elements.sortSelect.value;
  const dateValue = elements.dateInput.value;
  const dateMode = elements.dateModeSelect.value;

  return activeAccount()
    .posts.filter((post) => {
      if (currentScreen !== "search" && post.parentId) return false;

      if (currentScreen === "search") {
        if (query) {
          const haystack = `${post.shortId} >>${post.shortId} ${post.text} ${extractTags(post.text).join(" ")}`.toLowerCase();
          if (!haystack.includes(query.replace(/^#/, "")) && !haystack.includes(query)) {
            return false;
          }
        }
        if (!matchesDateFilter(post, dateValue, dateMode)) return false;
      }

      return true;
    })
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      const result = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return direction === "newest" ? result : -result;
    });
}

function matchesDateFilter(post, dateValue, dateMode) {
  if (!dateValue || dateMode === "any") return true;
  const postDate = new Date(post.createdAt).toISOString().slice(0, 10);
  if (dateMode === "on") return postDate === dateValue;
  if (dateMode === "since") return postDate >= dateValue;
  if (dateMode === "until") return postDate <= dateValue;
  return true;
}

function getReplies(parentId) {
  return activeAccount()
    .posts.filter((post) => post.parentId === parentId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

function replyToPost(parentId) {
  openTextModal({
    title: "返信を書く",
    value: "",
    submitLabel: "返信",
    onSave: (text) => addPost(parentId, text),
  });
}

function quotePost(shortId) {
  setScreen("home");
  window.requestAnimationFrame(() => {
    const prefix = elements.postInput.value.trim() ? "\n" : "";
    elements.postInput.value = `${elements.postInput.value}${prefix}>>${shortId}\n`;
    elements.postInput.focus();
    elements.postInput.setSelectionRange(
      elements.postInput.value.length,
      elements.postInput.value.length,
    );
    renderComposerState();
  });
}

function editPost(id) {
  const post = activeAccount().posts.find((item) => item.id === id);
  if (!post) return;
  openTextModal({
    title: "投稿を編集",
    value: post.text,
    submitLabel: "保存",
    onSave: (text) => {
      post.text = text.slice(0, maxPostLength);
      saveState();
      render();
    },
  });
}

function openTextModal({ title, value, submitLabel, onSave }) {
  elements.textModalTitle.textContent = title;
  elements.textModalInput.value = value;
  elements.textModalSaveButton.textContent = submitLabel;
  modalSaveHandler = onSave;
  elements.textModal.showModal();
  window.setTimeout(() => elements.textModalInput.focus(), 0);
}

elements.textModal.addEventListener("close", () => {
  if (elements.textModal.returnValue !== "default" || !modalSaveHandler) {
    modalSaveHandler = null;
    return;
  }
  const text = elements.textModalInput.value.trim();
  const handler = modalSaveHandler;
  modalSaveHandler = null;
  if (!text) return;
  handler(text);
});

function searchByTag(tag) {
  elements.searchInput.value = `#${tag}`;
  elements.dateModeSelect.value = "any";
  setScreen("search");
}

function copyPostLink(shortId) {
  const url = `${location.origin}${location.pathname}#post-${shortId}`;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).catch(() => {});
  }
}

function focusHashPost() {
  if (!location.hash.startsWith("#post-")) return;
  const post = document.querySelector(location.hash);
  if (!post) return;
  post.scrollIntoView({ block: "center" });
  post.classList.add("focused");
  window.setTimeout(() => post.classList.remove("focused"), 1600);
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
  const confirmed = window.confirm("この投稿と返信を削除しますか。");
  if (!confirmed) return;
  const replyIds = collectReplyIds(id);
  account.posts = account.posts.filter((item) => item.id !== id && !replyIds.includes(item.id));
  saveState();
  renderTimeline();
}

function collectReplyIds(parentId) {
  const direct = activeAccount().posts.filter((post) => post.parentId === parentId);
  return direct.flatMap((post) => [post.id, ...collectReplyIds(post.id)]);
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

function renderAnalytics() {
  const posts = activeAccount().posts;
  renderBarChart(elements.dailyChart, getDailyCounts(posts), "投稿なし");
  renderBarChart(elements.hourChart, getHourCounts(posts), "投稿なし");
  renderBarChart(elements.weekdayChart, getWeekdayCounts(posts), "投稿なし");
  renderWordList(getFrequentWords(posts));
}

function renderBarChart(container, items, emptyText) {
  container.replaceChildren();
  if (items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "analytics-empty";
    empty.textContent = emptyText;
    container.append(empty);
    return;
  }

  const max = Math.max(...items.map((item) => item.value), 1);
  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "bar-row";
    row.innerHTML = `
      <span class="bar-label">${escapeHtml(item.label)}</span>
      <span class="bar-track"><span class="bar-fill" style="width: ${(item.value / max) * 100}%"></span></span>
      <strong>${item.value}</strong>
    `;
    container.append(row);
  });
}

function getDailyCounts(posts) {
  const counts = new Map();
  posts.forEach((post) => {
    const key = new Date(post.createdAt).toISOString().slice(5, 10);
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14)
    .map(([label, value]) => ({ label, value }));
}

function getHourCounts(posts) {
  const counts = Array.from({ length: 24 }, (_, hour) => ({
    label: `${String(hour).padStart(2, "0")}時`,
    value: 0,
  }));
  posts.forEach((post) => {
    counts[new Date(post.createdAt).getHours()].value += 1;
  });
  return counts.filter((item) => item.value > 0);
}

function getWeekdayCounts(posts) {
  const labels = ["日", "月", "火", "水", "木", "金", "土"];
  const counts = labels.map((label) => ({ label, value: 0 }));
  posts.forEach((post) => {
    counts[new Date(post.createdAt).getDay()].value += 1;
  });
  return counts.filter((item) => item.value > 0);
}

function getFrequentWords(posts) {
  const stopWords = new Set([
    "これ",
    "それ",
    "ため",
    "こと",
    "もの",
    "する",
    "ある",
    "いる",
    "です",
    "ます",
    "todo",
  ]);
  const counts = new Map();
  posts.forEach((post) => {
    const words = post.text
      .replace(/#[A-Za-z0-9_\u3040-\u30ff\u3400-\u9fff-]+/g, " ")
      .match(/[A-Za-z0-9_]{2,}|[\u3040-\u30ff\u3400-\u9fff]{2,}/g);
    words?.forEach((word) => {
      const key = word.toLowerCase();
      if (stopWords.has(key)) return;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
  });
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([word, count]) => ({ word, count }));
}

function renderWordList(words) {
  elements.wordList.replaceChildren();
  if (words.length === 0) {
    const empty = document.createElement("div");
    empty.className = "analytics-empty";
    empty.textContent = "集計できる単語がありません。";
    elements.wordList.append(empty);
    return;
  }
  const max = Math.max(...words.map((item) => item.count), 1);
  words.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "word-chip";
    button.style.fontSize = `${0.9 + (item.count / max) * 0.7}rem`;
    button.textContent = `${item.word} ${item.count}`;
    button.addEventListener("click", () => {
      elements.searchInput.value = item.word;
      setScreen("search");
    });
    elements.wordList.append(button);
  });
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
  return (activeAccount().name || "ひ").trim().charAt(0) || "ひ";
}

function exportState() {
  downloadText(
    JSON.stringify(state, null, 2),
    `hitorigotter-${new Date().toISOString().slice(0, 10)}.json`,
    "application/json",
  );
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

function exportMarkdown() {
  downloadText(
    stateToMarkdown(),
    `hitorigotter-${new Date().toISOString().slice(0, 10)}.md`,
    "text/markdown",
  );
}

function importMarkdown(event) {
  const [file] = event.target.files;
  if (!file) return;

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const posts = markdownToPosts(String(reader.result));
      if (posts.length === 0) throw new Error("No posts");
      const account = activeAccount();
      posts.forEach((post) => {
        post.shortId = nextSequentialPostId(account);
        account.posts.unshift(post);
      });
      saveState();
      render();
    } catch (error) {
      window.alert("読み込めないMarkdownです。");
    } finally {
      event.target.value = "";
    }
  });
  reader.readAsText(file);
}

function stateToMarkdown() {
  const lines = ["# ひとりごったー", ""];
  state.accounts.forEach((account) => {
    lines.push(`## ${account.name}`, "");
    account.posts
      .slice()
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .forEach((post) => {
        lines.push(`### ${post.shortId}`);
        lines.push(`- createdAt: ${post.createdAt}`);
        lines.push(`- pinned: ${post.pinned ? "true" : "false"}`);
        if (post.parentId) lines.push(`- parentId: ${post.parentId}`);
        lines.push("");
        lines.push(post.text);
        lines.push("");
        lines.push("---");
        lines.push("");
      });
  });
  return lines.join("\n");
}

function markdownToPosts(markdown) {
  const chunks = markdown
    .split(/\n---+\n/g)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  const source = chunks.length > 1 ? chunks : [markdown.trim()];
  return source
    .map((chunk) => {
      const lines = chunk.split(/\r?\n/);
      const createdAtLine = lines.find((line) => line.startsWith("- createdAt:"));
      const pinnedLine = lines.find((line) => line.startsWith("- pinned:"));
      const parentLine = lines.find((line) => line.startsWith("- parentId:"));
      const bodyStart = lines.findIndex((line, index) => index > 0 && line.trim() === "");
      const text = lines
        .slice(bodyStart >= 0 ? bodyStart + 1 : 0)
        .filter((line) => !line.startsWith("### "))
        .join("\n")
        .trim();
      if (!text) return null;
      const id = crypto.randomUUID();
      return {
        id,
        shortId: "",
        text: text.slice(0, maxPostLength),
        pinned: pinnedLine?.includes("true") || false,
        parentId: parentLine ? parentLine.replace("- parentId:", "").trim() || null : null,
        createdAt: createdAtLine
          ? new Date(createdAtLine.replace("- createdAt:", "").trim()).toISOString()
          : new Date().toISOString(),
      };
    })
    .filter(Boolean);
}

function downloadText(text, filename, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function ensureSequentialPostIds(account) {
  const used = new Set();
  let next = 1;
  account.posts
    .slice()
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .forEach((post) => {
      if (/^\d+$/.test(post.shortId) && !used.has(post.shortId)) {
        used.add(post.shortId);
        next = Math.max(next, Number(post.shortId) + 1);
        return;
      }
      while (used.has(String(next))) next += 1;
      post.shortId = String(next);
      used.add(post.shortId);
      next += 1;
    });
}

function nextSequentialPostId(account) {
  const max = account.posts.reduce((largest, post) => {
    return /^\d+$/.test(post.shortId) ? Math.max(largest, Number(post.shortId)) : largest;
  }, 0);
  return String(max + 1);
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
