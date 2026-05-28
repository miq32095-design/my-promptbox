const STORAGE_KEY = "promptbox_prompts";
const TODO_STORAGE_KEY = "promptbox_todos";
const LOGIN_STORAGE_KEY = "promptbox_private_access_granted";
const PRIVATE_ACCESS_CODE = "0725";
const SUPABASE_URL = "https://kgzyxocfqnhyonvdkzyp.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_oILIc_FJ6so9OyB54LPe7A_4X2PHd1p";
const SUPABASE_PROMPTS_TABLE = "prompts";
const SUPABASE_TODOS_TABLE = "todos";
const SUPABASE_PROMPTS_META_ID = "__promptbox_meta__";
const LEGACY_STORAGE_KEYS = ["promptbox:data:v1", "prompts", "promptbox-data", "promptboxData"];
const DB_NAME = "PromptBoxDB";
const DB_VERSION = 1;
const PROMPT_STORE = "prompts";
const META_STORE = "meta";
const MIGRATION_META_KEY = "localStorageMigrated";
const LOCAL_STORAGE_LIMIT = 5 * 1024 * 1024;
const STORAGE_WARNING_RATIO = 0.8;
const STORAGE_BLOCK_RATIO = 0.95;
const DEFAULT_CATEGORIES = ["绘图", "写作", "PPT", "编程", "产品设计", "电商图", "其他"];

const state = {
  prompts: [],
  categories: [],
  filters: {
    query: "",
    category: "鍏ㄩ儴",
    favorite: false,
  },
  management: {
    enabled: false,
    selected: new Set(),
  },
  returnContext: null,
  todos: [],
};

const app = document.querySelector("#app");
const pageTitle = document.querySelector("#pageTitle");
const pageKicker = document.querySelector("#pageKicker");
const toast = document.querySelector("#toast");
const appShell = document.querySelector(".app-shell");
const loginView = document.querySelector("#loginView");
const loginForm = document.querySelector("#loginForm");
const loginPassword = document.querySelector("#loginPassword");
const loginError = document.querySelector("#loginError");
let dbPromise;
let saveQueue = Promise.resolve();
let todoSaveQueue = Promise.resolve();
let detailPreviewKeyHandler = null;
let supabaseClient = null;
let supabaseReady = false;
let syncWarningShown = false;
let syncStatus = "未连接";

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderFormattedPromptBody(value = "") {
  return escapeHtml(value)
    .replace(/\[large\]([\s\S]*?)\[\/large\]/g, (_, text) => `<span class="text-large">${text}</span>`)
    .replace(/\[small\]([\s\S]*?)\[\/small\]/g, (_, text) => `<span class="text-small">${text}</span>`)
    .replace(/\*\*([\s\S]*?)\*\*/g, (_, text) => `<strong>${text}</strong>`)
    .replace(/==([\s\S]*?)==/g, (_, text) => `<span class="text-highlight">${text}</span>`);
}

function icon(name) {
  const paths = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a1 1 0 0 1 1-1h9"/>',
    heart: '<path d="M20.8 4.6a5.4 5.4 0 0 0-7.6 0L12 5.8l-1.2-1.2a5.4 5.4 0 0 0-7.6 7.6L12 21l8.8-8.8a5.4 5.4 0 0 0 0-7.6Z"/>',
    pencil: '<path d="m16.9 4.7 2.4 2.4M4 20l4.8-1 10-10a1.7 1.7 0 0 0 0-2.4l-1.4-1.4a1.7 1.7 0 0 0-2.4 0l-10 10L4 20Z"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15M10 11v6M14 11v6"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
    grid: '<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/>',
    star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.2 6.4 20.2 7.5 14 3 9.6l6.2-.9Z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    more: '<path d="M12 5h.01M12 12h.01M12 19h.01"/>',
    lightbulb: '<path d="M9 18h6M10 22h4M8.5 14.5a6 6 0 1 1 7 0c-.8.6-1.5 1.6-1.5 2.5h-4c0-.9-.7-1.9-1.5-2.5Z"/>',
    sliders: '<path d="M4 7h7M15 7h5M9 5v4M4 17h5M13 17h7M15 15v4"/>',
    arrowLeft: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>',
    download: '<path d="M12 4v12M7 11l5 5 5-5M5 20h14"/>',
    cog: '<path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/><path d="M4 12h2M18 12h2M12 4v2M12 18v2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M17.7 6.3l-1.4 1.4M7.7 16.3l-1.4 1.4"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
  };

  return `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">${paths[name] || ""}</svg>`;
}

function formatDate(value) {
  if (!value) return "未更新";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatBytes(bytes = 0) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

function isSupportedImageDataUrl(value) {
  return typeof value === "string" && /^data:image\/(jpeg|png|webp);base64,/i.test(value);
}

function normalizeMindMap(mindMap = {}) {
  const nodes = Array.isArray(mindMap.nodes)
    ? mindMap.nodes
        .filter((node) => node && node.id)
        .map((node) => ({
          id: String(node.id),
          text: String(node.text || ""),
          x: Number.isFinite(Number(node.x)) ? Number(node.x) : 100,
          y: Number.isFinite(Number(node.y)) ? Number(node.y) : 100,
          locked: node.locked !== false,
          level: Number.isFinite(Number(node.level)) ? Math.max(1, Number(node.level)) : 1,
          color: typeof node.color === "string" ? node.color : "",
        }))
    : [];
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = Array.isArray(mindMap.edges)
    ? mindMap.edges
        .filter((edge) => edge && edge.id && nodeIds.has(edge.from) && nodeIds.has(edge.to))
        .map((edge) => ({
          id: String(edge.id),
          from: String(edge.from),
          to: String(edge.to),
        }))
    : [];

  return { nodes, edges };
}

function normalizePrompt(prompt = {}) {
  return {
    id: prompt.id || uid(),
    title: prompt.title || "鏈懡鍚?Prompt",
    body: prompt.body || "",
    category: prompt.category || "鍏朵粬",
    tags: Array.isArray(prompt.tags) ? prompt.tags : [],
    note: prompt.note || "",
    favorite: Boolean(prompt.favorite),
    images: Array.isArray(prompt.images) ? prompt.images.filter(isSupportedImageDataUrl) : [],
    mindMap: normalizeMindMap(prompt.mindMap),
    createdAt: prompt.createdAt || nowIso(),
    updatedAt: prompt.updatedAt || nowIso(),
  };
}

function normalizeTodo(todo = {}) {
  const priorities = ["low", "medium", "high"];
  return {
    id: todo.id || `todo_${uid()}`,
    content: String(todo.content || "").trim(),
    dueDate: todo.dueDate || "",
    priority: priorities.includes(todo.priority) ? todo.priority : "low",
    completed: Boolean(todo.completed),
    createdAt: todo.createdAt || nowIso(),
    completedAt: todo.completedAt || null,
    archived: Boolean(todo.archived),
  };
}

function isSupabaseConfigured() {
  return Boolean(
    window.supabase &&
      SUPABASE_URL &&
      SUPABASE_ANON_KEY &&
      SUPABASE_URL.startsWith("https://") &&
      SUPABASE_ANON_KEY.startsWith("sb_")
  );
}

function initSupabase() {
  if (supabaseClient || supabaseReady) return supabaseReady;
  if (!isSupabaseConfigured()) {
    syncStatus = "未配置";
    console.error("Supabase 未配置或 SDK 未加载", {
      hasSdk: Boolean(window.supabase),
      hasUrl: Boolean(SUPABASE_URL),
      hasKey: Boolean(SUPABASE_ANON_KEY),
    });
    showSyncUnavailable();
    return false;
  }

  try {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    supabaseReady = true;
    syncStatus = "已连接";
    return true;
  } catch (error) {
    console.error("Supabase 初始化失败", error);
    supabaseReady = false;
    syncStatus = "连接失败";
    showSyncUnavailable();
    return false;
  }
}

function showSyncUnavailable() {
  if (syncWarningShown) return;
  syncWarningShown = true;
  showToast("云同步失败");
}

function supabaseTable(name) {
  return initSupabase() && supabaseClient ? supabaseClient.from(name) : null;
}

function rowPayload(row = {}) {
  return row.data && typeof row.data === "object" ? row.data : row;
}

async function readSupabaseRows(name, normalizer) {
  const table = supabaseTable(name);
  if (!table) return null;

  try {
    const { data, error } = await table.select("*").limit(1000);
    if (error) throw error;
    syncStatus = "已连接";
    return (data || []).map((row) => normalizer(rowPayload(row)));
  } catch (error) {
    console.error(`读取 Supabase 表 ${name} 失败`, error);
    syncStatus = "读取失败";
    showSyncUnavailable();
    return null;
  }
}

async function readSupabasePromptData() {
  const table = supabaseTable(SUPABASE_PROMPTS_TABLE);
  if (!table) return null;

  try {
    const { data, error } = await table.select("*").limit(1000);
    if (error) throw error;
    const docs = data || [];
    const metaRow = docs.find((row) => row.id === SUPABASE_PROMPTS_META_ID);
    const meta = rowPayload(metaRow || {});
    const prompts = docs
      .filter((row) => row.id !== SUPABASE_PROMPTS_META_ID)
      .map((row) => normalizePrompt(rowPayload(row)));
    syncStatus = "已连接";
    return normalizeData({ categories: meta.categories || [], prompts });
  } catch (error) {
    console.error("读取 Supabase Prompt 数据失败", error);
    syncStatus = "读取失败";
    showSyncUnavailable();
    return null;
  }
}

async function syncSupabaseRows(name, items, normalizer) {
  const table = supabaseTable(name);
  if (!table) return false;

  try {
    const normalizedItems = items.map(normalizer);
    const { data: existingRows, error: readError } = await table.select("id").limit(1000);
    if (readError) throw readError;
    const nextIds = new Set(normalizedItems.map((item) => item.id));
    const staleIds = (existingRows || []).map((row) => row.id).filter((id) => id && !nextIds.has(id));

    await Promise.all(staleIds.map((id) => table.delete().eq("id", id)));
    if (normalizedItems.length) {
      const rows = normalizedItems.map((item) => ({ id: item.id, data: item, updated_at: nowIso() }));
      const { error } = await table.upsert(rows, { onConflict: "id" });
      if (error) throw error;
    }

    syncStatus = `已同步 ${formatDate(nowIso())}`;
    showToast("已同步");
    return true;
  } catch (error) {
    console.error(`同步 Supabase 表 ${name} 失败`, error);
    syncStatus = "同步失败";
    showSyncUnavailable();
    return false;
  }
}

async function syncSupabasePrompts(data) {
  const table = supabaseTable(SUPABASE_PROMPTS_TABLE);
  if (!table) return false;

  try {
    const normalized = normalizeData(data);
    const { data: existingRows, error: readError } = await table.select("id").limit(1000);
    if (readError) throw readError;
    const promptIds = new Set(normalized.prompts.map((prompt) => prompt.id));
    const staleIds = (existingRows || [])
      .map((row) => row.id)
      .filter((id) => id && id !== SUPABASE_PROMPTS_META_ID && !promptIds.has(id));

    await Promise.all(staleIds.map((id) => table.delete().eq("id", id)));

    const rows = normalized.prompts.map((prompt) => ({ id: prompt.id, data: prompt, updated_at: nowIso() }));
    rows.push({
      id: SUPABASE_PROMPTS_META_ID,
      data: { id: SUPABASE_PROMPTS_META_ID, type: "meta", categories: normalized.categories, updatedAt: nowIso() },
      updated_at: nowIso(),
    });

    const { error } = await table.upsert(rows, { onConflict: "id" });
    if (error) throw error;

    syncStatus = `已同步 ${formatDate(nowIso())}`;
    showToast("已同步");
    return true;
  } catch (error) {
    console.error("同步 Supabase Prompt 数据失败", error);
    syncStatus = "同步失败";
    showSyncUnavailable();
    return false;
  }
}

async function manualSync() {
  const promptsSynced = await syncSupabasePrompts(currentData());
  const todosSynced = await syncSupabaseRows(SUPABASE_TODOS_TABLE, state.todos, normalizeTodo);
  if (!promptsSynced && !todosSynced) showSyncUnavailable();
  renderSettings();
}

function isLoggedIn() {
  return localStorage.getItem(LOGIN_STORAGE_KEY) === "true";
}

function showLogin() {
  if (appShell) appShell.hidden = true;
  if (loginView) loginView.hidden = false;
  loginPassword?.focus();
}

function showAppShell() {
  if (loginView) loginView.hidden = true;
  if (appShell) appShell.hidden = false;
}

function logoutPrivateAccess() {
  localStorage.removeItem(LOGIN_STORAGE_KEY);
  showLogin();
}

async function loadTodos() {
  try {
    const supabaseTodos = await readSupabaseRows(SUPABASE_TODOS_TABLE, normalizeTodo);
    if (supabaseTodos) {
      state.todos = supabaseTodos.filter((todo) => todo.content);
      localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify(state.todos.map(normalizeTodo)));
      return;
    }

    const raw = localStorage.getItem(TODO_STORAGE_KEY);
    state.todos = raw ? JSON.parse(raw).map(normalizeTodo).filter((todo) => todo.content) : [];
  } catch (error) {
    console.error("璇诲彇 Todo 鏁版嵁澶辫触", error);
    state.todos = [];
  }
}

