const STORAGE_KEY = "promptbox:data:v1";
const DEFAULT_CATEGORIES = ["绘图", "写作", "PPT", "编程", "产品设计", "电商图", "其他"];

const state = {
  prompts: [],
  categories: [],
  filters: {
    query: "",
    category: "全部",
    favorite: false,
  },
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

function load() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    state.categories = [...DEFAULT_CATEGORIES];
    state.prompts = seedPrompts();
    save();
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    state.categories = Array.isArray(parsed.categories) && parsed.categories.length
      ? parsed.categories
      : [...DEFAULT_CATEGORIES];
    state.prompts = Array.isArray(parsed.prompts) ? parsed.prompts.map(normalizePrompt) : [];
    save();
  } catch {
    state.categories = [...DEFAULT_CATEGORIES];
    state.prompts = [];
  }
}

function save() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      categories: state.categories,
      prompts: state.prompts,
      exportedAt: nowIso(),
    })
  );
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
  if (history.length > 1) {
    history.back();
    return;
  }

  location.hash = "#/";
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

function promptCard(prompt) {
  const tags = (prompt.tags || []).map((tag) => `<span class="tag">#${escapeHtml(tag)}</span>`).join("");
  const cover = prompt.images?.[0];
  return `
    <a class="prompt-item ${cover ? "has-cover" : ""}" href="#/detail/${prompt.id}">
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
    </a>
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
          ${list.length ? list.map(promptCard).join("") : empty("还没有 Prompt")}
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
  const items = filteredPrompts();
  app.innerHTML = `
    <section class="card card-pad">
      <div class="toolbar">
        <input class="field" id="searchInput" placeholder="搜索标题、正文、标签" value="${escapeHtml(state.filters.query)}" />
        <select class="select" id="categoryFilter">
          <option>全部</option>
          ${state.categories.map((name) => `<option ${state.filters.category === name ? "selected" : ""}>${escapeHtml(name)}</option>`).join("")}
        </select>
        <button class="ghost-button" id="favoriteFilter">${state.filters.favorite ? "全部 Prompt" : "只看收藏"}</button>
      </div>
    </section>
    <section class="prompt-list">
      ${items.length ? items.map(promptCard).join("") : empty("没有匹配的 Prompt")}
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
}

function renderEdit(id) {
  const editing = state.prompts.find((prompt) => prompt.id === id);
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
    event.target.value = "";
    renderImagePreviews(draftImages);
  });

  document.querySelector("#imagePreviewList").addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-image]");
    if (!button) return;
    draftImages = draftImages.filter((_, index) => index !== Number(button.dataset.removeImage));
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
      showToast("已保存修改");
      save();
      location.hash = `#/detail/${editing.id}`;
      return;
    }

    const created = {
      id: uid(),
      ...next,
      createdAt: nowIso(),
    };
    state.prompts.unshift(created);
    save();
    showToast("已创建 Prompt");
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
    save();
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
          <button class="button" id="exportBtn">导出 JSON</button>
          <label class="ghost-button" for="importFile">导入 JSON</label>
          <input class="file-input" id="importFile" type="file" accept="application/json,.json" />
        </div>
      </div>
      <div class="card card-pad form">
        <h2>本地数据</h2>
        <p class="muted">当前浏览器内共有 ${state.prompts.length} 条 Prompt，${state.categories.length} 个分类。</p>
        <button class="danger-button" id="clearBtn">清空本地数据</button>
      </div>
    </section>
  `;

  document.querySelector("#exportBtn").addEventListener("click", exportJson);
  document.querySelector("#importFile").addEventListener("change", importJson);
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
  showToast("JSON 已导出");
}

function importJson(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!Array.isArray(parsed.prompts) || !Array.isArray(parsed.categories)) {
        throw new Error("Invalid PromptBox JSON");
      }
      state.prompts = parsed.prompts.map(normalizePrompt);
      state.categories = parsed.categories.length ? parsed.categories : [...DEFAULT_CATEGORIES];
      if (!state.categories.includes("其他")) state.categories.push("其他");
      state.prompts.forEach((prompt) => {
        if (!state.categories.includes(prompt.category)) prompt.category = "其他";
      });
      save();
      showToast("JSON 已导入");
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
