const STORAGE_KEY = "promptbox_prompts";
const LEGACY_STORAGE_KEYS = ["promptbox:data:v1", "prompts", "promptbox-data", "promptboxData"];
const MIGRATION_KEY = "promptbox_storage_migrated_v1";
const DEFAULT_CATEGORIES = ["绘图", "写作", "PPT", "编程", "产品设计", "电商图", "其他"];

const state = {
  prompts: [],
  categories: [],
  filters: {
    query: "",
    category: "全部",
    favorite: false,
  },
  management: {
    enabled: false,
    selected: new Set(),
  },
  returnContext: null,
};

const app = document.querySelector("#app");
const pageTitle = document.querySelector("#pageTitle");
const toast = document.querySelector("#toast");

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

function formatDate(value) {
  if (!value) return "未更新";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function isSupportedImageDataUrl(value) {
  return typeof value === "string" && /^data:image\/(jpeg|png|webp);base64,/i.test(value);
}

function normalizePrompt(prompt = {}) {
  return {
    id: prompt.id || uid(),
    title: prompt.title || "未命名 Prompt",
    body: prompt.body || "",
    category: prompt.category || "其他",
    tags: Array.isArray(prompt.tags) ? prompt.tags : [],
    note: prompt.note || "",
    favorite: Boolean(prompt.favorite),
    images: Array.isArray(prompt.images) ? prompt.images.filter(isSupportedImageDataUrl) : [],
    createdAt: prompt.createdAt || nowIso(),
    updatedAt: prompt.updatedAt || nowIso(),
  };
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
  const raw = localStorage.getItem(key);
  if (!raw) return null;

  try {
    return normalizeData(JSON.parse(raw));
  } catch (error) {
    console.error("读取 Prompt 数据失败", error);
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

function loadPrompts() {
  return readStorageData(STORAGE_KEY);
}

function savePrompts(data = currentData(), options = {}) {
  const normalized = normalizeData(data);
  const next = options.mergeExisting
    ? mergeDataSets(readStorageData(STORAGE_KEY), normalized)
    : normalized;

  state.categories = next.categories;
  state.prompts = next.prompts;
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      categories: next.categories,
      prompts: next.prompts,
      exportedAt: nowIso(),
    })
  );
}

function load() {
  const stableData = readStorageData(STORAGE_KEY);
  const alreadyMigrated = localStorage.getItem(MIGRATION_KEY) === "true";
  const shouldReadLegacy = !alreadyMigrated || !stableData;
  const foundData = [
    stableData,
    ...(shouldReadLegacy ? LEGACY_STORAGE_KEYS.map(readStorageData) : []),
  ].filter(Boolean);

  if (!foundData.length) {
    state.categories = [...DEFAULT_CATEGORIES];
    state.prompts = seedPrompts();
    savePrompts();
    return;
  }

  const migrated = mergeDataSets(...foundData);
  state.categories = migrated.categories;
  state.prompts = migrated.prompts;
  savePrompts();
  localStorage.setItem(MIGRATION_KEY, "true");
}

function save(options = {}) {
  savePrompts(currentData(), options);
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
  document.title = `${title} - PromptBox`;
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
    showToast("仅支持 JPG、PNG、WEBP 图片");
  }

  return Promise.all(
    images.map(
      (file) =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        })
    )
  );
}

function renderImagePreviews(images) {
  const wrap = document.querySelector("#imagePreviewList");
  if (!wrap) return;

  wrap.innerHTML = images.length
    ? images
        .map(
          (src, index) => `
            <div class="image-preview">
              <img src="${src}" alt="Prompt 图片 ${index + 1}" />
              ${index === 0 ? '<span class="cover-badge">封面</span>' : ""}
              <button class="image-remove" type="button" data-remove-image="${index}">删除</button>
            </div>
          `
        )
        .join("")
    : '<p class="image-empty">第一张图片会作为封面图</p>';
}

