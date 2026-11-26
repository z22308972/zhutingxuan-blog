/**
 * 极简博客前端主程序（公开阅读 + 博主密码保护写作后台）
 */
(function () {
  const { escapeHtml, renderMarkdown, stripMarkdown, estimateReadMinutes } = window.BlogMarkdown;

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
    posts: [],
    adminPosts: [],
    authenticated: false,
    configured: true,
    homeCategory: "全部",
    homeSearch: "",
    adminTab: "list", // 'list' | 'editor' | 'settings'
    editingPostId: null,
    uploadTarget: null // 'cover' | 'inline' | 'avatar'
  };

  const el = {
    sidebar: document.getElementById("sidebar"),
    menuToggle: document.getElementById("menu-toggle"),
    siteLogo: document.getElementById("site-logo"),
    mobileAvatar: document.getElementById("mobile-avatar"),
    siteTitle: document.getElementById("site-title"),
    mobileSiteTitle: document.getElementById("mobile-site-title"),
    siteMotto: document.getElementById("site-motto"),
    socialRow: document.getElementById("social-row"),
    footerDomain: document.getElementById("footer-domain"),
    particleToggle: document.getElementById("particle-toggle"),
    appView: document.getElementById("app-view"),
    progressFill: document.getElementById("reading-progress-fill"),
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

  // ==================== 侧边栏渲染 ====================
  function renderSidebar() {
    const s = state.site;
    document.title = `${s.siteName} · 极简博客`;
    el.siteTitle.textContent = s.siteName;
    el.mobileSiteTitle.textContent = s.siteName;
    el.siteMotto.textContent = s.motto;
    el.footerDomain.textContent = s.footerText || "blog.zhutingxuan.ggff.net";

    const setAvatar = (node) => {
      if (s.avatarUrl) {
        node.innerHTML = `<img src="${escapeHtml(s.avatarUrl)}" alt="${escapeHtml(s.siteName)}" />`;
      } else {
        node.textContent = s.avatarText || "ZT";
      }
    };
    setAvatar(el.siteLogo);
    setAvatar(el.mobileAvatar);

    const socials = [];
    if (s.github) {
      socials.push(
        `<a class="social-link" href="${escapeHtml(s.github)}" target="_blank" rel="noopener noreferrer" title="GitHub">` +
          `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5C5.65.5.5 5.65.5 12c0 5.09 3.29 9.4 7.86 10.92.58.11.79-.25.79-.56v-2.12c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.7 1.25 3.36.96.1-.74.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.25.45-2.28 1.18-3.08-.12-.29-.51-1.46.11-3.04 0 0 .97-.31 3.17 1.18a10.96 10.96 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.62 1.58.23 2.75.11 3.04.74.8 1.18 1.83 1.18 3.08 0 4.41-2.69 5.39-5.26 5.67.41.36.78 1.06.78 2.13v3.16c0 .31.21.67.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z"/></svg></a>`
      );
    }
    if (s.bilibili) {
      socials.push(
        `<a class="social-link" href="${escapeHtml(s.bilibili)}" target="_blank" rel="noopener noreferrer" title="Bilibili">` +
          `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="6" width="18" height="13" rx="3"/><path d="M8 3l3 3M16 3l-3 3M9 11v2M15 11v2"/></svg></a>`
      );
    }
    if (s.email) {
      socials.push(
        `<a class="social-link" href="mailto:${escapeHtml(s.email)}" title="Email">` +
          `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg></a>`
      );
    }
    el.socialRow.innerHTML = socials.join("");
    el.socialRow.classList.toggle("hidden", socials.length === 0);

    updateParticleLabel();
  }

  function updateParticleLabel() {
    const on = window.ParticleField ? window.ParticleField.isEnabled() : false;
    el.particleToggle.textContent = on ? "粒子: 开" : "粒子: 关";
  }

  function setActiveNav(navKey) {
    document.querySelectorAll(".site-nav").forEach((a) => {
      a.classList.toggle("active", a.dataset.nav === navKey);
    });
  }

  // ==================== 路由解析 ====================
  function parseRoute() {
    const raw = (window.location.hash || "#/").replace(/^#/, "");
    const clean = raw.startsWith("/") ? raw : "/" + raw;
    if (clean === "/" || clean === "") return { page: "home" };
    if (clean === "/categories") return { page: "categories" };
    if (clean.startsWith("/category/")) {
      return { page: "category", value: decodeURIComponent(clean.slice("/category/".length)) };
    }
    if (clean === "/tags") return { page: "tags" };
    if (clean.startsWith("/tag/")) {
      return { page: "tag", value: decodeURIComponent(clean.slice("/tag/".length)) };
    }
    if (clean === "/archives") return { page: "archives" };
    if (clean === "/about") return { page: "about" };
    if (clean === "/admin") return { page: "admin" };
    if (clean.startsWith("/post/")) {
      return { page: "post", value: decodeURIComponent(clean.slice("/post/".length)) };
    }
    return { page: "home" };
  }

  function getCategoryStats(posts) {
    const map = new Map();
    posts.forEach((p) => {
      const cat = p.category || "随笔";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat).push(p);
    });
    return Array.from(map.entries()).map(([name, items]) => ({ name, items }));
  }

  function getTagStats(posts) {
    const map = new Map();
    posts.forEach((p) => {
      (p.tags || []).forEach((t) => {
        if (!map.has(t)) map.set(t, []);
        map.get(t).push(p);
      });
    });
    return Array.from(map.entries())
      .map(([name, items]) => ({ name, items }))
      .sort((a, b) => b.items.length - a.items.length);
  }

  function renderPostListHtml(posts) {
    if (!posts.length) {
      return '<div class="empty-msg">这里暂时还没有文章 ✨</div>';
    }
    return posts
      .map((post) => {
        const excerpt =
          post.abstract || stripMarkdown(post.content).slice(0, 120) + "...";
        const mins = estimateReadMinutes(post.content);
        const cat = post.category || "随笔";
        const tagsHtml = (post.tags || [])
          .map(
            (t) =>
              `<a class="inline-tag" href="#/tag/${encodeURIComponent(t)}"># ${escapeHtml(t)}</a>`
          )
          .join("");

        const coverHtml = post.cover
          ? `<a class="right" href="#/post/${encodeURIComponent(post.slug)}">
               <div class="feature-container" style="background-image:url('${escapeHtml(post.cover)}')"></div>
             </a>`
          : "";

        return `
          <article class="post-item">
            <div class="left">
              <a href="#/post/${encodeURIComponent(post.slug)}">
                <h2 class="post-title">${escapeHtml(post.title)}</h2>
              </a>
              <div class="post-meta-line">
                <span>${escapeHtml(post.published_at)}</span>
                <span class="meta-sep">·</span>
                <span>约 ${mins} 分钟阅读</span>
                <a class="meta-cat" href="#/category/${encodeURIComponent(cat)}">${escapeHtml(cat)}</a>
              </div>
              <div class="post-abstract">${escapeHtml(excerpt)}</div>
              ${tagsHtml ? `<div class="post-inline-tags">${tagsHtml}</div>` : ""}
            </div>
            ${coverHtml}
          </article>
        `;
      })
      .join("");
  }

  // ==================== 公开页面渲染 ====================
  function renderHome() {
    setActiveNav("home");
    const cats = ["全部", ...getCategoryStats(state.posts).map((c) => c.name)];
    const q = state.homeSearch.trim().toLowerCase();
    const filtered = state.posts.filter((p) => {
      if (state.homeCategory !== "全部" && (p.category || "随笔") !== state.homeCategory) {
        return false;
      }
      if (q) {
        const hay = `${p.title}\n${p.abstract}\n${p.content}\n${p.category}\n${(p.tags || []).join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    el.appView.innerHTML = `
      <div class="home-toolbar">
        <div class="cat-pills">
          ${cats
            .map(
              (c) =>
                `<button type="button" class="cat-pill${state.homeCategory === c ? " active" : ""}" data-cat="${escapeHtml(c)}">${escapeHtml(c)}</button>`
            )
            .join("")}
        </div>
        <div class="search-wrap">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input id="home-search" class="search-input" type="search" placeholder="搜索文章或标签..." value="${escapeHtml(state.homeSearch)}" />
        </div>
      </div>
      <div id="home-post-list">${renderPostListHtml(filtered)}</div>
    `;

    el.appView.querySelectorAll(".cat-pill").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.homeCategory = btn.dataset.cat;
        renderHome();
      });
    });

    const searchEl = document.getElementById("home-search");
    searchEl.addEventListener("input", () => {
      state.homeSearch = searchEl.value;
      const list = state.posts.filter((p) => {
        if (state.homeCategory !== "全部" && (p.category || "随笔") !== state.homeCategory) {
          return false;
        }
        const term = state.homeSearch.trim().toLowerCase();
        if (!term) return true;
        return `${p.title}\n${p.abstract}\n${p.content}\n${p.category}\n${(p.tags || []).join(" ")}`
          .toLowerCase()
          .includes(term);
      });
      document.getElementById("home-post-list").innerHTML = renderPostListHtml(list);
    });
  }

  function renderCategories(selectedCategory = null) {
    setActiveNav("categories");
    const stats = getCategoryStats(state.posts);

    if (selectedCategory) {
      const matched = state.posts.filter((p) => (p.category || "随笔") === selectedCategory);
      el.appView.innerHTML = `
        <a class="back-link" href="#/categories">← 返回全部分类</a>
        <h2 class="page-title">${escapeHtml(selectedCategory)}</h2>
        <p class="page-desc">该分类下共有 ${matched.length} 篇文章</p>
        ${renderPostListHtml(matched)}
      `;
      return;
    }

    el.appView.innerHTML = `
      <h2 class="page-title">文章分类</h2>
      <p class="page-desc">共 ${stats.length} 个分类 · ${state.posts.length} 篇公开文章</p>
      <div class="category-grid">
        ${stats
          .map(
            (c) => `
          <div class="category-card">
            <div class="category-card-top">
              <a class="category-name" href="#/category/${encodeURIComponent(c.name)}">${escapeHtml(c.name)}</a>
              <span class="category-badge">${c.items.length} 篇</span>
            </div>
            <ul class="category-preview-list">
              ${c.items
                .slice(0, 4)
                .map(
                  (p) => `
                <li>
                  <a href="#/post/${encodeURIComponent(p.slug)}">${escapeHtml(p.title)}</a>
                  <span class="category-preview-date">${escapeHtml(p.published_at)}</span>
                </li>`
                )
                .join("")}
            </ul>
          </div>`
          )
          .join("")}
      </div>
    `;
  }

  function renderTags(selectedTag = null) {
    setActiveNav("tags");
    const tags = getTagStats(state.posts);
    const matched = selectedTag
      ? state.posts.filter((p) => (p.tags || []).includes(selectedTag))
      : [];

    el.appView.innerHTML = `
      <h2 class="page-title">${selectedTag ? `# ${escapeHtml(selectedTag)}` : "标签列表"}</h2>
      <p class="page-desc">${
        selectedTag
          ? `带有「${escapeHtml(selectedTag)}」标签的文章共 ${matched.length} 篇`
          : `共 ${tags.length} 个标签，点击任意标签即可筛选文章`
      }</p>
      <div class="tag-container" style="margin-top:0;margin-bottom:36px;">
        ${tags
          .map(
            (t) =>
              `<a class="tag-pill${selectedTag === t.name ? " active" : ""}" href="#/tag/${encodeURIComponent(t.name)}"># ${escapeHtml(t.name)} <span class="tag-count">${t.items.length}</span></a>`
          )
          .join("")}
      </div>
      ${selectedTag ? renderPostListHtml(matched) : ""}
    `;
  }

  function renderArchives() {
    setActiveNav("archives");
    const groups = new Map();
    state.posts.forEach((p) => {
      const year = String(p.published_at || "2026").slice(0, 4);
      if (!groups.has(year)) groups.set(year, []);
      groups.get(year).push(p);
    });

    const yearsHtml = Array.from(groups.entries())
      .map(
        ([year, items]) => `
        <h3 class="archives-year">${escapeHtml(year)} 年</h3>
        <ul class="archives-list">
          ${items
            .map(
              (p) => `
            <li class="archive-row">
              <span class="archive-date">${escapeHtml(p.published_at)}</span>
              <a class="archive-title" href="#/post/${encodeURIComponent(p.slug)}">${escapeHtml(p.title)}</a>
              <a class="meta-cat" href="#/category/${encodeURIComponent(p.category || "随笔")}">${escapeHtml(p.category || "随笔")}</a>
            </li>`
            )
            .join("")}
        </ul>`
      )
      .join("");

    el.appView.innerHTML = `
      <h2 class="page-title">文章归档</h2>
      <p class="page-desc">目前一共记录了 ${state.posts.length} 篇文章</p>
      ${yearsHtml || '<div class="empty-msg">还没有发布文章</div>'}
    `;
  }

  function renderAbout() {
    setActiveNav("about");
    el.appView.innerHTML = `
      <article class="post-detail">
        <h2 class="post-title" style="margin-bottom:24px;">关于我</h2>
        <div class="post-content">${renderMarkdown(state.site.aboutContent)}</div>
      </article>
    `;
  }

  async function renderPostDetail(slugOrId) {
    setActiveNav("home");
    let post = state.posts.find((p) => p.slug === slugOrId || p.id === slugOrId);
    if (!post) {
      try {
        const res = await api(`/api/posts/${encodeURIComponent(slugOrId)}`);
        post = res.post;
      } catch {
        el.appView.innerHTML = `<div class="empty-msg">未找到该文章 · <a href="#/" style="text-decoration:underline">返回首页</a></div>`;
        return;
      }
    }

    const idx = state.posts.findIndex((p) => p.id === post.id);
    const prevPost = idx > 0 ? state.posts[idx - 1] : null;
    const nextPost = idx !== -1 && idx + 1 < state.posts.length ? state.posts[idx + 1] : null;
    const mins = estimateReadMinutes(post.content);
    const cat = post.category || "随笔";

    el.appView.innerHTML = `
      <article class="post-detail">
        <a class="back-link" href="#/">← 返回文章列表</a>
        <div class="post-detail-head">
          <h1 class="post-title">${escapeHtml(post.title)}</h1>
          ${
            state.authenticated
              ? `<button id="quick-edit-btn" class="btn btn-outline" type="button" style="flex-shrink:0">编辑本文</button>`
              : ""
          }
        </div>
        <div class="post-meta-line" style="padding:18px 0 22px;">
          <span>${escapeHtml(post.published_at)}</span>
          <span class="meta-sep">·</span>
          <span>约 ${mins} 分钟阅读</span>
          <a class="meta-cat" href="#/category/${encodeURIComponent(cat)}">${escapeHtml(cat)}</a>
        </div>
        ${
          post.cover
            ? `<div class="feature-container" style="background-image:url('${escapeHtml(post.cover)}')"></div>`
            : ""
        }
        <div class="post-content">${renderMarkdown(post.content)}</div>
        ${
          post.tags?.length
            ? `<div class="tag-container">${post.tags
                .map(
                  (t) =>
                    `<a class="tag-pill" href="#/tag/${encodeURIComponent(t)}"># ${escapeHtml(t)}</a>`
                )
                .join("")}</div>`
            : ""
        }
        ${
          prevPost || nextPost
            ? `<nav class="post-nav-box">
                <div class="post-nav-item">
                  ${
                    prevPost
                      ? `<div class="post-nav-label">← 上一篇</div><a class="post-nav-title" href="#/post/${encodeURIComponent(prevPost.slug)}">${escapeHtml(prevPost.title)}</a>`
                      : ""
                  }
                </div>
                <div class="post-nav-item next">
                  ${
                    nextPost
                      ? `<div class="post-nav-label">下一篇 →</div><a class="post-nav-title" href="#/post/${encodeURIComponent(nextPost.slug)}">${escapeHtml(nextPost.title)}</a>`
                      : ""
                  }
                </div>
              </nav>`
            : ""
        }
      </article>
    `;

    const quickEdit = document.getElementById("quick-edit-btn");
    if (quickEdit) {
      quickEdit.addEventListener("click", () => {
        state.editingPostId = post.id;
        state.adminTab = "editor";
        window.location.hash = "#/admin";
      });
    }
  }

  // ==================== 博主专属写作后台（仅你可发表与修改） ====================
  async function renderAdmin() {
    setActiveNav("");
    if (!state.authenticated) {
      el.appView.innerHTML = `
        <div class="admin-login-box">
          <h2>博主写作后台</h2>
          <p>所有访客均可自由浏览博客；仅博主输入密码后可发表、修改文章或调整站点设置。</p>
          <form id="admin-login-form" class="admin-login-form">
            <input id="admin-password" class="input-field" type="password" placeholder="请输入博主访问密码" autocomplete="current-password" required />
            <div id="admin-login-error" class="alert-error hidden"></div>
            <button id="admin-login-btn" class="btn btn-dark" type="submit">登录写作后台</button>
            <a href="#/" class="btn btn-outline">返回博客首页</a>
          </form>
        </div>
      `;

      const form = document.getElementById("admin-login-form");
      const errBox = document.getElementById("admin-login-error");
      const passInput = document.getElementById("admin-password");
      if (!state.configured) {
        errBox.textContent = "尚未配置密码，请在 Cloudflare Pages 环境变量中添加 APP_PASSWORD";
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
          await loadAdminPosts();
          showToast("欢迎回来，已进入写作后台 ✨");
          renderAdmin();
        } catch (err) {
          errBox.textContent = err.message;
          errBox.classList.remove("hidden");
        }
      });
      setTimeout(() => passInput.focus(), 40);
      return;
    }

    await loadAdminPosts();

    el.appView.innerHTML = `
      <div class="admin-header">
        <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;">
          <a href="#/" class="btn btn-outline">← 返回博客</a>
          <div>
            <h2 class="page-title" style="margin-bottom:2px;font-size:24px;">写作后台</h2>
            <div style="font-size:12.5px;color:var(--text-muted)">全屏专注模式 · 仅你本人拥有发布与修改权限</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          <div class="admin-tabs">
            <button type="button" class="admin-tab${state.adminTab === "list" ? " active" : ""}" data-tab="list">文章管理 (${state.adminPosts.length})</button>
            <button type="button" class="admin-tab${state.adminTab === "editor" ? " active" : ""}" data-tab="editor">${state.editingPostId ? "编辑文章" : "写新文章"}</button>
            <button type="button" class="admin-tab${state.adminTab === "settings" ? " active" : ""}" data-tab="settings">站点设置</button>
          </div>
          <button id="admin-logout-btn" class="btn btn-outline" type="button">退出后台</button>
        </div>
      </div>
      <div id="admin-panel"></div>
    `;

    el.appView.querySelectorAll(".admin-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.dataset.tab === "editor" && state.adminTab !== "editor") {
          state.editingPostId = null;
        }
        state.adminTab = btn.dataset.tab;
        renderAdmin();
      });
    });

    document.getElementById("admin-logout-btn").addEventListener("click", async () => {
      await api("/api/logout", { method: "POST" }).catch(() => {});
      state.authenticated = false;
      showToast("已退出写作后台");
      window.location.hash = "#/";
    });

    const panel = document.getElementById("admin-panel");
    if (state.adminTab === "list") renderAdminList(panel);
    else if (state.adminTab === "editor") renderAdminEditor(panel);
    else renderAdminSettings(panel);
  }

  function renderAdminList(panel) {
    panel.innerHTML = `
      <div class="admin-card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
          <strong style="font-size:15px;">全部文章</strong>
          <button id="new-post-btn" class="btn btn-accent" type="button">+ 写新文章</button>
        </div>
        ${
          state.adminPosts.length === 0
            ? '<div class="empty-msg">还没有文章，点击右上角写下第一篇吧</div>'
            : state.adminPosts
                .map(
                  (p) => `
          <div class="admin-post-row">
            <div>
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                <span class="status-dot ${p.published ? "pub" : "draft"}">${p.published ? "已发布" : "草稿"}</span>
                <strong style="font-size:15.5px;">${escapeHtml(p.title)}</strong>
              </div>
              <div style="font-size:12.5px;color:var(--text-muted);margin-top:4px;">
                ${escapeHtml(p.published_at)} · 分类：${escapeHtml(p.category || "随笔")} ${
                  p.tags?.length ? `· 标签：${p.tags.map(escapeHtml).join(" / ")}` : ""
                }
              </div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <a class="btn btn-outline" href="#/post/${encodeURIComponent(p.slug)}">查看</a>
              <button class="btn btn-outline edit-post-btn" type="button" data-id="${escapeHtml(p.id)}">编辑</button>
              <button class="btn btn-danger del-post-btn" type="button" data-id="${escapeHtml(p.id)}">删除</button>
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
      renderAdmin();
    });

    panel.querySelectorAll(".edit-post-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.editingPostId = btn.dataset.id;
        state.adminTab = "editor";
        renderAdmin();
      });
    });

    panel.querySelectorAll(".del-post-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        if (!window.confirm("确认删除这篇文章吗？删除后无法恢复。")) return;
        try {
          await api(`/api/posts/${encodeURIComponent(id)}`, { method: "DELETE" });
          await refreshPublicPosts();
          await loadAdminPosts();
          showToast("文章已删除");
          renderAdmin();
        } catch (err) {
          showToast("删除失败：" + err.message);
        }
      });
    });
  }

  function renderAdminEditor(panel) {
    const existing = state.editingPostId
      ? state.adminPosts.find((p) => p.id === state.editingPostId)
      : null;
    const today = new Date().toISOString().slice(0, 10);
    const existingCats = Array.from(
      new Set(["效率与技术", "城市随笔", "数字花园", "读书笔记", ...state.adminPosts.map((p) => p.category || "随笔")])
    );

    panel.innerHTML = `
      <form id="post-editor-form" class="admin-card">
        <div class="meta-toggle-row">
          <div style="flex:1;min-width:240px;">
            <input id="ed-title" class="input-field" style="font-size:18px;font-weight:600;padding:11px 14px;" type="text" required placeholder="输入文章标题..." value="${escapeHtml(existing?.title || "")}" />
          </div>
          <button id="toggle-meta-btn" class="btn btn-outline" type="button">收起文章信息</button>
        </div>

        <div id="ed-meta-grid" class="form-grid">
          <div class="form-field">
            <label class="form-label" for="ed-category">文章分类</label>
            <input id="ed-category" class="input-field" type="text" list="cat-suggestions" placeholder="如：城市随笔、效率与技术" value="${escapeHtml(existing?.category || "随笔")}" />
            <datalist id="cat-suggestions">
              ${existingCats.map((c) => `<option value="${escapeHtml(c)}"></option>`).join("")}
            </datalist>
          </div>

          <div class="form-field">
            <label class="form-label" for="ed-date">发布日期</label>
            <input id="ed-date" class="input-field" type="date" value="${escapeHtml(existing?.published_at || today)}" />
          </div>

          <div class="form-field">
            <label class="form-label" for="ed-tags">标签（用逗号分隔）</label>
            <input id="ed-tags" class="input-field" type="text" placeholder="例如：写作, 生活, 上海" value="${escapeHtml((existing?.tags || []).join(", "))}" />
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

    toggleMetaBtn.addEventListener("click", () => {
      const collapsed = metaGrid.classList.toggle("hidden");
      toggleMetaBtn.textContent = collapsed ? "展开文章信息" : "收起文章信息";
    });

    // 实时同步渲染（含中文输入法、粘贴、拖拽与字数统计）
    const syncPreview = () => {
      const text = ta.value;
      preview.innerHTML = renderMarkdown(text);
      const count = text.replace(/\s+/g, "").length;
      wordCountEl.textContent = `${count} 字 · 左右滚动实时同步`;
      // 如果光标在文末附近，保持预览区同步跟进
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

    // 双向平滑滚动同步（避免相互触发抖动）
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

    // 计算拖放坐标对应的 textarea 字符精确落点（支持自动换行和中文排版）
    function getDropOffsetInTextarea(textarea, clientX, clientY) {
      const rect = textarea.getBoundingClientRect();
      const style = window.getComputedStyle(textarea);
      const value = textarea.value;
      if (!value) return 0;

      // 构造等宽等字体的隐藏镜像层，利用 caretRangeFromPoint/caretPositionFromPoint 获取精准字符索引
      const mirror = document.createElement("div");
      const copyProps = [
        "boxSizing",
        "fontFamily",
        "fontSize",
        "fontWeight",
        "fontStyle",
        "letterSpacing",
        "lineHeight",
        "textTransform",
        "wordSpacing",
        "tabSize",
        "paddingTop",
        "paddingRight",
        "paddingBottom",
        "paddingLeft",
        "borderTopWidth",
        "borderRightWidth",
        "borderBottomWidth",
        "borderLeftWidth"
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

      // 兜底：按行高估算逻辑行尾位置
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

    // 统一上传并插入图片到正文指定位置（支持粘贴、拖拽、按钮选择）
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

      // 确保图片独立成行，避免打断当前句子
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

    // 1. 支持 Cmd+V / Ctrl+V 直接粘贴截图或图片上传
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

    // 2. 支持拖拽图片到正文任意位置松手精准插入（兼容 Chrome / Safari）
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

    // Tab 缩进支持
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

    // 封面区也支持直接拖拽上传封面图
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

    // 把当前编辑器的上传回调挂到全局，供「📷 插入照片」按钮复用同一逻辑
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
      renderAdmin();
    });

    document.getElementById("post-editor-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const saveBtn = document.getElementById("ed-save-btn");
      saveBtn.disabled = true;

      const tags = document
        .getElementById("ed-tags")
        .value.split(/[,，]/)
        .map((t) => t.trim())
        .filter(Boolean);

      const payload = {
        title: document.getElementById("ed-title").value.trim(),
        category: document.getElementById("ed-category").value.trim() || "随笔",
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

        await refreshPublicPosts();
        await loadAdminPosts();
        state.editingPostId = null;
        showToast(existing ? "文章修改已保存 ✓" : "文章发布成功 🎉");
        if (payload.published && res.post?.slug) {
          window.location.hash = `#/post/${encodeURIComponent(res.post.slug)}`;
        } else {
          state.adminTab = "list";
          renderAdmin();
        }
      } catch (err) {
        showToast("保存失败：" + err.message);
      } finally {
        saveBtn.disabled = false;
      }
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
            <input id="st-email" class="input-field" type="email" placeholder="hello@zhutingxuan.ggff.net" value="${escapeHtml(s.email)}" />
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
        renderSidebar();
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

  // ==================== 数据加载与路由分发 ====================
  async function refreshPublicPosts() {
    const res = await api("/api/posts");
    state.posts = res.posts || [];
  }

  async function loadAdminPosts() {
    const res = await api("/api/posts?all=1");
    state.adminPosts = res.posts || [];
  }

  async function renderCurrentRoute() {
    el.sidebar.classList.remove("open");
    window.scrollTo({ top: 0, behavior: "instant" });
    el.progressFill.style.width = "0%";

    const route = parseRoute();
    const isAdmin = route.page === "admin";
    document.body.classList.toggle("admin-fullscreen", isAdmin);
    window.dispatchEvent(new Event("resize"));

    switch (route.page) {
      case "home": renderHome(); break;
      case "categories": renderCategories(null); break;
      case "category": renderCategories(route.value); break;
      case "tags": renderTags(null); break;
      case "tag": renderTags(route.value); break;
      case "archives": renderArchives(); break;
      case "about": renderAbout(); break;
      case "post": await renderPostDetail(route.value); break;
      case "admin": await renderAdmin(); break;
      default: renderHome();
    }
  }

  // 全局交互
  el.menuToggle.addEventListener("click", () => {
    el.sidebar.classList.toggle("open");
  });

  el.particleToggle.addEventListener("click", () => {
    if (!window.ParticleField) return;
    const on = window.ParticleField.toggle();
    updateParticleLabel();
    showToast(on ? "已开启柔和粒子背景" : "已暂停背景粒子");
  });

  el.appView.addEventListener("click", (e) => {
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

  window.addEventListener("scroll", () => {
    const route = parseRoute();
    if (route.page !== "post") {
      el.progressFill.style.width = "0%";
      return;
    }
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const pct = maxScroll > 0 ? Math.min(100, (window.scrollY / maxScroll) * 100) : 0;
    el.progressFill.style.width = `${pct}%`;
  });

  window.addEventListener("hashchange", renderCurrentRoute);

  async function boot() {
    try {
      const [meRes, siteRes, postsRes] = await Promise.all([
        api("/api/me"),
        api("/api/site"),
        api("/api/posts")
      ]);
      state.authenticated = Boolean(meRes.authenticated);
      state.configured = Boolean(meRes.configured);
      state.site = siteRes.settings || state.site;
      state.posts = postsRes.posts || [];
      renderSidebar();
      await renderCurrentRoute();
    } catch (err) {
      el.appView.innerHTML = `<div class="empty-msg">加载失败：${escapeHtml(err.message)}</div>`;
    }
  }

  boot();
})();