function saveTodos() {
  const snapshot = state.todos.map(normalizeTodo);
  localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify(snapshot));
  todoSaveQueue = todoSaveQueue
    .then(() => syncSupabaseRows(SUPABASE_TODOS_TABLE, snapshot, normalizeTodo))
    .catch((error) => {
      console.error("淇濆瓨 Todo 鏁版嵁澶辫触", error);
      showSyncUnavailable();
    });
  return todoSaveQueue;
}

function cleanupTodos() {
  const now = Date.now();
  const threeDays = 3 * 24 * 60 * 60 * 1000;
  let changed = false;

  state.todos = state.todos.map((todo) => {
    if (todo.completed && todo.completedAt && !todo.archived && now - new Date(todo.completedAt).getTime() > threeDays) {
      changed = true;
      return { ...todo, archived: true };
    }
    return todo;
  });

  if (changed) saveTodos();
}

function normalizeData(data = {}) {
  const prompts = Array.isArray(data)
    ? data.map(normalizePrompt)
    : Array.isArray(data.prompts)
      ? data.prompts.map(normalizePrompt)
      : [];
  const promptCategories = prompts.map((prompt) => prompt.category).filter(Boolean);
  const categories = Array.isArray(data.categories) && data.categories.length
    ? data.categories
    : [...DEFAULT_CATEGORIES, ...promptCategories];

  return {
    categories: [...new Set(categories)],
    prompts,
  };
}

function readStorageData(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return normalizeData(JSON.parse(raw));
  } catch (error) {
    console.error("璇诲彇 Prompt 鏁版嵁澶辫触", error);
    return null;
  }
}

function serializedData(data = currentData()) {
  const normalized = normalizeData(data);
  return JSON.stringify({
    categories: normalized.categories,
    prompts: normalized.prompts,
    exportedAt: nowIso(),
  });
}

function byteSize(value) {
  return new Blob([value || ""]).size;
}

function localStorageUsage(data = currentData()) {
  return byteSize(serializedData(data));
}

function storageRatio(data = currentData()) {
  return localStorageUsage(data) / LOCAL_STORAGE_LIMIT;
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function openDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PROMPT_STORE)) {
        db.createObjectStore(PROMPT_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

async function getMeta(key) {
  const db = await openDB();
  const transaction = db.transaction(META_STORE, "readonly");
  const done = transactionDone(transaction);
  const item = await requestToPromise(transaction.objectStore(META_STORE).get(key));
  await done;
  return item?.value;
}

async function setMeta(key, value) {
  const db = await openDB();
  const transaction = db.transaction(META_STORE, "readwrite");
  transaction.objectStore(META_STORE).put({ key, value });
  await transactionDone(transaction);
}

async function readIndexedDBData() {
  try {
    const db = await openDB();
    const transaction = db.transaction([PROMPT_STORE, META_STORE], "readonly");
    const done = transactionDone(transaction);
    const prompts = await requestToPromise(transaction.objectStore(PROMPT_STORE).getAll());
    const categoriesMeta = await requestToPromise(transaction.objectStore(META_STORE).get("categories"));
    await done;
    return prompts.length || categoriesMeta?.value
      ? normalizeData({ categories: categoriesMeta?.value || [], prompts })
      : null;
  } catch (error) {
    console.warn("IndexedDB 旧数据读取失败，已跳过迁移", error);
    return null;
  }
}

function mergeDataSets(...sets) {
  const categories = new Set(DEFAULT_CATEGORIES);
  const promptMap = new Map();

  sets.filter(Boolean).forEach((set) => {
    (set.categories || []).forEach((category) => {
      if (category) categories.add(category);
    });
    (set.prompts || []).forEach((prompt) => {
      const current = promptMap.get(prompt.id);
      if (!current || new Date(prompt.updatedAt) >= new Date(current.updatedAt)) {
        promptMap.set(prompt.id, normalizePrompt(prompt));
      }
    });
  });

  return {
    categories: [...categories],
    prompts: [...promptMap.values()],
  };
}

function currentData() {
  return {
    categories: state.categories,
    prompts: state.prompts,
  };
}

async function loadPrompts() {
  const supabaseData = await readSupabasePromptData();
  if (supabaseData) {
    const categories = [...DEFAULT_CATEGORIES, ...supabaseData.categories];
    return normalizeData({ categories, prompts: supabaseData.prompts });
  }
  return readStorageData(STORAGE_KEY);
}

async function savePrompts(data = currentData(), options = {}) {
  const normalized = normalizeData(data);
  const existing = options.mergeExisting ? await loadPrompts() : null;
  const next = options.mergeExisting ? mergeDataSets(existing, normalized) : normalized;
  const serialized = serializedData(next);

  localStorage.setItem(STORAGE_KEY, serialized);
  state.categories = next.categories;
  state.prompts = next.prompts;
  await syncSupabasePrompts(next);
  return next;
}

async function load() {
  const stableData = await loadPrompts();
  const migrated = localStorage.getItem(MIGRATION_META_KEY) === "true";
  const shouldReadOldSources = !migrated || !stableData;
  const oldSources = shouldReadOldSources ? [...LEGACY_STORAGE_KEYS.map(readStorageData), await readIndexedDBData()] : [];
  const foundData = [stableData, ...oldSources].filter((data) => data && (data.prompts.length || data.categories.length));

  if (!foundData.length) {
    state.categories = [...DEFAULT_CATEGORIES];
    state.prompts = seedPrompts();
    await savePrompts();
    localStorage.setItem(MIGRATION_META_KEY, "true");
    return;
  }

  const next = mergeDataSets(...foundData);
  state.categories = next.categories.length ? next.categories : [...DEFAULT_CATEGORIES];
  state.prompts = next.prompts;
  await savePrompts();
  localStorage.setItem(MIGRATION_META_KEY, "true");
}

function save(options = {}) {
  const snapshot = normalizeData(currentData());
  saveQueue = saveQueue
    .then(() => savePrompts(snapshot, options))
    .catch((error) => {
      console.error("淇濆瓨 Prompt 鏁版嵁澶辫触", error);
      showToast("淇濆瓨澶辫触锛岃绋嶅悗閲嶈瘯");
    });
  return saveQueue;
}

function seedPrompts() {
  const createdAt = nowIso();
  return [
    {
      id: uid(),
      title: "小红书风格视觉灵感板",
      body: "请基于主题「城市周末漫游」生成一组适合设计作业前期调研的视觉灵感描述，包含色彩、材质、构图、字体气质和版式关键词。",
      category: "产品设计",
      tags: ["灵感", "视觉", "调研"],
      note: "适合做 moodboard 前的关键词发散。",
      favorite: true,
      images: [],
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: uid(),
      title: "课程汇报 PPT 大纲",
      body: "请为主题「可持续包装设计」整理一份 10 页课程汇报 PPT 大纲，每页包含标题、核心观点和建议配图方向。",
      category: "PPT",
      tags: ["汇报", "课程", "大纲"],
      note: "",
      favorite: false,
      images: [],
      createdAt,
      updatedAt: createdAt,
    },
  ];
}

function setTitle(title) {
  pageTitle.textContent = title;
  if (pageKicker) pageKicker.textContent = title === "首页 Dashboard" ? "欢迎回来！" : "Creative Prompt Workspace";
  document.title = "PromptBox";
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2200);
}

function goBack() {
  const currentId = routeParts()[1];

  if (state.returnContext?.id === currentId && state.returnContext.route) {
    const route = state.returnContext.route;
    state.returnContext = null;
    location.hash = route;
    return;
  }

  location.hash = "#/";
}

function rememberDetailSource(route, id) {
  state.returnContext = { route: route || "#/", id };
}

async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function readImageFiles(files) {
  const images = [...files].filter((file) => ["image/jpeg", "image/png", "image/webp"].includes(file.type));

  if (images.length !== files.length) {
    showToast("浠呮敮鎸?JPG銆丳NG銆乄EBP 鍥剧墖");
  }

  return Promise.all(images.map(compressImageFile)).then((results) => {
    if (results.some((item) => item.compressed)) {
      showToast("图片已自动压缩保存");
    }
    return results.map((item) => item.dataUrl);
  });
}

function renderImagePreviews(images) {
  const wrap = document.querySelector("#imagePreviewList");
  if (!wrap) return;

  wrap.innerHTML = images.length
    ? images
        .map(
          (src, index) => `
            <div class="image-preview">
              <img src="${src}" alt="Prompt 鍥剧墖 ${index + 1}" />
              ${index === 0 ? '<span class="cover-badge">灏侀潰</span>' : ""}
              <button class="image-remove" type="button" data-remove-image="${index}">鍒犻櫎</button>
            </div>
          `
        )
        .join("")
    : '<p class="image-empty">绗竴寮犲浘鐗囦細浣滀负灏侀潰鍥?/p>';
}

function flashFormatControl(control) {
  if (!control) return;
  control.classList.add("is-active");
  setTimeout(() => control.classList.remove("is-active"), 360);
}

function wrapTextareaSelection(textarea, prefix, suffix, placeholder) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selectedText = textarea.value.slice(start, end);
  const innerText = selectedText || placeholder;
  const nextText = `${prefix}${innerText}${suffix}`;

  textarea.setRangeText(nextText, start, end, "end");
  textarea.focus();

  const innerStart = start + prefix.length;
  const innerEnd = innerStart + innerText.length;
  textarea.setSelectionRange(innerStart, innerEnd);
}