function detailImageGallery(images = []) {
  if (!images.length) return "";
  const isSingle = images.length === 1;
  return `
    <div class="${isSingle ? "detail-gallery single" : "detail-gallery multi"}">
      ${images
        .map(
          (src, index) => `
            <figure class="detail-image">
              <img src="${src}" alt="Prompt 图片 ${index + 1}" />
            </figure>
          `
        )
        .join("")}
    </div>
  `;
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
        state.filters.category === "全部" || prompt.category === state.filters.category;
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
          ? `<label class="manage-check" aria-label="选择 ${escapeHtml(prompt.title)}">
              <input type="checkbox" data-manage-checkbox="${prompt.id}" ${selected ? "checked" : ""} />
            </label>`
          : ""
      }
      ${cover ? `<div class="prompt-cover"><img src="${cover}" alt="${escapeHtml(prompt.title)} 封面" /></div>` : ""}
      <div class="prompt-card-main">
        <div class="prompt-head">
          <div>
            <h3 class="prompt-title">${escapeHtml(prompt.title)}</h3>
            <div class="prompt-meta">
              <span class="pill">${escapeHtml(prompt.category || "其他")}</span>
              <span>更新于 ${formatDate(prompt.updatedAt)}</span>
            </div>
          </div>
          <span class="${prompt.favorite ? "favorite" : "muted"}">${prompt.favorite ? "已收藏" : "未收藏"}</span>
        </div>
        <div class="tag-row">${tags || '<span class="muted">暂无标签</span>'}</div>
      </div>
    </${element}>
  `;
}

function renderDashboard() {
  setTitle("首页 Dashboard");
  const recent = [...state.prompts].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0];
  const favCount = state.prompts.filter((prompt) => prompt.favorite).length;
  const topCategory = categoryCounts().sort((a, b) => b.count - a.count)[0];
  const list = filteredPrompts(5);
  const maxCount = Math.max(...categoryCounts().map((item) => item.count), 1);

  app.innerHTML = `
    <div class="grid stats-grid">
      <article class="card stat"><span>Prompt 总数</span><strong>${state.prompts.length}</strong></article>
      <article class="card stat"><span>收藏数量</span><strong>${favCount}</strong></article>
      <article class="card stat"><span>最近更新</span><strong>${recent ? formatDate(recent.updatedAt) : "无"}</strong></article>
      <article class="card stat"><span>常用分类</span><strong>${topCategory?.count ? escapeHtml(topCategory.name) : "无"}</strong></article>
    </div>
    <div class="grid content-grid">
      <section class="card card-pad">
        <div class="section-head">
          <h2>最近 Prompt</h2>
          <a class="ghost-button" href="#/prompts">查看全部</a>
        </div>
        <div class="prompt-list">
          ${list.length ? list.map((prompt) => promptCard(prompt, { source: "#/" })).join("") : empty("还没有 Prompt")}
        </div>
      </section>
      <section class="card card-pad">
        <h2>分类分布</h2>
        <div class="category-list">
          ${categoryCounts()
            .map(
              (item) => `
                <div>
                  <div class="prompt-head">
                    <strong>${escapeHtml(item.name)}</strong>
                    <span class="muted">${item.count}</span>
                  </div>
                  <div class="progress"><span style="width:${(item.count / maxCount) * 100}%"></span></div>
                </div>
              `
            )
            .join("")}
        </div>
      </section>
    </div>
  `;
}

function renderPromptList() {
  setTitle("Prompt 列表");
  const existingIds = new Set(state.prompts.map((prompt) => prompt.id));
  state.management.selected.forEach((id) => {
    if (!existingIds.has(id)) state.management.selected.delete(id);
  });
  const items = filteredPrompts();
  const selectedCount = state.management.selected.size;
  app.innerHTML = `
    <section class="card card-pad">
      <div class="toolbar">
        <input class="field" id="searchInput" placeholder="搜索标题、正文、标签" value="${escapeHtml(state.filters.query)}" />
        <select class="select" id="categoryFilter">
          <option>全部</option>
          ${state.categories.map((name) => `<option ${state.filters.category === name ? "selected" : ""}>${escapeHtml(name)}</option>`).join("")}
        </select>
        <button class="ghost-button" id="favoriteFilter">${state.filters.favorite ? "全部 Prompt" : "只看收藏"}</button>
        <button class="ghost-button" id="manageToggle">${state.management.enabled ? "取消管理" : "管理"}</button>
      </div>
      ${
        state.management.enabled
          ? `<div class="bulk-bar">
              <strong>已选择 ${selectedCount} 项</strong>
              <button class="ghost-button" id="selectAllBtn">全选</button>
              <button class="ghost-button" id="clearSelectBtn">取消选择</button>
              <button class="danger-button" id="deleteSelectedBtn" ${selectedCount ? "" : "disabled"}>删除所选</button>
            </div>`
          : ""
      }
    </section>
    <section class="prompt-list">
      ${items.length ? items.map((prompt) => promptCard(prompt, { source: "#/prompts", management: state.management.enabled })).join("") : empty("没有匹配的 Prompt")}
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
    showToast("已删除所选 Prompt");
    renderPromptList();
  });
}

