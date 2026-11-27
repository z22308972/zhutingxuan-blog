/**
 * 极简博客独立写作后台（/studio）
 * 完全独立于公开博客首页，仅博主密码登录后可操作文章、草稿箱、分类标签与站点设置
 */
(function () {
  const { escapeHtml, renderMarkdown } = window.BlogMarkdown;

  const state = {
    site: {
      siteName: "Zhutingxuan",
      avatarText: "ZT",
      avatarUrl: "",
      motto: "温故而知新，慢行亦有风",
      footerText: "blog.zhutingxuan.ggff.net",
      github: "",
      bilibili: "",
      email: "",
      aboutContent: ""
    },
    adminPosts: [],
    taxonomies: {
      categories: [],
      tags: []
    },
    authenticated: false,
    configured: true,
    adminTab: "list", // 'list' | 'drafts' | 'editor' | 'taxonomies' | 'settings'
    editingPostId: null,
    recentlyDraftedId: null,
    uploadTarget: null, // 'cover' | 'inline' | 'avatar'
    onInlineFilesSelected: null
  };

  const el = {
    studioView: document.getElementById("studio-view"),
    mediaInput: document.getElementById("media-upload-input"),
    lightboxModal: document.getElementById("lightbox-modal"),
    lightboxImg: document.getElementById("lightbox-img"),
    lightboxClose: document.getElementById("lightbox-close"),
    toast: document.getElementById("toast")
  };

  let toastTimer = null;
  function showToast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove("show"), 2400);
  }

  function formatViewsText(n) {
    return `${Number(n || 0)} 次浏览`;
  }

  async function api(url, options = {}) {
    const res = await fetch(url, {
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `请求失败 (${res.status})`);
    return data;
  }

  async function loadAdminPosts() {
    const res = await api("/api/posts?all=1");
    state.adminPosts = res.posts || [];
  }

  async function loadTaxonomies() {
    try {
      const res = await api("/api/taxonomies");
      state.taxonomies = {
        categories: res.categories || [],
        tags: res.tags || []
      };
    } catch {
      // keep existing
    }
  }

  // ==================== 写作后台主视图 ====================
  async function renderStudio() {
    document.title = `写作后台 · ${state.site.siteName || "Zhutingxuan"}`;

    if (!state.authenticated) {
      el.studioView.innerHTML = `
        <div class="admin-login-box">
          <h2>博主写作后台</h2>
          <p>独立写作空间（/studio）· 仅博主输入密码后可发表、修改文章或管理分类与标签。</p>
          <form id="admin-login-form" class="admin-login-form">
            <input id="admin-password" class="input-field" type="password" placeholder="请输入博主访问密码" autocomplete="current-password" required />
            <div id="admin-login-error" class="alert-error hidden"></div>
            <button id="admin-login-btn" class="btn btn-dark" type="submit">登录写作后台</button>
            <a href="/" class="btn btn-outline">返回博客首页</a>
          </form>
        </div>
      `;

      const form = document.getElementById("admin-login-form");
      const errBox = document.getElementById("admin-login-error");
      const passInput = document.getElementById("admin-password");
      if (!state.configured) {
        errBox.textContent = "尚未配置密码，请在 Cloudflare 环境变量中添加 APP_PASSWORD";
        errBox.classList.remove("hidden");
      }

      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        errBox.classList.add("hidden");
        try {
          await api("/api/login", {
            method: "POST",
            body: JSON.stringify({ password: passInput.value })
          });
          state.authenticated = true;
          await Promise.all([loadAdminPosts(), loadTaxonomies()]);
          showToast("欢迎回来，已进入独立写作后台 ✨");
          renderStudio();
        } catch (err) {
          errBox.textContent = err.message;
          errBox.classList.remove("hidden");
        }
      });
      setTimeout(() => passInput.focus(), 40);
      return;
    }

    await Promise.all([loadAdminPosts(), loadTaxonomies()]);

    const publishedPosts = state.adminPosts.filter((p) => p.published);
    const draftPosts = state.adminPosts.filter((p) => !p.published);
    const catCount = state.taxonomies.categories.length;
    const tagCount = state.taxonomies.tags.length;

    el.studioView.innerHTML = `
      <div class="admin-header">
        <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;">
          <a href="/" class="btn btn-outline">← 返回博客</a>
          <div>
            <h2 class="page-title" style="margin-bottom:2px;font-size:24px;">写作后台</h2>
            <div style="font-size:12.5px;color:var(--text-muted)">独立全屏工作台 (/studio) · 仅你本人拥有发布与管理权限</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          <div class="admin-tabs">
            <button type="button" class="admin-tab${state.adminTab === "list" ? " active" : ""}" data-tab="list">已发布 (${publishedPosts.length})</button>
            <button type="button" class="admin-tab${state.adminTab === "drafts" ? " active" : ""}" data-tab="drafts">草稿箱 (${draftPosts.length})</button>
            <button type="button" class="admin-tab${state.adminTab === "editor" ? " active" : ""}" data-tab="editor">${state.editingPostId ? "编辑文章" : "写新文章"}</button>
            <button type="button" class="admin-tab${state.adminTab === "taxonomies" ? " active" : ""}" data-tab="taxonomies">分类与标签 (${catCount}/${tagCount})</button>
            <button type="button" class="admin-tab${state.adminTab === "settings" ? " active" : ""}" data-tab="settings">站点设置</button>
          </div>
          <button id="admin-logout-btn" class="btn btn-outline" type="button">退出后台</button>
        </div>
      </div>
      <div id="admin-panel"></div>
    `;

    el.studioView.querySelectorAll(".admin-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.dataset.tab === "editor" && state.adminTab !== "editor") {
          state.editingPostId = null;
        }
        if (btn.dataset.tab !== "drafts") {
          state.recentlyDraftedId = null;
        }
        state.adminTab = btn.dataset.tab;
        renderStudio();
      });
    });

    document.getElementById("admin-logout-btn").addEventListener("click", async () => {
      await api("/api/logout", { method: "POST" }).catch(() => {});
      state.authenticated = false;
      showToast("已退出写作后台");
      window.location.href = "/";
    });

    const panel = document.getElementById("admin-panel");
    if (state.adminTab === "list") renderAdminList(panel, publishedPosts);
    else if (state.adminTab === "drafts") renderAdminDrafts(panel, draftPosts);
    else if (state.adminTab === "editor") renderAdminEditor(panel);
    else if (state.adminTab === "taxonomies") renderAdminTaxonomies(panel);
    else renderAdminSettings(panel);
  }

  function renderAdminList(panel, publishedPosts) {
    panel.innerHTML = `
      <div class="admin-card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;gap:10px;flex-wrap:wrap;">
          <div>
            <strong style="font-size:15.5px;">已发布文章</strong>
            <div style="font-size:12.5px;color:var(--text-muted);margin-top:2px;">点击「删除」会先将文章移入草稿箱，不会直接永久销毁</div>
          </div>
          <button id="new-post-btn" class="btn btn-accent" type="button">+ 写新文章</button>
        </div>
        ${
          publishedPosts.length === 0
            ? '<div class="empty-msg">还没有已发布文章，点击右上角写下第一篇吧</div>'
            : publishedPosts
                .map(
                  (p) => `
          <div class="admin-post-row">
            <div>
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                <span class="status-dot pub">已发布</span>
                <strong style="font-size:15.5px;">${escapeHtml(p.title)}</strong>
              </div>
              <div style="font-size:12.5px;color:var(--text-muted);margin-top:4px;">
                ${escapeHtml(p.published_at)} · 分类：${escapeHtml(p.category || "随笔")} · ${formatViewsText(p.views)} ${
                  p.tags?.length ? `· 标签：${p.tags.map(escapeHtml).join(" / ")}` : ""
                }
              </div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <a class="btn btn-outline" href="/#/post/${encodeURIComponent(p.slug)}">查看</a>
              <button class="btn btn-outline edit-post-btn" type="button" data-id="${escapeHtml(p.id)}">编辑</button>
              <button class="btn btn-danger del-post-btn" type="button" data-id="${escapeHtml(p.id)}" data-title="${escapeHtml(p.title)}">删除</button>
            </div>
          </div>`
                )
                .join("")
        }
      </div>
    `;

    document.getElementById("new-post-btn").addEventListener("click", () => {
      state.editingPostId = null;
      state.adminTab = "editor";
      renderStudio();
    });

    panel.querySelectorAll(".edit-post-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.editingPostId = btn.dataset.id;
        state.adminTab = "editor";
        renderStudio();
      });
    });

    panel.querySelectorAll(".del-post-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        const title = btn.dataset.title || "这篇文章";
        if (
          !window.confirm(
            `确认将《${title}》移入草稿箱吗？\n\n移入后前台将隐藏该文章，你可以随时在草稿箱中恢复发布，或再次确认彻底删除。`
          )
        ) {
          return;
        }
        try {
          await api(`/api/posts/${encodeURIComponent(id)}`, { method: "DELETE" });
          await Promise.all([loadAdminPosts(), loadTaxonomies()]);
          state.recentlyDraftedId = id;
          state.adminTab = "drafts";
          showToast(`《${title}》已移入草稿箱，如需永久删除请在此再次确认`);
          renderStudio();
        } catch (err) {
          showToast("移入草稿箱失败：" + err.message);
        }
      });
    });
  }

  function renderAdminDrafts(panel, draftPosts) {
    panel.innerHTML = `
      <div class="admin-card">
        <div class="draft-banner">
          <div>
            <strong>草稿箱（安全回收与待发布区）</strong>
            <p>草稿箱里的文章仅你本人可见，访客无法浏览。你可以在这里继续编辑、一键恢复发布，或点击「彻底删除」再次确认永久移除。</p>
          </div>
          <button id="draft-new-post-btn" class="btn btn-outline" type="button" style="flex-shrink:0">+ 写新草稿</button>
        </div>
        ${
          draftPosts.length === 0
            ? '<div class="empty-msg">草稿箱目前是空的 ✨</div>'
            : draftPosts
                .map((p) => {
                  const isRecent = state.recentlyDraftedId === p.id;
                  return `
          <div class="admin-post-row${isRecent ? " just-moved" : ""}">
            <div>
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                <span class="status-dot draft">草稿</span>
                ${isRecent ? '<span class="status-dot recent">刚刚移入</span>' : ""}
                <strong style="font-size:15.5px;">${escapeHtml(p.title)}</strong>
              </div>
              <div style="font-size:12.5px;color:var(--text-muted);margin-top:4px;">
                ${escapeHtml(p.published_at)} · 分类：${escapeHtml(p.category || "随笔")} · ${formatViewsText(p.views)} ${
                  p.tags?.length ? `· 标签：${p.tags.map(escapeHtml).join(" / ")}` : ""
                }
              </div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button class="btn btn-outline edit-draft-btn" type="button" data-id="${escapeHtml(p.id)}">编辑</button>
              <button class="btn btn-accent restore-draft-btn" type="button" data-id="${escapeHtml(p.id)}" data-title="${escapeHtml(p.title)}">恢复发布</button>
              <button class="btn btn-danger hard-del-btn" type="button" data-id="${escapeHtml(p.id)}" data-title="${escapeHtml(p.title)}">彻底删除</button>
            </div>
          </div>`;
                })
                .join("")
        }
      </div>
    `;

    document.getElementById("draft-new-post-btn").addEventListener("click", () => {
      state.editingPostId = null;
      state.adminTab = "editor";
      renderStudio();
    });

    panel.querySelectorAll(".edit-draft-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.editingPostId = btn.dataset.id;
        state.adminTab = "editor";
        renderStudio();
      });
    });

    panel.querySelectorAll(".restore-draft-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        const title = btn.dataset.title || "这篇文章";
        try {
          await api(`/api/posts/${encodeURIComponent(id)}`, {
            method: "PUT",
            body: JSON.stringify({ published: true })
          });
          await Promise.all([loadAdminPosts(), loadTaxonomies()]);
          state.recentlyDraftedId = null;
          showToast(`《${title}》已恢复公开发布 ✓`);
          renderStudio();
        } catch (err) {
          showToast("恢复发布失败：" + err.message);
        }
      });
    });

    panel.querySelectorAll(".hard-del-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        const title = btn.dataset.title || "这篇文章";
        if (
          !window.confirm(
            `⚠️ 二次确认：确定要从草稿箱彻底删除《${title}》吗？\n\n彻底删除后文章将永久消失，无法再恢复！`
          )
        ) {
          return;
        }
        try {
          await api(`/api/posts/${encodeURIComponent(id)}?permanent=1`, { method: "DELETE" });
          await Promise.all([loadAdminPosts(), loadTaxonomies()]);
          if (state.recentlyDraftedId === id) state.recentlyDraftedId = null;
          showToast(`《${title}》已彻底删除`);
          renderStudio();
        } catch (err) {
          showToast("彻底删除失败：" + err.message);
        }
      });
    });
  }

  function renderAdminEditor(panel) {
    const existing = state.editingPostId
      ? state.adminPosts.find((p) => p.id === state.editingPostId)
      : null;
    const today = new Date().toISOString().slice(0, 10);

    const managedCats = state.taxonomies.categories.map((c) => c.name);
    let selectedCategory = existing?.category || managedCats[0] || "随笔";
    let selectedTags = Array.isArray(existing?.tags) ? [...existing.tags] : [];

    panel.innerHTML = `
      <form id="post-editor-form" class="admin-card">
        <div class="meta-toggle-row">
          <div style="flex:1;min-width:240px;">
            <input id="ed-title" class="input-field" style="font-size:18px;font-weight:600;padding:11px 14px;" type="text" required placeholder="输入文章标题..." value="${escapeHtml(existing?.title || "")}" />
          </div>
          <button id="toggle-meta-btn" class="btn btn-outline" type="button">收起文章信息</button>
        </div>

        <div id="ed-meta-grid" class="form-grid">
          <div class="form-field full">
            <div class="picker-label-row">
              <label class="form-label">文章分类（点击即可选择）</label>
              <button type="button" class="text-link-btn" id="jump-manage-tax-btn">管理分类与标签 →</button>
            </div>
            <div class="taxonomy-picker-box">
              <div id="ed-cat-pills" class="picker-pills"></div>
              <div class="quick-add-row">
                <input id="ed-new-cat-input" class="input-field input-compact" type="text" maxlength="32" placeholder="输入新分类名，回车或点击添加..." />
                <button id="ed-add-cat-btn" class="btn btn-outline btn-compact" type="button">+ 新建分类</button>
              </div>
            </div>
          </div>

          <div class="form-field full">
            <div class="picker-label-row">
              <label class="form-label">文章标签（点击多选，最多 10 个）</label>
              <span id="ed-tag-count-hint" class="picker-hint">已选 ${selectedTags.length} 个</span>
            </div>
            <div class="taxonomy-picker-box">
              <div id="ed-selected-tags" class="selected-tags-row"></div>
              <div id="ed-tag-pills" class="picker-pills"></div>
              <div class="quick-add-row">
                <input id="ed-new-tag-input" class="input-field input-compact" type="text" maxlength="24" placeholder="输入新标签名，回车或点击添加并选中..." />
                <button id="ed-add-tag-btn" class="btn btn-outline btn-compact" type="button">+ 新建标签</button>
              </div>
            </div>
          </div>

          <div class="form-field full">
            <div class="picker-label-row">
              <label class="form-label" for="ed-slug">文章英文路由（URL Slug · 留空将自动把中文标题翻译为英文）</label>
              <span class="picker-hint">${
                existing && /[\u4e00-\u9fff]/.test(existing.slug || "")
                  ? "⚠️ 当前路由含中文，可点右侧按钮一键转为英文"
                  : "最终访问地址：/#/post/英文路由"
              }</span>
            </div>
            <div class="slug-input-row">
              <span class="slug-prefix">/#/post/</span>
              <input id="ed-slug" class="input-field slug-input" type="text" maxlength="64" placeholder="如：ios-multi-open-muse（新建留空自动翻译）" value="${escapeHtml(existing?.slug || "")}" />
              <button id="auto-slug-btn" class="btn btn-outline btn-compact" type="button">✨ 自动翻译英文路由</button>
            </div>
          </div>

          <div class="form-field">
            <label class="form-label" for="ed-date">发布日期</label>
            <input id="ed-date" class="input-field" type="date" value="${escapeHtml(existing?.published_at || today)}" />
          </div>

          <div id="cover-drop-zone" class="form-field cover-drop-zone">
            <label class="form-label" for="ed-cover">封面图（点右侧上传，或直接拖图片到这里）</label>
            <div class="cover-picker-row">
              <input id="ed-cover" class="input-field" type="text" placeholder="/assets/cover-desk.jpg 或上传/拖入封面" value="${escapeHtml(existing?.cover || "")}" />
              <button id="upload-cover-btn" class="btn btn-outline" type="button" style="flex-shrink:0">上传封面</button>
            </div>
            <img id="ed-cover-preview" class="cover-thumb-preview${existing?.cover ? "" : " hidden"}" src="${escapeHtml(existing?.cover || "")}" alt="封面预览" />
          </div>

          <div class="form-field full">
            <label class="form-label" for="ed-abstract">首页摘要（留空将自动截取正文前 120 字）</label>
            <input id="ed-abstract" class="input-field" type="text" placeholder="用一两句话介绍这篇文章..." value="${escapeHtml(existing?.abstract || "")}" />
          </div>
        </div>

        <div class="form-field full" style="margin-bottom:16px;">
          <div class="editor-toolbar">
            <div class="editor-tools-group">
              <button class="md-tool" type="button" data-md="h1">H1</button>
              <button class="md-tool" type="button" data-md="h2">H2</button>
              <button class="md-tool" type="button" data-md="h3">H3</button>
              <button class="md-tool" type="button" data-md="bold">B</button>
              <button class="md-tool" type="button" data-md="italic">I</button>
              <button class="md-tool" type="button" data-md="quote">引用</button>
              <button class="md-tool" type="button" data-md="todo">清单</button>
              <button class="md-tool" type="button" data-md="code">代码</button>
              <button class="md-tool" type="button" data-md="link">链接</button>
            </div>
            <div class="editor-toolbar-right">
              <span id="ed-word-count" class="editor-sync-hint">0 字 · 左右滚动实时同步</span>
              <button id="upload-inline-btn" class="btn btn-outline" type="button" style="padding:5px 11px;font-size:12.5px;">📷 插入照片</button>
            </div>
          </div>
          <div id="split-editor" class="split-editor">
            <div class="editor-write-wrap">
              <textarea id="ed-content" placeholder="支持 Markdown 实时同步预览 · 直接 Cmd+V 粘贴截图，或把图片拖到正文任意位置松手即可插入 ✨">${escapeHtml(existing?.content || "")}</textarea>
              <div id="drop-hint-badge" class="drop-hint-badge hidden">松手即可上传并插入到当前位置</div>
            </div>
            <div id="ed-preview" class="split-preview post-content"></div>
          </div>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
          <label style="display:inline-flex;align-items:center;gap:8px;font-size:13.5px;cursor:pointer;">
            <input id="ed-published" type="checkbox" ${existing ? (existing.published ? "checked" : "") : "checked"} />
            <span>公开发布到博客（取消勾选则存为仅自己可见的草稿）</span>
          </label>
          <div style="display:flex;gap:10px;">
            <button id="ed-cancel-btn" class="btn btn-outline" type="button">返回列表</button>
            <button id="ed-save-btn" class="btn btn-accent" type="submit">${existing ? "保存修改" : "发布文章"}</button>
          </div>
        </div>
      </form>
    `;

    const ta = document.getElementById("ed-content");
    const preview = document.getElementById("ed-preview");
    const splitBox = document.getElementById("split-editor");
    const dropHint = document.getElementById("drop-hint-badge");
    const wordCountEl = document.getElementById("ed-word-count");
    const coverInput = document.getElementById("ed-cover");
    const coverPreview = document.getElementById("ed-cover-preview");
    const coverDropZone = document.getElementById("cover-drop-zone");
    const metaGrid = document.getElementById("ed-meta-grid");
    const toggleMetaBtn = document.getElementById("toggle-meta-btn");
    const catPillsEl = document.getElementById("ed-cat-pills");
    const newCatInput = document.getElementById("ed-new-cat-input");
    const addCatBtn = document.getElementById("ed-add-cat-btn");
    const selectedTagsEl = document.getElementById("ed-selected-tags");
    const tagPillsEl = document.getElementById("ed-tag-pills");
    const tagCountHint = document.getElementById("ed-tag-count-hint");
    const newTagInput = document.getElementById("ed-new-tag-input");
    const addTagBtn = document.getElementById("ed-add-tag-btn");
    const titleInput = document.getElementById("ed-title");
    const slugInput = document.getElementById("ed-slug");
    const autoSlugBtn = document.getElementById("auto-slug-btn");

    function updateTaxTabCount() {
      const tab = el.studioView.querySelector('.admin-tab[data-tab="taxonomies"]');
      if (tab) {
        tab.textContent = `分类与标签 (${state.taxonomies.categories.length}/${state.taxonomies.tags.length})`;
      }
    }

    function renderEditorTaxonomyPickers() {
      updateTaxTabCount();
      const catNames = state.taxonomies.categories.map((c) => c.name);
      if (selectedCategory && !catNames.includes(selectedCategory)) {
        catNames.unshift(selectedCategory);
      }
      catPillsEl.innerHTML = catNames.length
        ? catNames
            .map(
              (c) =>
                `<button type="button" class="pick-pill${selectedCategory === c ? " active" : ""}" data-pick-cat="${escapeHtml(c)}">${
                  selectedCategory === c ? "✓ " : ""
                }${escapeHtml(c)}</button>`
            )
            .join("")
        : `<span class="picker-empty">暂无分类，请在下方新建</span>`;

      tagCountHint.textContent = `已选 ${selectedTags.length} / 10 个`;
      selectedTagsEl.innerHTML = selectedTags.length
        ? selectedTags
            .map(
              (t) =>
                `<span class="selected-tag-chip"># ${escapeHtml(t)} <button type="button" class="chip-remove-btn" data-remove-tag="${escapeHtml(t)}" aria-label="移除标签">×</button></span>`
            )
            .join("")
        : `<span class="picker-empty">暂未选择标签，点击下方标签库或新建添加</span>`;

      const tagNames = state.taxonomies.tags.map((t) => t.name);
      selectedTags.forEach((t) => {
        if (!tagNames.includes(t)) tagNames.push(t);
      });
      tagPillsEl.innerHTML = tagNames.length
        ? tagNames
            .map((t) => {
              const active = selectedTags.includes(t);
              return `<button type="button" class="pick-pill tag-mode${active ? " active" : ""}" data-pick-tag="${escapeHtml(t)}">${
                active ? "✓ " : "# "
              }${escapeHtml(t)}</button>`;
            })
            .join("")
        : `<span class="picker-empty">标签库暂无标签，直接在下方输入新建</span>`;
    }

    renderEditorTaxonomyPickers();

    catPillsEl.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-pick-cat]");
      if (!btn) return;
      selectedCategory = btn.dataset.pickCat;
      renderEditorTaxonomyPickers();
    });

    tagPillsEl.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-pick-tag]");
      if (!btn) return;
      const t = btn.dataset.pickTag;
      if (selectedTags.includes(t)) {
        selectedTags = selectedTags.filter((x) => x !== t);
      } else {
        if (selectedTags.length >= 10) {
          showToast("每篇文章最多选择 10 个标签");
          return;
        }
        selectedTags.push(t);
      }
      renderEditorTaxonomyPickers();
    });

    selectedTagsEl.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-remove-tag]");
      if (!btn) return;
      selectedTags = selectedTags.filter((x) => x !== btn.dataset.removeTag);
      renderEditorTaxonomyPickers();
    });

    async function handleQuickAddCategory() {
      const name = newCatInput.value.trim().slice(0, 32);
      if (!name) return;
      const exists = state.taxonomies.categories.some((c) => c.name === name);
      if (exists) {
        selectedCategory = name;
        newCatInput.value = "";
        renderEditorTaxonomyPickers();
        showToast(`已选中分类「${name}」`);
        return;
      }
      addCatBtn.disabled = true;
      try {
        const res = await api("/api/taxonomies", {
          method: "POST",
          body: JSON.stringify({ kind: "category", name })
        });
        state.taxonomies = { categories: res.categories || [], tags: res.tags || [] };
        selectedCategory = name;
        newCatInput.value = "";
        renderEditorTaxonomyPickers();
        showToast(`已新建并选中分类「${name}」 ✓`);
      } catch (err) {
        showToast(err.message);
      } finally {
        addCatBtn.disabled = false;
      }
    }

    async function handleQuickAddTag() {
      const raw = newTagInput.value.trim();
      if (!raw) return;
      const names = raw
        .split(/[,，]/)
        .map((x) => x.trim().slice(0, 24))
        .filter(Boolean);
      if (!names.length) return;

      addTagBtn.disabled = true;
      try {
        for (const name of names) {
          if (!state.taxonomies.tags.some((t) => t.name === name)) {
            const res = await api("/api/taxonomies", {
              method: "POST",
              body: JSON.stringify({ kind: "tag", name })
            });
            state.taxonomies = { categories: res.categories || [], tags: res.tags || [] };
          }
          if (!selectedTags.includes(name) && selectedTags.length < 10) {
            selectedTags.push(name);
          }
        }
        newTagInput.value = "";
        renderEditorTaxonomyPickers();
        showToast(`已添加标签：${names.join("、")} ✓`);
      } catch (err) {
        showToast(err.message);
      } finally {
        addTagBtn.disabled = false;
      }
    }

    addCatBtn.addEventListener("click", handleQuickAddCategory);
    newCatInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleQuickAddCategory();
      }
    });

    addTagBtn.addEventListener("click", handleQuickAddTag);
    newTagInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleQuickAddTag();
      }
    });

    document.getElementById("jump-manage-tax-btn").addEventListener("click", () => {
      state.adminTab = "taxonomies";
      renderStudio();
    });

    let slugManuallyEdited = Boolean(existing?.slug);
    async function requestAutoSlug(silent = false) {
      const source = titleInput.value.trim() || slugInput.value.trim();
      if (!source) {
        if (!silent) showToast("请先输入文章标题再翻译路由");
        return;
      }
      autoSlugBtn.disabled = true;
      const oldText = autoSlugBtn.textContent;
      autoSlugBtn.textContent = "翻译中...";
      try {
        const res = await api("/api/slug", {
          method: "POST",
          body: JSON.stringify({
            title: source,
            excludeId: existing?.id || ""
          })
        });
        if (res.slug) {
          slugInput.value = res.slug;
          if (!silent) showToast(`已生成英文路由：${res.slug} ✓`);
        }
      } catch (err) {
        if (!silent) showToast("生成路由失败：" + err.message);
      } finally {
        autoSlugBtn.disabled = false;
        autoSlugBtn.textContent = oldText;
      }
    }

    autoSlugBtn.addEventListener("click", () => {
      slugManuallyEdited = true;
      requestAutoSlug(false);
    });

    slugInput.addEventListener("input", () => {
      slugManuallyEdited = Boolean(slugInput.value.trim());
    });

    titleInput.addEventListener("blur", () => {
      if (!existing && !slugManuallyEdited && titleInput.value.trim() && !slugInput.value.trim()) {
        requestAutoSlug(true);
      }
    });

    toggleMetaBtn.addEventListener("click", () => {
      const collapsed = metaGrid.classList.toggle("hidden");
      toggleMetaBtn.textContent = collapsed ? "展开文章信息" : "收起文章信息";
    });

    // 实时同步渲染
    const syncPreview = () => {
      const text = ta.value;
      preview.innerHTML = renderMarkdown(text);
      const count = text.replace(/\s+/g, "").length;
      wordCountEl.textContent = `${count} 字 · 左右滚动实时同步`;
      if (ta.selectionStart >= text.length - 4 && ta.scrollHeight > ta.clientHeight) {
        const ratio = ta.scrollTop / Math.max(1, ta.scrollHeight - ta.clientHeight);
        if (ratio > 0.88) {
          preview.scrollTop = preview.scrollHeight;
        }
      }
    };
    syncPreview();
    ta.addEventListener("input", syncPreview);
    ta.addEventListener("compositionend", syncPreview);
    ta.addEventListener("change", syncPreview);

    // 双向滚动同步
    let scrollLock = null;
    let scrollLockTimer = null;
    function syncScroll(source, target, lockName) {
      if (scrollLock && scrollLock !== lockName) return;
      scrollLock = lockName;
      clearTimeout(scrollLockTimer);
      const maxSource = source.scrollHeight - source.clientHeight;
      const maxTarget = target.scrollHeight - target.clientHeight;
      if (maxSource > 0 && maxTarget > 0) {
        target.scrollTop = (source.scrollTop / maxSource) * maxTarget;
      }
      scrollLockTimer = setTimeout(() => {
        scrollLock = null;
      }, 60);
    }

    ta.addEventListener("scroll", () => syncScroll(ta, preview, "editor"));
    preview.addEventListener("scroll", () => syncScroll(preview, ta, "preview"));

    // 计算拖放坐标对应的字符精准落点
    function getDropOffsetInTextarea(textarea, clientX, clientY) {
      const rect = textarea.getBoundingClientRect();
      const style = window.getComputedStyle(textarea);
      const value = textarea.value;
      if (!value) return 0;

      const mirror = document.createElement("div");
      const copyProps = [
        "boxSizing", "fontFamily", "fontSize", "fontWeight", "fontStyle",
        "letterSpacing", "lineHeight", "textTransform", "wordSpacing", "tabSize",
        "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
        "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth"
      ];
      copyProps.forEach((p) => {
        mirror.style[p] = style[p];
      });
      mirror.style.position = "fixed";
      mirror.style.left = `${rect.left}px`;
      mirror.style.top = `${rect.top}px`;
      mirror.style.width = `${rect.width}px`;
      mirror.style.height = `${rect.height}px`;
      mirror.style.overflow = "auto";
      mirror.style.whiteSpace = "pre-wrap";
      mirror.style.wordWrap = "break-word";
      mirror.style.opacity = "0";
      mirror.style.pointerEvents = "auto";
      mirror.style.zIndex = "9999";

      const textNode = document.createTextNode(value);
      mirror.appendChild(textNode);
      document.body.appendChild(mirror);
      mirror.scrollTop = textarea.scrollTop;
      mirror.scrollLeft = textarea.scrollLeft;

      let offset = null;
      try {
        if (document.caretPositionFromPoint) {
          const pos = document.caretPositionFromPoint(clientX, clientY);
          if (pos && pos.offsetNode === textNode) offset = pos.offset;
        } else if (document.caretRangeFromPoint) {
          const range = document.caretRangeFromPoint(clientX, clientY);
          if (range && range.startContainer === textNode) offset = range.startOffset;
        }
      } catch {
        offset = null;
      } finally {
        document.body.removeChild(mirror);
      }

      if (typeof offset === "number" && offset >= 0 && offset <= value.length) {
        return offset;
      }

      const lineHeight = parseFloat(style.lineHeight) || 25;
      const padTop = parseFloat(style.paddingTop) || 18;
      const relY = clientY - rect.top + textarea.scrollTop - padTop;
      const targetLine = Math.max(0, Math.floor(relY / lineHeight));
      const lines = value.split("\n");
      if (targetLine >= lines.length) return value.length;
      let idx = 0;
      for (let i = 0; i <= targetLine; i++) {
        idx += lines[i].length + (i < lines.length - 1 ? 1 : 0);
      }
      return Math.min(idx, value.length);
    }

    async function uploadAndInsertBodyImages(files, insertAtOffset) {
      const imageFiles = Array.from(files || []).filter((f) => f && f.type && f.type.startsWith("image/"));
      if (imageFiles.length === 0) {
        showToast("仅支持拖入或粘贴 JPG、PNG、WebP、GIF 图片");
        return;
      }

      let pos =
        typeof insertAtOffset === "number"
          ? Math.max(0, Math.min(insertAtOffset, ta.value.length))
          : (ta.selectionStart ?? ta.value.length);

      const needLeadingNl = pos > 0 && ta.value[pos - 1] !== "\n";
      const needTrailingNl = pos < ta.value.length && ta.value[pos] !== "\n";

      const token = `uploading-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const placeholder = `${needLeadingNl ? "\n" : ""}![正在上传 ${imageFiles.length} 张图片...](#${token})${needTrailingNl ? "\n" : ""}`;
      ta.value = ta.value.slice(0, pos) + placeholder + ta.value.slice(pos);
      ta.selectionStart = ta.selectionEnd = pos + placeholder.length;
      ta.focus();
      syncPreview();

      const insertedLines = [];
      for (const file of imageFiles) {
        try {
          const compressed = await compressImage(file, 1400);
          const { media } = await api("/api/media", {
            method: "POST",
            body: JSON.stringify(compressed)
          });
          insertedLines.push(`![${media.filename}](${media.url})`);
        } catch (err) {
          showToast("图片上传失败：" + err.message);
        }
      }

      const finalBlock =
        insertedLines.length > 0
          ? `${needLeadingNl ? "\n" : ""}${insertedLines.join("\n\n")}${needTrailingNl ? "\n" : "\n"}`
          : "";

      const idx = ta.value.indexOf(placeholder);
      if (idx !== -1) {
        ta.value = ta.value.slice(0, idx) + finalBlock + ta.value.slice(idx + placeholder.length);
        const nextCursor = idx + finalBlock.length;
        ta.selectionStart = ta.selectionEnd = nextCursor;
      } else if (finalBlock) {
        ta.value += "\n" + finalBlock;
      }

      ta.focus();
      syncPreview();
      if (insertedLines.length > 0) {
        showToast(`已成功插入 ${insertedLines.length} 张图片 ✓`);
      }
    }

    ta.addEventListener("paste", (e) => {
      const files = [];
      const items = e.clipboardData?.items;
      if (items) {
        for (const item of items) {
          if (item.kind === "file" && item.type.startsWith("image/")) {
            const f = item.getAsFile();
            if (f) files.push(f);
          }
        }
      }
      if (files.length === 0 && e.clipboardData?.files?.length) {
        for (const f of e.clipboardData.files) {
          if (f.type.startsWith("image/")) files.push(f);
        }
      }
      if (files.length > 0) {
        e.preventDefault();
        const start = ta.selectionStart ?? ta.value.length;
        const end = ta.selectionEnd ?? start;
        if (end > start) {
          ta.value = ta.value.slice(0, start) + ta.value.slice(end);
        }
        uploadAndInsertBodyImages(files, start);
      }
    });

    function hasDraggedFiles(dt) {
      if (!dt) return false;
      if (dt.files && dt.files.length > 0) return true;
      return Array.from(dt.types || []).includes("Files");
    }

    let dragDepth = 0;
    let lastHoverTs = 0;
    ta.addEventListener("dragenter", (e) => {
      if (hasDraggedFiles(e.dataTransfer)) {
        e.preventDefault();
        dragDepth++;
        splitBox.classList.add("is-dragover");
        dropHint.classList.remove("hidden");
      }
    });

    ta.addEventListener("dragover", (e) => {
      if (hasDraggedFiles(e.dataTransfer)) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        splitBox.classList.add("is-dragover");
        dropHint.classList.remove("hidden");
        const now = Date.now();
        if (now - lastHoverTs > 80) {
          lastHoverTs = now;
          const hoverOffset = getDropOffsetInTextarea(ta, e.clientX, e.clientY);
          ta.focus();
          ta.selectionStart = ta.selectionEnd = hoverOffset;
        }
      }
    });

    ta.addEventListener("dragleave", () => {
      dragDepth = Math.max(0, dragDepth - 1);
      if (dragDepth === 0) {
        splitBox.classList.remove("is-dragover");
        dropHint.classList.add("hidden");
      }
    });

    ta.addEventListener("drop", (e) => {
      const files = e.dataTransfer?.files;
      dragDepth = 0;
      splitBox.classList.remove("is-dragover");
      dropHint.classList.add("hidden");
      if (files && files.length > 0) {
        e.preventDefault();
        const dropOffset = getDropOffsetInTextarea(ta, e.clientX, e.clientY);
        uploadAndInsertBodyImages(files, dropOffset);
      }
    });

    ta.addEventListener("keydown", (e) => {
      if (e.key === "Tab") {
        e.preventDefault();
        const s = ta.selectionStart ?? ta.value.length;
        const end = ta.selectionEnd ?? s;
        ta.value = ta.value.slice(0, s) + "  " + ta.value.slice(end);
        ta.selectionStart = ta.selectionEnd = s + 2;
        syncPreview();
      }
    });

    coverDropZone.addEventListener("dragover", (e) => {
      if (hasDraggedFiles(e.dataTransfer)) {
        e.preventDefault();
        coverDropZone.classList.add("is-dragover");
      }
    });
    coverDropZone.addEventListener("dragleave", () => {
      coverDropZone.classList.remove("is-dragover");
    });
    coverDropZone.addEventListener("drop", async (e) => {
      coverDropZone.classList.remove("is-dragover");
      const file = Array.from(e.dataTransfer?.files || []).find((f) => f.type.startsWith("image/"));
      if (!file) return;
      e.preventDefault();
      showToast("正在压缩并上传封面图...");
      try {
        const compressed = await compressImage(file, 1400);
        const { media } = await api("/api/media", {
          method: "POST",
          body: JSON.stringify(compressed)
        });
        coverInput.value = media.url;
        coverPreview.src = media.url;
        coverPreview.classList.remove("hidden");
        showToast("封面图已上传 ✓");
      } catch (err) {
        showToast("封面上传失败：" + err.message);
      }
    });

    coverInput.addEventListener("input", () => {
      const v = coverInput.value.trim();
      coverPreview.src = v;
      coverPreview.classList.toggle("hidden", !v);
    });

    panel.querySelectorAll(".md-tool").forEach((btn) => {
      btn.addEventListener("click", () => {
        const s = ta.selectionStart ?? ta.value.length;
        const e = ta.selectionEnd ?? ta.value.length;
        const sel = ta.value.slice(s, e);
        let ins = "";
        switch (btn.dataset.md) {
          case "h1": ins = `\n# ${sel || "一级标题"}\n`; break;
          case "h2": ins = `\n## ${sel || "二级标题"}\n`; break;
          case "h3": ins = `\n### ${sel || "三级标题"}\n`; break;
          case "bold": ins = `**${sel || "加粗文字"}**`; break;
          case "italic": ins = `*${sel || "斜体文字"}*`; break;
          case "quote": ins = `\n> ${sel || "引用内容"}\n`; break;
          case "todo": ins = `\n- [ ] ${sel || "待办事项"}\n`; break;
          case "code": ins = `\n\`\`\`javascript\n${sel || "// 代码示例"}\n\`\`\`\n`; break;
          case "link": ins = `[${sel || "链接文字"}](https://example.com)`; break;
        }
        ta.value = ta.value.slice(0, s) + ins + ta.value.slice(e);
        ta.selectionStart = ta.selectionEnd = s + ins.length;
        ta.focus();
        syncPreview();
      });
    });

    state.onInlineFilesSelected = (files) => {
      uploadAndInsertBodyImages(files, ta.selectionStart ?? ta.value.length);
    };

    document.getElementById("upload-cover-btn").addEventListener("click", () => {
      state.uploadTarget = "cover";
      el.mediaInput.multiple = false;
      el.mediaInput.click();
    });

    document.getElementById("upload-inline-btn").addEventListener("click", () => {
      state.uploadTarget = "inline";
      el.mediaInput.multiple = true;
      el.mediaInput.click();
    });

    document.getElementById("ed-cancel-btn").addEventListener("click", () => {
      state.editingPostId = null;
      state.adminTab = "list";
      renderStudio();
    });

    document.getElementById("post-editor-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const saveBtn = document.getElementById("ed-save-btn");
      saveBtn.disabled = true;

      const tags = selectedTags.slice(0, 10);
      const payload = {
        title: titleInput.value.trim(),
        slug: slugInput.value.trim(),
        category: (selectedCategory || "").trim() || "随笔",
        published_at: document.getElementById("ed-date").value || today,
        tags,
        cover: coverInput.value.trim(),
        abstract: document.getElementById("ed-abstract").value.trim(),
        content: ta.value,
        published: document.getElementById("ed-published").checked
      };

      try {
        const res = existing
          ? await api(`/api/posts/${encodeURIComponent(existing.id)}`, {
              method: "PUT",
              body: JSON.stringify(payload)
            })
          : await api("/api/posts", {
              method: "POST",
              body: JSON.stringify(payload)
            });

        await Promise.all([loadAdminPosts(), loadTaxonomies()]);
        state.editingPostId = null;
        showToast(existing ? "文章修改已保存 ✓" : "文章发布成功 🎉");
        if (payload.published && res.post?.slug) {
          window.location.href = `/#/post/${encodeURIComponent(res.post.slug)}`;
        } else {
          state.recentlyDraftedId = res.post?.id || null;
          state.adminTab = "drafts";
          renderStudio();
        }
      } catch (err) {
        showToast("保存失败：" + err.message);
      } finally {
        saveBtn.disabled = false;
      }
    });
  }

  function renderAdminTaxonomies(panel) {
    const cats = state.taxonomies.categories || [];
    const tags = state.taxonomies.tags || [];

    panel.innerHTML = `
      <div class="taxonomy-admin-grid">
        <section class="admin-card">
          <div class="taxonomy-card-head">
            <div>
              <strong style="font-size:16px;">分类管理</strong>
              <p class="taxonomy-card-sub">共 ${cats.length} 个分类 · 写文章时可直接一键点选</p>
            </div>
          </div>
          <form id="add-cat-form" class="taxonomy-add-form">
            <input id="tax-new-cat" class="input-field" type="text" maxlength="32" placeholder="输入新分类名称（如：期末复习、读书笔记）" required />
            <button class="btn btn-accent" type="submit" style="flex-shrink:0">+ 添加分类</button>
          </form>
          <div class="taxonomy-list">
            ${
              cats.length === 0
                ? '<div class="empty-msg" style="padding:28px 12px;">还没有分类，先在上方添加一个吧</div>'
                : cats
                    .map(
                      (c) => `
              <div class="taxonomy-row">
                <div class="taxonomy-row-info">
                  <span class="taxonomy-row-name">${escapeHtml(c.name)}</span>
                  <span class="taxonomy-row-badge">${c.count ? `${c.count} 篇文章` : "暂未使用"}</span>
                </div>
                <div class="taxonomy-row-actions">
                  <button type="button" class="btn btn-outline btn-compact tax-rename-btn" data-kind="category" data-name="${escapeHtml(c.name)}">重命名</button>
                  <button type="button" class="btn btn-danger btn-compact tax-del-btn" data-kind="category" data-name="${escapeHtml(c.name)}" data-count="${c.count}">删除</button>
                </div>
              </div>`
                    )
                    .join("")
            }
          </div>
        </section>

        <section class="admin-card">
          <div class="taxonomy-card-head">
            <div>
              <strong style="font-size:16px;">标签管理</strong>
              <p class="taxonomy-card-sub">共 ${tags.length} 个标签 · 写文章时支持点击多选</p>
            </div>
          </div>
          <form id="add-tag-form" class="taxonomy-add-form">
            <input id="tax-new-tag" class="input-field" type="text" maxlength="24" placeholder="输入新标签名称（如：Gemini、iPhone、教程）" required />
            <button class="btn btn-accent" type="submit" style="flex-shrink:0">+ 添加标签</button>
          </form>
          <div class="taxonomy-list">
            ${
              tags.length === 0
                ? '<div class="empty-msg" style="padding:28px 12px;">还没有标签，先在上方添加一个吧</div>'
                : tags
                    .map(
                      (t) => `
              <div class="taxonomy-row">
                <div class="taxonomy-row-info">
                  <span class="taxonomy-row-name"># ${escapeHtml(t.name)}</span>
                  <span class="taxonomy-row-badge">${t.count ? `${t.count} 篇文章` : "暂未使用"}</span>
                </div>
                <div class="taxonomy-row-actions">
                  <button type="button" class="btn btn-outline btn-compact tax-rename-btn" data-kind="tag" data-name="${escapeHtml(t.name)}">重命名</button>
                  <button type="button" class="btn btn-danger btn-compact tax-del-btn" data-kind="tag" data-name="${escapeHtml(t.name)}" data-count="${t.count}">删除</button>
                </div>
              </div>`
                    )
                    .join("")
            }
          </div>
        </section>
      </div>
    `;

    document.getElementById("add-cat-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = document.getElementById("tax-new-cat");
      const name = input.value.trim();
      if (!name) return;
      try {
        const res = await api("/api/taxonomies", {
          method: "POST",
          body: JSON.stringify({ kind: "category", name })
        });
        state.taxonomies = { categories: res.categories || [], tags: res.tags || [] };
        showToast(`已添加分类「${name}」 ✓`);
        renderStudio();
      } catch (err) {
        showToast(err.message);
      }
    });

    document.getElementById("add-tag-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = document.getElementById("tax-new-tag");
      const name = input.value.trim();
      if (!name) return;
      try {
        const res = await api("/api/taxonomies", {
          method: "POST",
          body: JSON.stringify({ kind: "tag", name })
        });
        state.taxonomies = { categories: res.categories || [], tags: res.tags || [] };
        showToast(`已添加标签「${name}」 ✓`);
        renderStudio();
      } catch (err) {
        showToast(err.message);
      }
    });

    panel.querySelectorAll(".tax-rename-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const kind = btn.dataset.kind;
        const oldName = btn.dataset.name;
        const label = kind === "category" ? "分类" : "标签";
        const newName = window.prompt(`重命名${label}「${oldName}」为：`, oldName);
        if (!newName || newName.trim() === oldName) return;
        try {
          const res = await api("/api/taxonomies", {
            method: "PUT",
            body: JSON.stringify({ kind, oldName, newName: newName.trim() })
          });
          state.taxonomies = { categories: res.categories || [], tags: res.tags || [] };
          await loadAdminPosts();
          showToast(`${label}已重命名为「${newName.trim()}」 ✓`);
          renderStudio();
        } catch (err) {
          showToast("重命名失败：" + err.message);
        }
      });
    });

    panel.querySelectorAll(".tax-del-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const kind = btn.dataset.kind;
        const name = btn.dataset.name;
        const count = Number(btn.dataset.count || 0);
        const msg =
          kind === "category"
            ? count > 0
              ? `分类「${name}」下有 ${count} 篇文章，删除后这些文章将归入「未分类」，确定删除吗？`
              : `确定删除分类「${name}」吗？`
            : count > 0
            ? `有 ${count} 篇文章使用了标签「${name}」，删除后将从这些文章中移除该标签，确定删除吗？`
            : `确定删除标签「${name}」吗？`;
        if (!window.confirm(msg)) return;
        try {
          const res = await api(
            `/api/taxonomies?kind=${encodeURIComponent(kind)}&name=${encodeURIComponent(name)}`,
            { method: "DELETE" }
          );
          state.taxonomies = { categories: res.categories || [], tags: res.tags || [] };
          await loadAdminPosts();
          showToast(`已删除${kind === "category" ? "分类" : "标签"}「${name}」`);
          renderStudio();
        } catch (err) {
          showToast("删除失败：" + err.message);
        }
      });
    });
  }

  function renderAdminSettings(panel) {
    const s = state.site;
    panel.innerHTML = `
      <form id="site-settings-form" class="admin-card">
        <div class="form-grid">
          <div class="form-field">
            <label class="form-label" for="st-name">博客名称</label>
            <input id="st-name" class="input-field" type="text" value="${escapeHtml(s.siteName)}" />
          </div>
          <div class="form-field">
            <label class="form-label" for="st-avatar-text">文字头像缩写（无图片时显示）</label>
            <input id="st-avatar-text" class="input-field" type="text" maxlength="4" value="${escapeHtml(s.avatarText)}" />
          </div>
          <div class="form-field full">
            <label class="form-label" for="st-avatar-url">圆形头像图片地址（留空使用文字头像）</label>
            <div class="cover-picker-row">
              <input id="st-avatar-url" class="input-field" type="text" placeholder="可粘贴图片地址或点右侧上传" value="${escapeHtml(s.avatarUrl)}" />
              <button id="upload-avatar-btn" class="btn btn-outline" type="button" style="flex-shrink:0">上传头像</button>
            </div>
          </div>
          <div class="form-field full">
            <label class="form-label" for="st-motto">侧边栏座右铭</label>
            <input id="st-motto" class="input-field" type="text" value="${escapeHtml(s.motto)}" />
          </div>
          <div class="form-field">
            <label class="form-label" for="st-github">GitHub 主页（选填）</label>
            <input id="st-github" class="input-field" type="url" placeholder="https://github.com/..." value="${escapeHtml(s.github)}" />
          </div>
          <div class="form-field">
            <label class="form-label" for="st-bilibili">B站主页（选填）</label>
            <input id="st-bilibili" class="input-field" type="url" placeholder="https://space.bilibili.com/..." value="${escapeHtml(s.bilibili)}" />
          </div>
          <div class="form-field">
            <label class="form-label" for="st-email">公开联系邮箱（选填）</label>
            <input id="st-email" class="input-field" type="email" placeholder="z22308972@gmail.com" value="${escapeHtml(s.email)}" />
          </div>
          <div class="form-field">
            <label class="form-label" for="st-footer">左下角站点标识</label>
            <input id="st-footer" class="input-field" type="text" value="${escapeHtml(s.footerText)}" />
          </div>
          <div class="form-field full">
            <label class="form-label" for="st-about">「关于我」页面内容（支持 Markdown）</label>
            <textarea id="st-about" class="textarea-field" rows="9">${escapeHtml(s.aboutContent)}</textarea>
          </div>
        </div>
        <div style="display:flex;justify-content:flex-end;">
          <button class="btn btn-accent" type="submit">保存站点设置</button>
        </div>
      </form>
    `;

    document.getElementById("upload-avatar-btn").addEventListener("click", () => {
      state.uploadTarget = "avatar";
      el.mediaInput.multiple = false;
      el.mediaInput.click();
    });

    document.getElementById("site-settings-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        const res = await api("/api/site", {
          method: "PUT",
          body: JSON.stringify({
            siteName: document.getElementById("st-name").value.trim() || "Zhutingxuan",
            avatarText: document.getElementById("st-avatar-text").value.trim() || "ZT",
            avatarUrl: document.getElementById("st-avatar-url").value.trim(),
            motto: document.getElementById("st-motto").value.trim(),
            github: document.getElementById("st-github").value.trim(),
            bilibili: document.getElementById("st-bilibili").value.trim(),
            email: document.getElementById("st-email").value.trim(),
            footerText: document.getElementById("st-footer").value.trim(),
            aboutContent: document.getElementById("st-about").value
          })
        });
        state.site = res.settings;
        showToast("站点设置已保存 ✓");
      } catch (err) {
        showToast("保存失败：" + err.message);
      }
    });
  }

  // ==================== 图片压缩上传 ====================
  function compressImage(file, maxDimStart = 1400) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("读取图片失败"));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("解析图片失败"));
        img.onload = () => {
          let maxDim = maxDimStart;
          let quality = 0.84;
          let dataUrl = "";
          for (let attempt = 0; attempt < 4; attempt++) {
            let w = img.naturalWidth || img.width;
            let h = img.naturalHeight || img.height;
            if (w > maxDim || h > maxDim) {
              if (w >= h) {
                h = Math.round((h * maxDim) / w);
                w = maxDim;
              } else {
                w = Math.round((w * maxDim) / h);
                h = maxDim;
              }
            }
            const canvas = document.createElement("canvas");
            canvas.width = Math.max(1, w);
            canvas.height = Math.max(1, h);
            const ctx = canvas.getContext("2d");
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            dataUrl = canvas.toDataURL("image/jpeg", quality);
            if (dataUrl.length <= 680000) break;
            maxDim = Math.round(maxDim * 0.75);
            quality = Math.max(0.55, quality - 0.1);
          }
          resolve({
            filename: `${(file.name || "photo").replace(/\.[^.]+$/, "")}.jpg`,
            mime_type: "image/jpeg",
            data_base64: dataUrl
          });
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  el.mediaInput.addEventListener("change", async () => {
    const files = Array.from(el.mediaInput.files || []);
    el.mediaInput.value = "";
    if (files.length === 0) return;

    if (state.uploadTarget === "inline" && typeof state.onInlineFilesSelected === "function") {
      await state.onInlineFilesSelected(files);
      return;
    }

    const file = files[0];
    showToast("正在压缩并上传图片...");
    try {
      const maxDim = state.uploadTarget === "avatar" ? 480 : 1400;
      const compressed = await compressImage(file, maxDim);
      const { media } = await api("/api/media", {
        method: "POST",
        body: JSON.stringify(compressed)
      });

      if (state.uploadTarget === "cover") {
        const input = document.getElementById("ed-cover");
        const prev = document.getElementById("ed-cover-preview");
        if (input) input.value = media.url;
        if (prev) {
          prev.src = media.url;
          prev.classList.remove("hidden");
        }
        showToast("封面图已上传 ✓");
      } else if (state.uploadTarget === "avatar") {
        const input = document.getElementById("st-avatar-url");
        if (input) input.value = media.url;
        showToast("头像已上传，记得点击底部「保存站点设置」");
      }
    } catch (err) {
      showToast("上传失败：" + err.message);
    }
  });

  // 灯箱事件
  el.studioView.addEventListener("click", (e) => {
    const img = e.target.closest("img[data-lightbox-src]");
    if (img) {
      el.lightboxImg.src = img.getAttribute("data-lightbox-src");
      el.lightboxModal.classList.remove("hidden");
    }
  });
  el.lightboxClose.addEventListener("click", () => {
    el.lightboxModal.classList.add("hidden");
    el.lightboxImg.src = "";
  });
  el.lightboxModal.addEventListener("click", (e) => {
    if (e.target === el.lightboxModal) {
      el.lightboxModal.classList.add("hidden");
      el.lightboxImg.src = "";
    }
  });

  async function boot() {
    try {
      const params = new URLSearchParams(window.location.search);
      const editId = params.get("edit");
      const tab = params.get("tab");
      if (editId) {
        state.editingPostId = editId;
        state.adminTab = "editor";
      } else if (["list", "drafts", "editor", "taxonomies", "settings"].includes(tab)) {
        state.adminTab = tab;
      }

      const [meRes, siteRes] = await Promise.all([api("/api/me"), api("/api/site")]);
      state.authenticated = Boolean(meRes.authenticated);
      state.configured = Boolean(meRes.configured);
      state.site = siteRes.settings || state.site;
      await renderStudio();
    } catch (err) {
      el.studioView.innerHTML = `<div class="empty-msg">加载失败：${escapeHtml(err.message)}</div>`;
    }
  }

  boot();
})();