function setTextareaFontSize(textarea, size) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selectedText = textarea.value.slice(start, end);
  const cleanText = selectedText.replace(/^\[(small|large)\]([\s\S]*?)\[\/\1\]$/i, "$2");

  if (size === "default") {
    if (!selectedText) return;
    textarea.setRangeText(cleanText, start, end, "end");
    textarea.focus();
    textarea.setSelectionRange(start, start + cleanText.length);
    return;
  }

  const placeholder = size === "small" ? "小字号文字" : "大字号文字";
  const innerText = cleanText || placeholder;
  const prefix = `[${size}]`;
  const suffix = `[/${size}]`;

  textarea.setRangeText(`${prefix}${innerText}${suffix}`, start, end, "end");
  textarea.focus();
  textarea.setSelectionRange(start + prefix.length, start + prefix.length + innerText.length);
}

function bindPromptFormatToolbar() {
  const toolbar = document.querySelector("#formatToolbar");
  const textarea = document.querySelector('textarea[name="body"]');
  if (!toolbar || !textarea) return;

  toolbar.addEventListener("click", (event) => {
    const button = event.target.closest("[data-format]");
    if (!button) return;

    const format = button.dataset.format;
    if (format === "bold") wrapTextareaSelection(textarea, "**", "**", "鍔犵矖鏂囧瓧");
    if (format === "highlight") wrapTextareaSelection(textarea, "==", "==", "楂樹寒鏂囧瓧");
    if (format === "small" || format === "default" || format === "large") {
      setTextareaFontSize(textarea, format);
    }
    flashFormatControl(button);
  });
}

function mindMapLevelClass(node = {}) {
  return `level-${Math.min(4, Math.max(1, Number(node.level) || 1))}`;
}

const MIND_MAP_CANVAS_WIDTH = 2400;
const MIND_MAP_CANVAS_HEIGHT = 1400;
const MIND_MAP_NODE_WIDTH = 240;
const MIND_MAP_NODE_HEIGHT = 90;

function mindMapPath(fromNode, toNode) {
  const startX = fromNode.x + 192;
  const startY = fromNode.y + 36;
  const endX = toNode.x;
  const endY = toNode.y + 36;
  const distance = Math.max(120, Math.abs(endX - startX));
  const curve = Math.min(180, distance * 0.55);
  return `M ${startX} ${startY} C ${startX + curve} ${startY}, ${endX - curve} ${endY}, ${endX} ${endY}`;
}

function renderMindMapSvg(mindMap) {
  const nodeMap = new Map(mindMap.nodes.map((node) => [node.id, node]));
  const paths = mindMap.edges
    .map((edge) => {
      const fromNode = nodeMap.get(edge.from);
      const toNode = nodeMap.get(edge.to);
      if (!fromNode || !toNode) return "";
      return `<path class="mind-edge-path" d="${mindMapPath(fromNode, toNode)}" />`;
    })
    .join("");

  return `
    <defs>
      <linearGradient id="mindEdgeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#9bdcc4" />
        <stop offset="100%" stop-color="#9dc8ff" />
      </linearGradient>
    </defs>
    ${paths}
  `;
}

function renderMindMapNodes(mindMap, selectedId, editingId) {
  return mindMap.nodes
    .map((node) => {
      const classes = ["mind-node", mindMapLevelClass(node)];
      if (node.id === selectedId) classes.push("is-selected");
      if (node.id === editingId) classes.push("is-editing");
      const nodeId = escapeHtml(node.id);
      const content =
        node.id === editingId
          ? `<textarea class="mind-node-input" data-mind-input="${nodeId}" rows="2">${escapeHtml(node.text)}</textarea>`
          : `<div class="mind-node-text">${escapeHtml(node.text || "鍙屽嚮缂栬緫")}</div>`;

      return `
        <div class="${classes.join(" ")}" data-mind-node="${nodeId}" style="left: ${node.x}px; top: ${node.y}px;">
          ${content}
        </div>
      `;
    })
    .join("");
}

function renderReadonlyMindMap(mindMap = {}) {
  const safeMap = normalizeMindMap(mindMap);
  if (!safeMap.nodes.length) return "";
  const minX = Math.min(...safeMap.nodes.map((node) => node.x));
  const minY = Math.min(...safeMap.nodes.map((node) => node.y));
  const scrollX = Math.max(0, minX - 80);
  const scrollY = Math.max(0, minY - 80);

  return `
    <section class="mind-map-preview">
      <div class="mind-map-preview-head">
        <h3>鎬濈淮瀵煎浘棰勮</h3>
        <span>${safeMap.nodes.length} 涓妭鐐?/span>
      </div>
      <div class="mind-map-scroll mindmap-viewport mind-map-readonly" data-preview-scroll-x="${scrollX}" data-preview-scroll-y="${scrollY}">
        <div class="mind-map-canvas mindmap-canvas">
          <svg class="mind-map-lines" width="${MIND_MAP_CANVAS_WIDTH}" height="${MIND_MAP_CANVAS_HEIGHT}" viewBox="0 0 ${MIND_MAP_CANVAS_WIDTH} ${MIND_MAP_CANVAS_HEIGHT}" aria-hidden="true">
            ${renderMindMapSvg(safeMap)}
          </svg>
          ${renderMindMapNodes(safeMap, null, null)}
        </div>
      </div>
    </section>
  `;
}

function positionReadonlyMindMapPreviews() {
  document.querySelectorAll(".mind-map-readonly[data-preview-scroll-x]").forEach((viewport) => {
    viewport.scrollLeft = Number(viewport.dataset.previewScrollX) || 0;
    viewport.scrollTop = Number(viewport.dataset.previewScrollY) || 0;
  });
}

function bindReadonlyMindMapPanning() {
  document.querySelectorAll(".mind-map-readonly").forEach((viewport) => {
    let isPanning = false;
    let startX = 0;
    let startY = 0;
    let scrollLeft = 0;
    let scrollTop = 0;

    const startPan = (event) => {
      if (event.button !== undefined && event.button !== 0) return;
      isPanning = true;
      viewport.classList.add("is-panning");
      startX = event.pageX - viewport.offsetLeft;
      startY = event.pageY - viewport.offsetTop;
      scrollLeft = viewport.scrollLeft;
      scrollTop = viewport.scrollTop;
    };

    const movePan = (point, originalEvent = point) => {
      if (!isPanning) return;
      originalEvent.preventDefault?.();
      const currentX = point.pageX - viewport.offsetLeft;
      const currentY = point.pageY - viewport.offsetTop;
      viewport.scrollLeft = scrollLeft - (currentX - startX);
      viewport.scrollTop = scrollTop - (currentY - startY);
    };

    const stopPan = () => {
      isPanning = false;
      viewport.classList.remove("is-panning");
    };

    viewport.addEventListener("mousedown", startPan);
    viewport.addEventListener("mousemove", movePan);
    viewport.addEventListener("mouseup", stopPan);
    viewport.addEventListener("mouseleave", stopPan);
    viewport.addEventListener("touchstart", (event) => {
      const touch = event.touches[0];
      if (!touch) return;
      startPan(touch);
    }, { passive: true });
    viewport.addEventListener("touchmove", (event) => {
      const touch = event.touches[0];
      if (!touch) return;
      movePan(touch, event);
    }, { passive: false });
    viewport.addEventListener("touchend", stopPan);
    viewport.addEventListener("touchcancel", stopPan);
  });
}