function renderEdit(id) {
  const editing = state.prompts.find((prompt) => prompt.id === id);
  if (!editing) state.returnContext = null;
  setTitle(editing ? "编辑 Prompt" : "新建 Prompt");
  const prompt = editing || {
    title: "",
    body: "",
    category: state.categories[0] || "其他",
    tags: [],
    note: "",
    favorite: false,
    images: [],
  };
  let draftImages = [...(prompt.images || [])];

  app.innerHTML = `
    <form class="card card-pad form" id="promptForm">
      <label class="label">标题
        <input class="field" name="title" required maxlength="80" value="${escapeHtml(prompt.title)}" />
      </label>
      <label class="label">正文
        <textarea class="textarea" name="body" required>${escapeHtml(prompt.body)}</textarea>
      </label>
      <section class="label image-field">上传图片
        <label class="image-upload-card" for="imageInput">
          <span>+ 添加图片</span>
          <small>支持 JPG、PNG、WEBP，可选择多张</small>
        </label>
        <input class="file-input" id="imageInput" type="file" accept="image/jpeg,image/png,image/webp" multiple />
        <div class="image-preview-list" id="imagePreviewList"></div>
      </section>
      <div class="form-row">
        <label class="label">分类
          <select class="select" name="category">
            ${state.categories.map((name) => `<option ${prompt.category === name ? "selected" : ""}>${escapeHtml(name)}</option>`).join("")}
          </select>
        </label>
        <label class="label">标签
          <input class="field" name="tags" placeholder="用逗号分隔" value="${escapeHtml((prompt.tags || []).join(", "))}" />
        </label>
      </div>
      <label class="label">备注
        <textarea class="textarea" name="note">${escapeHtml(prompt.note || "")}</textarea>
      </label>
      <label class="label">
        <span><input type="checkbox" name="favorite" ${prompt.favorite ? "checked" : ""} /> 收藏</span>
      </label>
      <div class="actions">
        <button class="button" type="submit">保存</button>
        <a class="ghost-button" href="${editing ? `#/detail/${editing.id}` : "#/prompts"}">取消</a>
      </div>
    </form>
  `;

  renderImagePreviews(draftImages);

  document.querySelector("#imageInput").addEventListener("change", async (event) => {
    const nextImages = await readImageFiles(event.target.files || []);
    draftImages = [...draftImages, ...nextImages];
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
    setTitle("Prompt 详情");
    app.innerHTML = empty("这个 Prompt 不存在");
    return;
  }

  setTitle(prompt.title);
  app.innerHTML = `
    <article class="card card-pad detail-card">
      <button class="back-button" id="backBtn" type="button">← 返回</button>
      <div class="detail-top">
        <div>
          <h2 class="detail-title">${escapeHtml(prompt.title)}</h2>
        </div>
        <div class="actions">
          <button class="icon-button" id="copyBtn">复制</button>
          <button class="favorite-button ${prompt.favorite ? "is-active" : ""}" id="favoriteBtn">${prompt.favorite ? "已收藏" : "收藏"}</button>
        </div>
      </div>
      ${detailImageGallery(prompt.images)}
      <div class="prompt-meta detail-meta">
        <span class="pill">${escapeHtml(prompt.category)}</span>
        <span>更新于 ${formatDate(prompt.updatedAt)}</span>
        <span class="favorite-state ${prompt.favorite ? "is-active" : ""}">${prompt.favorite ? "已收藏" : "未收藏"}</span>
      </div>
      <div class="tag-row">${(prompt.tags || []).map((tag) => `<span class="tag">#${escapeHtml(tag)}</span>`).join("")}</div>
      <div class="detail-body">${escapeHtml(prompt.body)}</div>
      ${prompt.note ? `<div class="detail-note"><h3>备注</h3><div class="note-box">${escapeHtml(prompt.note)}</div></div>` : ""}
      <div class="actions">
        <a class="button" href="#/edit/${prompt.id}">编辑</a>
        <button class="danger-button" id="deleteBtn">删除</button>
      </div>
    </article>
  `;

  document.querySelector("#backBtn").addEventListener("click", goBack);
  document.querySelector("#copyBtn").addEventListener("click", async () => {
    const button = document.querySelector("#copyBtn");
    await copyText(prompt.body);
    button.textContent = "已复制";
    button.classList.add("is-copied");
    showToast("Prompt 正文已复制");
    setTimeout(() => {
      button.textContent = "复制";
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
    if (!confirm("确定删除这个 Prompt 吗？")) return;
    state.prompts = state.prompts.filter((item) => item.id !== id);
    save();
    showToast("已删除");
    location.hash = "#/prompts";
  });
}

function renderCategories() {
  setTitle("分类管理");
  app.innerHTML = `
    <section class="card card-pad form">
      <form class="toolbar" id="categoryForm">
        <input class="field" name="name" maxlength="16" placeholder="新增分类名称" />
        <button class="button" type="submit">添加分类</button>
        <a class="ghost-button" href="#/prompts">返回列表</a>
      </form>
      <div class="category-list">
        ${state.categories
          .map(
            (name) => `
              <div class="category-item">
                <input class="field" data-category-input="${escapeHtml(name)}" value="${escapeHtml(name)}" />
                <span class="muted">${state.prompts.filter((prompt) => prompt.category === name).length} 条</span>
                <button class="danger-button" data-delete-category="${escapeHtml(name)}">删除</button>
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

function renderSettings() {
  setTitle("设置");
  app.innerHTML = `
    <section class="grid content-grid">
      <div class="card card-pad form">
        <h2>数据备份</h2>
        <div class="actions">
          <button class="button" id="exportBtn">导出数据</button>
          <label class="ghost-button" for="importFile">导入数据</label>
          <input class="file-input" id="importFile" type="file" accept="application/json,.json" />
        </div>
      </div>
      <div class="card card-pad form">
        <h2>本地数据</h2>
        <p class="muted">当前浏览器内共有 ${state.prompts.length} 条 Prompt，${state.categories.length} 个分类。</p>
        <div class="storage-debug">
          <span>当前存储条数：${state.prompts.length}</span>
          <span>当前 storage key：${STORAGE_KEY}</span>
        </div>
        <button class="ghost-button" id="testSaveBtn">测试保存</button>
        <button class="danger-button" id="clearBtn">清空本地数据</button>
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
        title: `测试保存 ${formatDate(createdAt)}`,
        body: "这是一条用于验证 localStorage 持久化的测试 Prompt。刷新或重新打开页面后，它应该仍然存在。",
        category: state.categories[0] || "其他",
        tags: ["测试保存"],
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
  document.querySelector("#clearBtn").addEventListener("click", () => {
    if (!confirm("确定清空本地数据吗？")) return;
    state.prompts = [];
    state.categories = [...DEFAULT_CATEGORIES];
    save();
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
      if (!state.categories.includes("其他")) state.categories.push("其他");
      state.prompts.forEach((prompt) => {
        if (!state.categories.includes(prompt.category)) prompt.category = "其他";
      });
      save({ mergeExisting: true });
      showToast("数据已导入");
      renderSettings();
    } catch {
      showToast("导入失败，请检查 JSON 文件");
    }
  };
  reader.readAsText(file);
}

function empty(text) {
  return `<div class="empty">${escapeHtml(text)}</div>`;
}

window.addEventListener("hashchange", render);
load();
render();