function bindMindMapEditor(mindMap) {
  const canvas = document.querySelector("#mindMapCanvas");
  const count = document.querySelector("#mindMapCount");
  const clearButton = document.querySelector("#mindMapClear");
  if (!canvas || !count || !clearButton) return;

  let selectedId = mindMap.nodes[0]?.id || null;
  let editingId = null;
  let editingOriginalText = "";
  let dragState = null;
  const viewport = canvas.closest(".mindmap-viewport") || canvas.parentElement;

  const stopMindEvent = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const getNode = (id) => mindMap.nodes.find((node) => node.id === id);
  const clampX = (value) => Math.max(24, Math.min(MIND_MAP_CANVAS_WIDTH - MIND_MAP_NODE_WIDTH, Math.round(value)));
  const clampY = (value) => Math.max(24, Math.min(MIND_MAP_CANVAS_HEIGHT - MIND_MAP_NODE_HEIGHT, Math.round(value)));
  const getCanvasPoint = (event) => {
    const rect = viewport.getBoundingClientRect();
    return {
      x: event.clientX - rect.left + viewport.scrollLeft,
      y: event.clientY - rect.top + viewport.scrollTop,
    };
  };

  const setSelected = (id) => {
    selectedId = id;
    canvas.querySelectorAll(".mind-node.is-selected").forEach((item) => item.classList.remove("is-selected"));
    const nodeElement = [...canvas.querySelectorAll("[data-mind-node]")].find((item) => item.dataset.mindNode === id);
    if (nodeElement) nodeElement.classList.add("is-selected");
  };

  const updateLines = () => {
    const svg = canvas.querySelector(".mind-map-lines");
    if (svg) svg.innerHTML = renderMindMapSvg(mindMap);
  };

  const scrollNodeIntoView = (id) => {
    requestAnimationFrame(() => {
      const nodeElement = [...canvas.querySelectorAll("[data-mind-node]")].find((item) => item.dataset.mindNode === id);
      nodeElement?.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
  };

  const focusEditingNode = (options = {}) => {
    requestAnimationFrame(() => {
      const input = [...canvas.querySelectorAll("[data-mind-input]")].find((item) => item.dataset.mindInput === editingId);
      if (!input) return;
      input.focus({ preventScroll: true });
      input.select();
      if (options.scroll) scrollNodeIntoView(editingId);
    });
  };

  const renderMap = () => {
    canvas.innerHTML = `
      <svg class="mind-map-lines" width="${MIND_MAP_CANVAS_WIDTH}" height="${MIND_MAP_CANVAS_HEIGHT}" viewBox="0 0 ${MIND_MAP_CANVAS_WIDTH} ${MIND_MAP_CANVAS_HEIGHT}" aria-hidden="true">
        ${renderMindMapSvg(mindMap)}
      </svg>
      ${renderMindMapNodes(mindMap, selectedId, editingId)}
      <div class="mind-map-hint">双击创建节点 · Tab 创建子节点 · Enter 编辑 · Delete 删除</div>
    `;
    count.textContent = `${mindMap.nodes.length} 个节点`;
  };

  const startEditing = (id, selectText = true) => {
    const node = getNode(id);
    if (!node) return;
    selectedId = id;
    editingId = id;
    editingOriginalText = node.text;
    renderMap();
    if (selectText) focusEditingNode();
  };

  const finishEditing = (options = {}) => {
    if (!editingId) return selectedId;
    const node = getNode(editingId);
    if (node) {
      node.text = node.text.trim() || "未命名节点";
      node.locked = options.locked !== false;
    }
    selectedId = editingId;
    editingId = null;
    editingOriginalText = "";
    renderMap();
    return selectedId;
  };

  const cancelEditing = () => {
    if (!editingId) return;
    const node = getNode(editingId);
    if (node) node.text = editingOriginalText;
    selectedId = editingId;
    editingId = null;
    editingOriginalText = "";
    renderMap();
  };

  const createNode = (x, y, options = {}) => {
    const parent = options.parentId ? getNode(options.parentId) : null;
    const level = parent ? Math.min(4, (Number(parent.level) || 1) + 1) : 1;
    const node = {
      id: `node_${uid()}`,
      text: options.text || "",
      x: clampX(x),
      y: clampY(y),
      locked: Boolean(options.locked),
      level,
      color: "",
    };
    mindMap.nodes.push(node);
    selectedId = node.id;
    editingId = node.id;
    editingOriginalText = "";
    renderMap();
    focusEditingNode({ scroll: options.scroll });
    return node;
  };

  const createChildNode = (parentId) => {
    const parent = getNode(parentId);
    if (!parent) return;
    const siblingCount = mindMap.edges.filter((edge) => edge.from === parentId).length;
    const child = createNode(parent.x + 260, parent.y + 80 + siblingCount * 86, { parentId, scroll: true });
    mindMap.edges.push({ id: `edge_${uid()}`, from: parent.id, to: child.id });
    renderMap();
    focusEditingNode({ scroll: true });
  };

  const removeSelectedNode = () => {
    if (!selectedId) return;
    mindMap.nodes = mindMap.nodes.filter((node) => node.id !== selectedId);
    mindMap.edges = mindMap.edges.filter((edge) => edge.from !== selectedId && edge.to !== selectedId);
    selectedId = mindMap.nodes[0]?.id || null;
    editingId = null;
    renderMap();
  };

  canvas.addEventListener("dblclick", (event) => {
    stopMindEvent(event);
    const nodeElement = event.target.closest("[data-mind-node]");
    if (nodeElement) {
      startEditing(nodeElement.dataset.mindNode);
      return;
    }

    const point = getCanvasPoint(event);
    createNode(point.x, point.y);
  });

  canvas.addEventListener("click", (event) => {
    const nodeElement = event.target.closest("[data-mind-node]");
    if (event.target.closest("[data-mind-input]")) return;
    stopMindEvent(event);
    if (!nodeElement) {
      canvas.focus({ preventScroll: true });
      return;
    }
    editingId = null;
    renderMap();
    setSelected(nodeElement.dataset.mindNode);
    canvas.focus({ preventScroll: true });
  });

  canvas.addEventListener("input", (event) => {
    const input = event.target.closest("[data-mind-input]");
    if (!input) return;
    const node = getNode(input.dataset.mindInput);
    if (node) node.text = input.value;
  });

  canvas.addEventListener("keydown", (event) => {
    const input = event.target.closest("[data-mind-input]");
    const editingKeys = ["Tab", "Enter", "Escape", " "];
    const canvasKeys = ["Tab", "Enter", "Delete", "Backspace"];
    if (input && editingKeys.includes(event.key)) {
      stopMindEvent(event);
      if (event.key === "Escape") {
        cancelEditing();
        canvas.focus({ preventScroll: true });
        return;
      }
      if (event.key === "Tab") {
        const parentId = finishEditing({ locked: false });
        createChildNode(parentId);
        return;
      }
      finishEditing({ locked: event.key === " " });
      canvas.focus({ preventScroll: true });
      return;
    }

    if (!input && canvasKeys.includes(event.key)) {
      stopMindEvent(event);
      if (!selectedId) return;
      if (event.key === "Tab") createChildNode(selectedId);
      if (event.key === "Enter") startEditing(selectedId);
      if (event.key === "Delete" || event.key === "Backspace") removeSelectedNode();
    }
  });

  canvas.addEventListener("pointerdown", (event) => {
    if (event.target.closest("[data-mind-input]")) return;
    const nodeElement = event.target.closest("[data-mind-node]");
    if (!nodeElement) return;
    stopMindEvent(event);
    const node = getNode(nodeElement.dataset.mindNode);
    if (!node) return;
    selectedId = node.id;
    editingId = null;
    setSelected(node.id);
    canvas.focus({ preventScroll: true });
    dragState = {
      id: node.id,
      element: nodeElement,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: getCanvasPoint(event).x - node.x,
      offsetY: getCanvasPoint(event).y - node.y,
      moved: false,
    };
    nodeElement.classList.add("is-dragging");
    nodeElement.setPointerCapture?.(event.pointerId);
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!dragState) return;
    stopMindEvent(event);
    const node = getNode(dragState.id);
    if (!node) return;
    if (Math.abs(event.clientX - dragState.startX) > 2 || Math.abs(event.clientY - dragState.startY) > 2) {
      dragState.moved = true;
    }
    const point = getCanvasPoint(event);
    node.x = clampX(point.x - dragState.offsetX);
    node.y = clampY(point.y - dragState.offsetY);
    dragState.element.style.left = `${node.x}px`;
    dragState.element.style.top = `${node.y}px`;
    updateLines();
  });

  const endDrag = (event) => {
    if (!dragState) return;
    stopMindEvent(event);
    dragState.element.classList.remove("is-dragging");
    dragState = null;
  };

  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);

  clearButton.addEventListener("click", (event) => {
    stopMindEvent(event);
    mindMap.nodes = [];
    mindMap.edges = [];
    selectedId = null;
    editingId = null;
    renderMap();
  });

  renderMap();
}

function detailImageGallery(images = []) {
  if (!images.length) return "";
  const isSingle = images.length === 1;
  return `
    <div class="${isSingle ? "detail-gallery single" : "detail-gallery multi"}">
      ${images
        .map(
          (src, index) => `
            <figure class="detail-image" data-detail-image="${index}">
              <img src="${src}" alt="Prompt 鍥剧墖 ${index + 1}" />
            </figure>
          `
        )
        .join("")}
    </div>
  `;
}

function closeDetailImagePreview() {
  const modal = document.querySelector(".detail-preview-modal");
  if (modal) modal.remove();
  document.body.classList.remove("is-preview-open");
  if (detailPreviewKeyHandler) {
    document.removeEventListener("keydown", detailPreviewKeyHandler);
    detailPreviewKeyHandler = null;
  }
}

function openDetailImagePreview(images = [], startIndex = 0) {
  if (!images.length) return;

  closeDetailImagePreview();

  let currentIndex = Math.min(Math.max(startIndex, 0), images.length - 1);
  const hasMultiple = images.length > 1;
  const modal = document.createElement("div");
  modal.className = "detail-preview-modal";
  modal.innerHTML = `
    <button class="detail-preview-close" type="button" data-preview-close aria-label="Close image preview">脳</button>
    ${
      hasMultiple
        ? `<button class="detail-preview-nav detail-preview-prev" type="button" data-preview-prev aria-label="Previous image">鈥?/button>
           <button class="detail-preview-nav detail-preview-next" type="button" data-preview-next aria-label="Next image">鈥?/button>`
        : ""
    }
    <img class="detail-preview-image" alt="Prompt preview image" />
    ${hasMultiple ? '<div class="detail-preview-count"></div>' : ""}
  `;

  const image = modal.querySelector(".detail-preview-image");
  const count = modal.querySelector(".detail-preview-count");

  const updatePreview = () => {
    image.src = images[currentIndex];
    image.alt = `Prompt preview image ${currentIndex + 1}`;
    if (count) count.textContent = `${currentIndex + 1} / ${images.length}`;
  };

  const showSibling = (offset) => {
    currentIndex = (currentIndex + offset + images.length) % images.length;
    updatePreview();
  };

  modal.addEventListener("click", (event) => {
    if (event.target === modal || event.target.closest("[data-preview-close]")) {
      closeDetailImagePreview();
      return;
    }

    if (event.target.closest("[data-preview-prev]")) showSibling(-1);
    if (event.target.closest("[data-preview-next]")) showSibling(1);
  });

  detailPreviewKeyHandler = (event) => {
    if (event.key === "Escape") closeDetailImagePreview();
    if (!hasMultiple) return;
    if (event.key === "ArrowLeft") showSibling(-1);
    if (event.key === "ArrowRight") showSibling(1);
  };

  document.addEventListener("keydown", detailPreviewKeyHandler);
  document.body.appendChild(modal);
  document.body.classList.add("is-preview-open");
  updatePreview();
}

function canvasToDataUrl(canvas) {
  const webp = canvas.toDataURL("image/webp", 0.65);
  if (webp.startsWith("data:image/webp")) return webp;
  return canvas.toDataURL("image/jpeg", 0.65);
}

function compressImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, 1000 / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        context.drawImage(img, 0, 0, width, height);
        const dataUrl = canvasToDataUrl(canvas);
        const compressed = scale < 1 || byteSize(dataUrl) < file.size;
        resolve({ dataUrl, compressed });
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function dataWithDraftImages(editing, draftImages) {
  const prompts = editing
    ? state.prompts.map((prompt) => (prompt.id === editing.id ? { ...prompt, images: draftImages } : prompt))
    : [
        ...state.prompts,
        normalizePrompt({
          title: "鍥剧墖涓婁紶棰勪及",
          body: "",
          category: state.categories[0] || "鍏朵粬",
          images: draftImages,
        }),
      ];

  return {
    categories: state.categories,
    prompts,
  };
}

function routeParts() {
  const hash = location.hash.replace(/^#/, "") || "/";
  return hash.split("/").filter(Boolean);
}

function pathName() {
  const parts = routeParts();
  return `/${parts[0] || ""}`;
}

function updateActiveNav() {
  const active = pathName();
  document.querySelectorAll("[data-route]").forEach((item) => {
    item.classList.toggle("active", item.dataset.route === active);
  });
}

function filteredPrompts(limit) {
  const q = state.filters.query.trim().toLowerCase();
  const items = state.prompts
    .filter((prompt) => {
      const text = [prompt.title, prompt.body, ...(prompt.tags || [])].join(" ").toLowerCase();
      const matchQuery = !q || text.includes(q);
      const matchCategory =
        state.filters.category === "鍏ㄩ儴" || prompt.category === state.filters.category;
      const matchFavorite = !state.filters.favorite || prompt.favorite;
      return matchQuery && matchCategory && matchFavorite;
    })
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  return typeof limit === "number" ? items.slice(0, limit) : items;
}

function categoryCounts() {
  return state.categories.map((name) => ({
    name,
    count: state.prompts.filter((prompt) => prompt.category === name).length,
  }));
}

function render() {
  closeDetailImagePreview();
  updateActiveNav();
  const parts = routeParts();
  const route = parts[0] || "";
  const id = parts[1];

  if (route === "prompts") return renderPromptList();
  if (route === "edit") return renderEdit(id);
  if (route === "detail") return renderDetail(id);
  if (route === "categories") return renderCategories();
  if (route === "settings") return renderSettings();
  return renderDashboard();
}

function promptCard(prompt, options = {}) {
  const management = Boolean(options.management);
  const source = options.source || "#/prompts";
  const selected = state.management.selected.has(prompt.id);
  const tags = (prompt.tags || []).map((tag) => `<span class="tag">#${escapeHtml(tag)}</span>`).join("");
  const cover = prompt.images?.[0];
  const element = management ? "div" : "a";
  const attrs = management
    ? `data-prompt-id="${prompt.id}"`
    : `href="#/detail/${prompt.id}" onclick="rememberDetailSource('${source}', '${prompt.id}')"`;

  return `
    <${element} class="prompt-item ${cover ? "has-cover" : ""} ${management ? "is-managing" : ""}" ${attrs}>
      ${
        management
          ? `<label class="manage-check" aria-label="閫夋嫨 ${escapeHtml(prompt.title)}">
              <input type="checkbox" data-manage-checkbox="${prompt.id}" ${selected ? "checked" : ""} />
            </label>`
          : ""
      }
      ${cover ? `<div class="prompt-cover"><img src="${cover}" alt="${escapeHtml(prompt.title)} 灏侀潰" /></div>` : ""}
      <div class="prompt-card-main">
        <div class="prompt-head">
          <div>
            <h3 class="prompt-title">${escapeHtml(prompt.title)}</h3>
            <div class="prompt-meta">
              <span class="pill">${escapeHtml(prompt.category || "鍏朵粬")}</span>
              <span>鏇存柊浜?${formatDate(prompt.updatedAt)}</span>
            </div>
          </div>
          <span class="${prompt.favorite ? "favorite" : "muted"}">${prompt.favorite ? "已收藏" : "未收藏"}</span>
        </div>
        <div class="tag-row">${tags || '<span class="muted">鏆傛棤鏍囩</span>'}</div>
      </div>
    </${element}>
  `;
}

function dashboardPromptCard(prompt, index) {
  const tags = (prompt.tags || []).slice(0, 3).map((tag) => `<span class="tag">#${escapeHtml(tag)}</span>`).join("");
  const cover = prompt.images?.[0];
  const fallback = `<div class="dashboard-thumb-fallback thumb-${index % 4}"></div>`;

  return `
    <a class="dashboard-prompt" href="#/detail/${prompt.id}" onclick="rememberDetailSource('#/', '${prompt.id}')">
      <div class="dashboard-thumb">${cover ? `<img src="${cover}" alt="${escapeHtml(prompt.title)} 灏侀潰" />` : fallback}</div>
      <div class="dashboard-prompt-main">
        <h3>${escapeHtml(prompt.title)}</h3>
        <div class="prompt-meta">
          <span class="pill">${escapeHtml(prompt.category || "鍏朵粬")}</span>
          <span>鏇存柊浜?${formatDate(prompt.updatedAt)}</span>
        </div>
        <div class="tag-row">${tags || '<span class="muted">鏆傛棤鏍囩</span>'}</div>
      </div>
      <button class="mini-icon ${prompt.favorite ? "is-active" : ""}" type="button" aria-label="鏀惰棌">${icon("star")}</button>
      <button class="mini-icon" type="button" aria-label="鏇村">${icon("more")}</button>
    </a>
  `;
}

function todoPriorityLabel(priority) {
  const labels = { low: "普通", medium: "重要", high: "紧急" };
  return labels[priority] || labels.low;
}

function todoPriorityRank(priority) {
  return { high: 3, medium: 2, low: 1 }[priority] || 1;
}

function formatTodoDate(value) {
  if (!value) return "无截止";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "无截止";
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit" }).format(date);
}

function visibleTodos() {
  return state.todos
    .filter((todo) => !todo.archived)
    .sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      const priorityDiff = todoPriorityRank(b.priority) - todoPriorityRank(a.priority);
      if (priorityDiff) return priorityDiff;
      const aDue = a.dueDate ? new Date(`${a.dueDate}T00:00:00`).getTime() : Infinity;
      const bDue = b.dueDate ? new Date(`${b.dueDate}T00:00:00`).getTime() : Infinity;
      if (aDue !== bDue) return aDue - bDue;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
}

function completedTodos(limit = 5) {
  return state.todos
    .filter((todo) => todo.completed && todo.completedAt)
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
    .slice(0, limit);
}

function todoItem(todo) {
  return `
    <li class="todo-item ${todo.completed ? "is-completed" : ""}">
      <button class="todo-check" type="button" data-todo-toggle="${todo.id}" aria-label="鍒囨崲浠诲姟瀹屾垚鐘舵€?>
        <span>${todo.completed ? "✓" : ""}</span>
      </button>
      <div class="todo-main">
        <p>${escapeHtml(todo.content)}</p>
        <div class="todo-meta">
          <span>鎴 ${escapeHtml(formatTodoDate(todo.dueDate))}</span>
          <span class="todo-priority priority-${todo.priority}">${todoPriorityLabel(todo.priority)}</span>
        </div>
      </div>
      <button class="todo-delete" type="button" data-todo-delete="${todo.id}" aria-label="鍒犻櫎浠诲姟">${icon("trash")}</button>
    </li>
  `;
}

function todoTimelineItem(todo) {
  return `
    <li class="todo-timeline-item">
      <span class="timeline-dot priority-${todo.priority}"></span>
      <div>
        <time>${formatDate(todo.completedAt)}</time>
        <p>${escapeHtml(todo.content)}</p>
        <div class="todo-meta">
          <span class="todo-priority priority-${todo.priority}">${todoPriorityLabel(todo.priority)}</span>
          <span>鎴 ${escapeHtml(formatTodoDate(todo.dueDate))}</span>
        </div>
      </div>
    </li>
  `;
}

function renderTodoDashboard() {
  const todos = visibleTodos();
  const timeline = completedTodos(5);

  return `
    <section class="card card-pad todo-board">
      <div class="section-head todo-board-head">
        <div>
          <h2>浠婃棩寰呭姙 Todo List</h2>
          <p>鑱氱劍浣犲綋鍓嶆渶閲嶈鐨勫垱浣滀换鍔?/p>
        </div>
      </div>
      <div class="todo-layout">
        <div class="todo-list-panel">
          <form class="todo-form" id="todoForm">
            <input class="field todo-input" name="content" maxlength="120" placeholder="杈撳叆寰呭姙浠诲姟..." />
            <input class="field todo-date" name="dueDate" type="date" />
            <select class="select todo-priority-select" name="priority">
              <option value="low">鏅€?/option>
              <option value="medium">閲嶈</option>
              <option value="high">绱ф€?/option>
            </select>
            <button class="button todo-add" type="submit">${icon("plus")}娣诲姞浠诲姟</button>
          </form>
          <div class="todo-list-scroll">
            <ul class="todo-list">
              ${todos.length ? todos.map(todoItem).join("") : '<li class="todo-empty">浠婂ぉ杩樻病鏈夊緟鍔炰换鍔?/li>'}
            </ul>
          </div>
        </div>
        <aside class="todo-timeline-panel">
          <h3>瀹屾垚鏃堕棿杞?/h3>
          <div class="todo-timeline-scroll">
            ${
              timeline.length
                ? `<ol class="todo-timeline">${timeline.map(todoTimelineItem).join("")}</ol>`
                : '<div class="todo-timeline-empty">瀹屾垚浠诲姟鍚庯紝杩欓噷浼氱敓鎴愭椂闂磋酱銆?/div>'
            }
          </div>
        </aside>
      </div>
    </section>
  `;
}

function bindTodoDashboard() {
  const form = document.querySelector("#todoForm");
  const board = document.querySelector(".todo-board");
  if (!form || !board) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const content = String(data.get("content") || "").trim();
    if (!content) {
      showToast("请输入待办任务内容");
      return;
    }

    state.todos.unshift(
      normalizeTodo({
        content,
        dueDate: data.get("dueDate"),
        priority: data.get("priority"),
        createdAt: nowIso(),
      })
    );
    saveTodos();
    renderDashboard();
  });

  board.addEventListener("click", (event) => {
    const toggle = event.target.closest("[data-todo-toggle]");
    const deleteButton = event.target.closest("[data-todo-delete]");

    if (toggle) {
      const todo = state.todos.find((item) => item.id === toggle.dataset.todoToggle);
      if (!todo) return;
      todo.completed = !todo.completed;
      todo.completedAt = todo.completed ? nowIso() : null;
      todo.archived = false;
      saveTodos();
      renderDashboard();
      return;
    }

    if (deleteButton) {
      if (!confirm("纭畾鍒犻櫎杩欎釜浠诲姟鍚楋紵")) return;
      state.todos = state.todos.filter((todo) => todo.id !== deleteButton.dataset.todoDelete);
      saveTodos();
      renderDashboard();
    }
  });
}

function renderDashboard() {
  setTitle("棣栭〉 Dashboard");
  const recent = [...state.prompts].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0];
  const favCount = state.prompts.filter((prompt) => prompt.favorite).length;
  const topCategory = categoryCounts().sort((a, b) => b.count - a.count)[0];
  const list = filteredPrompts(2);
  const maxCount = Math.max(...categoryCounts().map((item) => item.count), 1);
  const categoryColors = ["#7EDDD0", "#BFE58D", "#F7D66B", "#FF8D86", "#C7A6F8", "#8CC9FF", "#FF9BB3"];

  app.innerHTML = `
    ${renderTodoDashboard()}
    <div class="grid stats-grid dashboard-stats">
      <article class="card stat stat-mint"><span class="stat-icon">${icon("file")}</span><div><span>Prompt 总数</span><strong>${state.prompts.length}</strong></div></article>
      <article class="card stat stat-green"><span class="stat-icon">${icon("heart")}</span><div><span>收藏数量</span><strong>${favCount}</strong></div></article>
      <article class="card stat stat-yellow"><span class="stat-icon">${icon("clock")}</span><div><span>最近更新</span><strong>${recent ? formatDate(recent.updatedAt) : "无"}</strong></div></article>
      <article class="card stat stat-pink"><span class="stat-icon">${icon("grid")}</span><div><span>常用分类</span><strong>${topCategory?.count ? escapeHtml(topCategory.name) : "无"}</strong></div></article>
    </div>
    <div class="grid dashboard-main-grid">
      <section class="card card-pad recent-card">
        <div class="section-head">
          <h2>最近 Prompt</h2>
          <a class="ghost-button" href="#/prompts">${icon("search")}查看全部</a>
        </div>
        <div class="dashboard-prompt-list">
          ${list.length ? list.map(dashboardPromptCard).join("") : empty("还没有 Prompt")}
        </div>
      </section>
      <section class="card card-pad category-card">
        <h2>鍒嗙被鍒嗗竷</h2>
        <div class="category-list">
          ${categoryCounts()
            .map(
              (item) => `
                <div class="category-progress-row">
                  <div class="prompt-head">
                    <strong>${escapeHtml(item.name)}</strong>
                    <span class="muted">${item.count}</span>
                  </div>
                  <div class="progress"><span style="width:${(item.count / maxCount) * 100}%; background:${categoryColors[categoryCounts().findIndex((cat) => cat.name === item.name) % categoryColors.length]}"></span></div>
                </div>
              `
            )
            .join("")}
        </div>
      </section>
    </div>
    <div class="grid dashboard-bottom-grid">
      <section class="card card-pad quick-card">
        <h2>蹇€熸搷浣?/h2>
        <div class="quick-actions">
          <a href="#/edit" class="quick-action qa-mint">${icon("plus")}<span>鏂板缓 Prompt</span></a>
          <a href="#/settings" class="quick-action qa-green">${icon("upload")}<span>瀵煎叆 Prompt</span></a>
          <a href="#/settings" class="quick-action qa-yellow">${icon("download")}<span>瀵煎嚭鏁版嵁</span></a>
          <a href="#/categories" class="quick-action qa-orange">${icon("folder")}<span>鍒嗙被绠＄悊</span></a>
          <a href="#/settings" class="quick-action qa-purple">${icon("cog")}<span>璁剧疆</span></a>
        </div>
      </section>
      <section class="card card-pad tips-card">
        <h2>${icon("lightbulb")}浣跨敤灏忚创澹?/h2>
        <p>鐐瑰嚮 ${icon("star")} 鏀惰棌閲嶈鐨?Prompt锛屾柟渚垮揩閫熸煡鎵?/p>
        <p>浣跨敤鍒嗙被绠＄悊锛岃浣犵殑 Prompt 浜曚簳鏈夋潯</p>
        <p>鏀寔鍥剧墖涓婁紶锛岃 Prompt 鏇寸敓鍔ㄧ洿瑙?/p>
      </section>
    </div>
    <p class="made-with-love">鉂わ笍 Made with love by PromptBox</p>
  `;

  bindTodoDashboard();
}

function renderPromptList() {
  setTitle("Prompt 鍒楄〃");
  const existingIds = new Set(state.prompts.map((prompt) => prompt.id));
  state.management.selected.forEach((id) => {
    if (!existingIds.has(id)) state.management.selected.delete(id);
  });
  const items = filteredPrompts();
  const selectedCount = state.management.selected.size;
  app.innerHTML = `
    <section class="card card-pad">
      <div class="toolbar">
        <input class="field search-field" id="searchInput" placeholder="鎼滅储鏍囬銆佹鏂囥€佹爣绛? value="${escapeHtml(state.filters.query)}" />
        <select class="select" id="categoryFilter">
          <option>鍏ㄩ儴</option>
          ${state.categories.map((name) => `<option ${state.filters.category === name ? "selected" : ""}>${escapeHtml(name)}</option>`).join("")}
        </select>
        <button class="ghost-button" id="favoriteFilter">${icon("heart")}${state.filters.favorite ? "鍏ㄩ儴 Prompt" : "鍙湅鏀惰棌"}</button>
        <button class="ghost-button" id="manageToggle">${icon("sliders")}${state.management.enabled ? "鍙栨秷绠＄悊" : "绠＄悊"}</button>
      </div>
      ${
        state.management.enabled
          ? `<div class="bulk-bar">
              <strong>宸查€夋嫨 ${selectedCount} 椤?/strong>
              <button class="ghost-button" id="selectAllBtn">${icon("check")}鍏ㄩ€?/button>
              <button class="ghost-button" id="clearSelectBtn">${icon("x")}鍙栨秷閫夋嫨</button>
              <button class="danger-button" id="deleteSelectedBtn" ${selectedCount ? "" : "disabled"}>${icon("trash")}鍒犻櫎鎵€閫?/button>
            </div>`
          : ""
      }
    </section>
    <section class="prompt-list">
      ${items.length ? items.map((prompt) => promptCard(prompt, { source: "#/prompts", management: state.management.enabled })).join("") : empty("娌℃湁鍖归厤鐨?Prompt")}
    </section>
  `;

  document.querySelector("#searchInput").addEventListener("input", (event) => {
    state.filters.query = event.target.value;
    renderPromptList();
  });
  document.querySelector("#categoryFilter").addEventListener("change", (event) => {
    state.filters.category = event.target.value;
    renderPromptList();
  });
  document.querySelector("#favoriteFilter").addEventListener("click", () => {
    state.filters.favorite = !state.filters.favorite;
    renderPromptList();
  });
  document.querySelector("#manageToggle").addEventListener("click", () => {
    state.management.enabled = !state.management.enabled;
    state.management.selected.clear();
    renderPromptList();
  });

  if (!state.management.enabled) return;

  document.querySelectorAll("[data-manage-checkbox]").forEach((checkbox) => {
    checkbox.addEventListener("change", (event) => {
      const id = event.target.dataset.manageCheckbox;
      if (event.target.checked) {
        state.management.selected.add(id);
      } else {
        state.management.selected.delete(id);
      }
      renderPromptList();
    });
  });

  document.querySelector("#selectAllBtn").addEventListener("click", () => {
    items.forEach((prompt) => state.management.selected.add(prompt.id));
    renderPromptList();
  });

  document.querySelector("#clearSelectBtn").addEventListener("click", () => {
    state.management.selected.clear();
    renderPromptList();
  });

  document.querySelector("#deleteSelectedBtn").addEventListener("click", () => {
    if (!state.management.selected.size) return;
    if (!confirm("确定删除选中的 Prompt 吗？此操作不可恢复。")) return;
    const selectedIds = new Set(state.management.selected);
    state.prompts = state.prompts.filter((prompt) => !selectedIds.has(prompt.id));
    state.management.selected.clear();
    save();
    showToast("宸插垹闄ゆ墍閫?Prompt");
    renderPromptList();
  });
}

function renderEdit(id) {
  const editing = state.prompts.find((prompt) => prompt.id === id);
  if (!editing) state.returnContext = null;
  setTitle(editing ? "缂栬緫 Prompt" : "鏂板缓 Prompt");
  const prompt = editing || {
    title: "",
    body: "",
    category: state.categories[0] || "鍏朵粬",
    tags: [],
    note: "",
    favorite: false,
    images: [],
    mindMap: { nodes: [], edges: [] },
  };
  let draftImages = [...(prompt.images || [])];
  const draftMindMap = normalizeMindMap(prompt.mindMap);

  app.innerHTML = `
    <form class="card card-pad form" id="promptForm">
      <label class="label">鏍囬
        <input class="field" name="title" required maxlength="80" value="${escapeHtml(prompt.title)}" />
      </label>
      <label class="label">姝ｆ枃
        <div class="format-toolbar" id="formatToolbar" aria-label="姝ｆ枃鏍煎紡宸ュ叿鏍?>
          <button class="format-button format-bold" type="button" data-format="bold" title="鍔犵矖">B</button>
          <button class="format-button" type="button" data-format="highlight" title="楂樹寒">楂樹寒</button>
          <span class="format-divider"></span>
          <span class="format-label">瀛楀彿</span>
          <button class="format-button" type="button" data-format="small">灏?/button>
          <button class="format-button" type="button" data-format="default">榛樿</button>
          <button class="format-button" type="button" data-format="large">澶?/button>
        </div>
        <textarea class="textarea" name="body" required>${escapeHtml(prompt.body)}</textarea>
      </label>
      <section class="mind-map-panel">
        <div class="mind-map-head">
          <div>
            <h3>鎬濈淮瀵煎浘</h3>
            <p>鍙屽嚮绌虹櫧澶勫垱寤鸿妭鐐癸紝杈撳叆鏂囧瓧鍚庢寜绌烘牸閿佸畾锛屾寜 Tab 鍒涘缓瀛愯妭鐐广€?/p>
          </div>
          <div class="mind-map-tools">
            <span id="mindMapCount">0 涓妭鐐?/span>
            <button class="ghost-button" id="mindMapClear" type="button">娓呯┖瀵煎浘</button>
          </div>
        </div>
        <div class="mind-map-scroll mindmap-viewport">
          <div class="mind-map-canvas mindmap-canvas" id="mindMapCanvas" tabindex="0" aria-label="鎬濈淮瀵煎浘鐢诲竷"></div>
        </div>
      </section>
      <section class="label image-field">涓婁紶鍥剧墖
        <label class="image-upload-card" for="imageInput">
          <span>+ 娣诲姞鍥剧墖</span>
          <small>鏀寔 JPG銆丳NG銆乄EBP锛屽彲閫夋嫨澶氬紶</small>
        </label>
        <input class="file-input" id="imageInput" type="file" accept="image/jpeg,image/png,image/webp" multiple />
        <div class="image-preview-list" id="imagePreviewList"></div>
      </section>
      <div class="form-row">
        <label class="label">鍒嗙被
          <select class="select" name="category">
            ${state.categories.map((name) => `<option ${prompt.category === name ? "selected" : ""}>${escapeHtml(name)}</option>`).join("")}
          </select>
        </label>
        <label class="label">鏍囩
          <input class="field" name="tags" placeholder="鐢ㄩ€楀彿鍒嗛殧" value="${escapeHtml((prompt.tags || []).join(", "))}" />
        </label>
      </div>
      <label class="label">澶囨敞
        <textarea class="textarea" name="note">${escapeHtml(prompt.note || "")}</textarea>
      </label>
      <label class="label">
        <span><input type="checkbox" name="favorite" ${prompt.favorite ? "checked" : ""} /> 鏀惰棌</span>
      </label>
      <div class="actions">
        <button class="button" type="submit">${icon("check")}淇濆瓨</button>
        <a class="ghost-button" href="${editing ? `#/detail/${editing.id}` : "#/prompts"}">鍙栨秷</a>
      </div>
    </form>
  `;

  renderImagePreviews(draftImages);
  bindPromptFormatToolbar();
  bindMindMapEditor(draftMindMap);

  document.querySelector("#imageInput").addEventListener("change", async (event) => {
    const nextImages = await readImageFiles(event.target.files || []);
    const candidateImages = [...draftImages, ...nextImages];
    if (storageRatio(dataWithDraftImages(editing, candidateImages)) > STORAGE_BLOCK_RATIO) {
      showToast("本地存储空间不足，请先导出备份或删除部分图片。");
      event.target.value = "";
      return;
    }
    draftImages = candidateImages;
    if (editing) {
      editing.images = draftImages;
      editing.updatedAt = nowIso();
      save({ mergeExisting: true });
    }
    event.target.value = "";
    renderImagePreviews(draftImages);
  });

  document.querySelector("#imagePreviewList").addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-image]");
    if (!button) return;
    draftImages = draftImages.filter((_, index) => index !== Number(button.dataset.removeImage));
    if (editing) {
      editing.images = draftImages;
      editing.updatedAt = nowIso();
      save({ mergeExisting: true });
    }
    renderImagePreviews(draftImages);
  });

  document.querySelector("#promptForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = {
      title: form.get("title").trim(),
      body: form.get("body").trim(),
      category: form.get("category"),
      tags: form
        .get("tags")
        .split(/[,，]/)
        .map((tag) => tag.trim())
        .filter(Boolean),
      note: form.get("note").trim(),
      favorite: form.get("favorite") === "on",
      images: draftImages,
      mindMap: normalizeMindMap(draftMindMap),
      updatedAt: nowIso(),
    };

    if (editing) {
      Object.assign(editing, next);
      showToast("已更新");
      save({ mergeExisting: true });
      location.hash = `#/detail/${editing.id}`;
      return;
    }

    const created = {
      id: uid(),
      ...next,
      createdAt: nowIso(),
    };
    state.prompts.unshift(created);
    save({ mergeExisting: true });
    showToast("已保存");
    location.hash = `#/detail/${created.id}`;
  });
}

function renderDetail(id) {
  const prompt = state.prompts.find((item) => item.id === id);
  if (!prompt) {
    setTitle("Prompt 璇︽儏");
    app.innerHTML = empty("这个 Prompt 不存在");
    return;
  }

  setTitle(prompt.title);
  app.innerHTML = `
    <article class="card card-pad detail-card">
      <button class="back-button" id="backBtn" type="button">${icon("arrowLeft")}杩斿洖</button>
      <div class="detail-top">
        <div>
          <h2 class="detail-title">${escapeHtml(prompt.title)}</h2>
        </div>
        <div class="actions">
          <button class="icon-button" id="copyBtn">${icon("copy")}澶嶅埗</button>
          <button class="favorite-button ${prompt.favorite ? "is-active" : ""}" id="favoriteBtn">${icon("heart")}${prompt.favorite ? "已收藏" : "收藏"}</button>
        </div>
      </div>
      ${detailImageGallery(prompt.images)}
      <div class="prompt-meta detail-meta">
        <span class="pill">${escapeHtml(prompt.category)}</span>
        <span>鏇存柊浜?${formatDate(prompt.updatedAt)}</span>
        <span class="favorite-state ${prompt.favorite ? "is-active" : ""}">${prompt.favorite ? "已收藏" : "未收藏"}</span>
      </div>
      <div class="tag-row">${(prompt.tags || []).map((tag) => `<span class="tag">#${escapeHtml(tag)}</span>`).join("")}</div>
      <div class="detail-content-stack">
        <section class="detail-reading-card detail-body">${renderFormattedPromptBody(prompt.body)}</section>
        ${renderReadonlyMindMap(prompt.mindMap)}
      </div>
      ${prompt.note ? `<div class="detail-note"><h3>澶囨敞</h3><div class="note-box">${escapeHtml(prompt.note)}</div></div>` : ""}
      <div class="actions">
        <a class="button" href="#/edit/${prompt.id}">${icon("pencil")}缂栬緫</a>
        <button class="danger-button" id="deleteBtn">${icon("trash")}鍒犻櫎</button>
      </div>
    </article>
  `;

  positionReadonlyMindMapPreviews();
  bindReadonlyMindMapPanning();
  document.querySelector("#backBtn").addEventListener("click", goBack);
  document.querySelector(".detail-gallery")?.addEventListener("click", (event) => {
    const item = event.target.closest("[data-detail-image]");
    if (!item) return;
    openDetailImagePreview(prompt.images || [], Number(item.dataset.detailImage) || 0);
  });
  document.querySelector("#copyBtn").addEventListener("click", async () => {
    const button = document.querySelector("#copyBtn");
    await copyText(prompt.body);
    button.innerHTML = `${icon("check")}已复制`;
    button.classList.add("is-copied");
    showToast("Prompt 正文已复制");
    setTimeout(() => {
      button.innerHTML = `${icon("copy")}复制`;
      button.classList.remove("is-copied");
    }, 1400);
  });
  document.querySelector("#favoriteBtn").addEventListener("click", () => {
    prompt.favorite = !prompt.favorite;
    prompt.updatedAt = nowIso();
    save({ mergeExisting: true });
    renderDetail(id);
  });
  document.querySelector("#deleteBtn").addEventListener("click", () => {
    if (!confirm("纭畾鍒犻櫎杩欎釜 Prompt 鍚楋紵")) return;
    state.prompts = state.prompts.filter((item) => item.id !== id);
    save();
    showToast("已删除");
    location.hash = "#/prompts";
  });
}

function renderCategories() {
  setTitle("鍒嗙被绠＄悊");
  app.innerHTML = `
    <section class="card card-pad form">
      <form class="toolbar" id="categoryForm">
        <input class="field" name="name" maxlength="16" placeholder="鏂板鍒嗙被鍚嶇О" />
        <button class="button" type="submit">${icon("plus")}娣诲姞鍒嗙被</button>
        <a class="ghost-button" href="#/prompts">${icon("arrowLeft")}杩斿洖鍒楄〃</a>
      </form>
      <div class="category-list">
        ${state.categories
          .map(
            (name) => `
              <div class="category-item">
                <input class="field" data-category-input="${escapeHtml(name)}" value="${escapeHtml(name)}" />
                <span class="muted">${state.prompts.filter((prompt) => prompt.category === name).length} 鏉?/span>
                <button class="danger-button" data-delete-category="${escapeHtml(name)}">${icon("trash")}鍒犻櫎</button>
              </div>
            `
          )
          .join("")}
      </div>
    </section>
  `;

  document.querySelector("#categoryForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const name = new FormData(event.currentTarget).get("name").trim();
    if (!name) return;
    if (state.categories.includes(name)) {
      showToast("分类已存在");
      return;
    }
    state.categories.push(name);
    save();
    showToast("分类已添加");
    renderCategories();
  });

  document.querySelectorAll("[data-category-input]").forEach((input) => {
    input.addEventListener("change", () => renameCategory(input.dataset.categoryInput, input.value.trim()));
  });

  document.querySelectorAll("[data-delete-category]").forEach((button) => {
    button.addEventListener("click", () => deleteCategory(button.dataset.deleteCategory));
  });
}

function renameCategory(oldName, newName) {
  if (!newName || oldName === newName) {
    renderCategories();
    return;
  }
  if (state.categories.includes(newName)) {
    showToast("分类已存在");
    renderCategories();
    return;
  }
  state.categories = state.categories.map((name) => (name === oldName ? newName : name));
  state.prompts.forEach((prompt) => {
    if (prompt.category === oldName) prompt.category = newName;
  });
  save();
  showToast("分类已重命名");
  renderCategories();
}

function deleteCategory(name) {
  if (state.categories.length <= 1) {
    showToast("至少保留一个分类");
    return;
  }
  if (!confirm(`删除分类「${name}」？该分类下的 Prompt 会移动到「其他」。`)) return;
  if (!state.categories.includes("其他")) state.categories.push("其他");
  state.categories = state.categories.filter((item) => item !== name);
  state.prompts.forEach((prompt) => {
    if (prompt.category === name) prompt.category = "其他";
  });
  save();
  showToast("分类已删除");
  renderCategories();
}

async function uploadLocalDataToSupabase() {
  const localPrompts = readStorageData(STORAGE_KEY);
  let localTodos = [];

  try {
    const rawTodos = localStorage.getItem(TODO_STORAGE_KEY);
    localTodos = rawTodos ? JSON.parse(rawTodos).map(normalizeTodo).filter((todo) => todo.content) : [];
  } catch (error) {
    console.error("璇诲彇鏈湴 Todo 杩佺Щ鏁版嵁澶辫触", error);
  }

  const mergedPrompts = mergeDataSets(currentData(), localPrompts);
  const todoMap = new Map(state.todos.map((todo) => [todo.id, normalizeTodo(todo)]));
  localTodos.forEach((todo) => {
    if (!todoMap.has(todo.id)) todoMap.set(todo.id, normalizeTodo(todo));
  });

  state.categories = mergedPrompts.categories;
  state.prompts = mergedPrompts.prompts;
  state.todos = [...todoMap.values()];
  localStorage.setItem(STORAGE_KEY, serializedData(currentData()));
  localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify(state.todos.map(normalizeTodo)));

  const promptsSynced = await syncSupabasePrompts(currentData());
  const todosSynced = await syncSupabaseRows(SUPABASE_TODOS_TABLE, state.todos, normalizeTodo);

  if (promptsSynced || todosSynced) {
    showToast("本地数据已上传到云端");
  }
}

function renderSettings() {
  setTitle("璁剧疆");
  const usage = localStorageUsage();
  const usagePercent = Math.round((usage / LOCAL_STORAGE_LIMIT) * 100);
  app.innerHTML = `
    <section class="grid content-grid">
      <div class="card card-pad form">
        <h2>鏁版嵁澶囦唤</h2>
        <div class="actions">
          <button class="button" id="exportBtn">${icon("download")}瀵煎嚭鏁版嵁</button>
          <label class="ghost-button" for="importFile">${icon("upload")}瀵煎叆鏁版嵁</label>
          <input class="file-input" id="importFile" type="file" accept="application/json,.json" />
        </div>
      </div>
      <div class="card card-pad form">
        <h2>鏈湴鏁版嵁</h2>
        <p class="muted">褰撳墠娴忚鍣ㄥ唴鍏辨湁 ${state.prompts.length} 鏉?Prompt锛?{state.categories.length} 涓垎绫汇€?/p>
        <div class="storage-debug">
          <span>褰撳墠瀛樺偍鏉℃暟锛?{state.prompts.length}</span>
          <span>褰撳墠 storage key锛?{STORAGE_KEY}</span>
          <span>褰撳墠宸蹭娇鐢細${formatBytes(usage)} / 5 MB锛?{usagePercent}%锛?/span>
          <div class="storage-meter"><span style="width:${Math.min(usagePercent, 100)}%"></span></div>
          ${
            usagePercent >= STORAGE_WARNING_RATIO * 100
              ? '<strong class="storage-warning">鏈湴瀛樺偍绌洪棿杈冮珮锛屽缓璁鍑哄浠芥垨鍒犻櫎閮ㄥ垎鍥剧墖銆?/strong>'
              : ""
          }
        </div>
        <div class="storage-debug">
          <span>云同步状态：${escapeHtml(syncStatus)}</span>
        </div>
        <button class="ghost-button" id="testSaveBtn">${icon("check")}娴嬭瘯淇濆瓨</button>
        <button class="ghost-button" id="manualSyncBtn">${icon("check")}手动同步</button>
        <button class="ghost-button" id="uploadLocalBtn">${icon("upload")}上传本地数据到云端</button>
        <button class="ghost-button" id="logoutBtn">${icon("x")}閫€鍑虹櫥褰?/button>
        <button class="danger-button" id="clearBtn">${icon("trash")}娓呯┖鏈湴鏁版嵁</button>
      </div>
    </section>
  `;

  document.querySelector("#exportBtn").addEventListener("click", exportJson);
  document.querySelector("#importFile").addEventListener("change", importJson);
  document.querySelector("#testSaveBtn").addEventListener("click", () => {
    const createdAt = nowIso();
    state.prompts.unshift(
      normalizePrompt({
        id: uid(),
        title: `娴嬭瘯淇濆瓨 ${formatDate(createdAt)}`,
        body: "这是一条用于验证云同步和本地缓存的测试 Prompt。",
        category: state.categories[0] || "鍏朵粬",
        tags: ["娴嬭瘯淇濆瓨"],
        note: "可在验证后手动删除。",
        favorite: false,
        images: [],
        createdAt,
        updatedAt: createdAt,
      })
    );
    save();
    showToast("测试 Prompt 已保存");
    renderSettings();
  });
  document.querySelector("#manualSyncBtn").addEventListener("click", manualSync);
  document.querySelector("#uploadLocalBtn").addEventListener("click", async () => {
    await uploadLocalDataToSupabase();
    renderSettings();
  });
  document.querySelector("#logoutBtn").addEventListener("click", logoutPrivateAccess);
  document.querySelector("#clearBtn").addEventListener("click", () => {
    if (!confirm("纭畾娓呯┖鏈湴鏁版嵁鍚楋紵")) return;
    state.prompts = [];
    state.categories = [...DEFAULT_CATEGORIES];
    state.todos = [];
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(TODO_STORAGE_KEY);
    showToast("本地数据已清空");
    renderSettings();
  });
}

function exportJson() {
  const blob = new Blob(
    [
      JSON.stringify(
        {
          version: 1,
          categories: state.categories,
          prompts: state.prompts,
          todos: state.todos,
          exportedAt: nowIso(),
        },
        null,
        2
      ),
    ],
    { type: "application/json" }
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `promptbox-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  showToast("数据已导出");
}

function importJson(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      const imported = normalizeData(parsed);
      if (!imported.prompts.length) {
        throw new Error("Invalid PromptBox JSON");
      }
      const merged = mergeDataSets(currentData(), imported);
      state.prompts = merged.prompts;
      state.categories = merged.categories;
      if (!state.categories.includes("鍏朵粬")) state.categories.push("鍏朵粬");
      state.prompts.forEach((prompt) => {
        if (!state.categories.includes(prompt.category)) prompt.category = "鍏朵粬";
      });
      if (Array.isArray(parsed.todos)) {
        const todoMap = new Map(state.todos.map((todo) => [todo.id, normalizeTodo(todo)]));
        parsed.todos.map(normalizeTodo).filter((todo) => todo.content).forEach((todo) => todoMap.set(todo.id, todo));
        state.todos = [...todoMap.values()];
        saveTodos();
      }
      save({ mergeExisting: true });
      showToast("数据已导入");
      renderSettings();
    } catch {
      showToast("瀵煎叆澶辫触锛岃妫€鏌?JSON 鏂囦欢");
    }
  };
  reader.readAsText(file);
}

function empty(text) {
  return `<div class="empty">${escapeHtml(text)}</div>`;
}

window.addEventListener("hashchange", render);

async function init() {
  if (!isLoggedIn()) {
    showLogin();
    return;
  }

  showAppShell();
  try {
    initSupabase();
    await load();
    await loadTodos();
    cleanupTodos();
    render();
  } catch (error) {
    console.error("初始化数据失败", error);
    app.innerHTML = empty("数据加载失败，请刷新页面重试");
  }
}

loginForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const code = loginPassword?.value || "";
  if (code !== PRIVATE_ACCESS_CODE) {
    if (loginError) loginError.textContent = "访问密码不正确";
    return;
  }
  localStorage.setItem(LOGIN_STORAGE_KEY, "true");
  if (loginError) loginError.textContent = "";
  init();
});

init();
