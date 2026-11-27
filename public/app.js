/**
 * 极简博客公开阅读前端（与独立写作后台 /studio 完全分离）
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
    authenticated: false,
    homeCategory: "全部",
    homeSearch: ""
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
    lightboxModal: document.getElementById("lightbox-modal"),
    lightboxImg: document.getElementById("lightbox-img"),
    lightboxClose: document.getElementById("lightbox-close"),
    toast: document.getElementById("toast")
  };

  const EYE_ICON_SVG =
    '<svg width="13.5" height="13.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';

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

  // ==================== 侧边栏渲染 ====================
  function renderSidebar() {
    const s = state.site;
    document.title = `${s.siteName} · 极简博客`;
    el.siteTitle.innerHTML = `<a href="#/">${escapeHtml(s.siteName)}</a>`;
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
    if (clean === "/admin" || clean === "/studio") return { page: "studio-redirect" };
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
        const views = Number(post.views || 0);
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
                <span class="meta-sep">·</span>
                <span class="meta-views" title="文章浏览量">${EYE_ICON_SVG}<span>${formatViewsText(views)}</span></span>
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
    const views = Number(post.views || 0);

    el.appView.innerHTML = `
      <article class="post-detail">
        <a class="back-link" href="#/">← 返回文章列表</a>
        <div class="post-detail-head">
          <h1 class="post-title">${escapeHtml(post.title)}</h1>
          ${
            state.authenticated
              ? `<a class="btn btn-outline" href="/studio?edit=${encodeURIComponent(post.id)}" style="flex-shrink:0">编辑本文</a>`
              : ""
          }
        </div>
        <div class="post-meta-line" style="padding:18px 0 22px;">
          <span>${escapeHtml(post.published_at)}</span>
          <span class="meta-sep">·</span>
          <span>约 ${mins} 分钟阅读</span>
          <span class="meta-sep">·</span>
          <span id="post-detail-views" class="meta-views" title="文章浏览量">${EYE_ICON_SVG}<span>${formatViewsText(views)}</span></span>
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

    // 统计文章浏览量并即时刷新标题下方的展示数字
    if (post.published !== false) {
      api(`/api/posts/${encodeURIComponent(post.slug)}/view`, { method: "POST" })
        .then((res) => {
          if (typeof res.views === "number") {
            post.views = res.views;
            const inList = state.posts.find((p) => p.id === post.id);
            if (inList) inList.views = res.views;
            const viewsNode = document.getElementById("post-detail-views");
            if (viewsNode) {
              viewsNode.innerHTML = `${EYE_ICON_SVG}<span>${formatViewsText(res.views)}</span>`;
            }
          }
        })
        .catch(() => {});
    }
  }

  // ==================== 路由分发 ====================
  async function renderCurrentRoute() {
    el.sidebar.classList.remove("open");
    window.scrollTo({ top: 0, behavior: "instant" });
    el.progressFill.style.width = "0%";

    const route = parseRoute();
    if (route.page === "studio-redirect") {
      window.location.replace("/studio");
      return;
    }

    switch (route.page) {
      case "home": renderHome(); break;
      case "categories": renderCategories(null); break;
      case "category": renderCategories(route.value); break;
      case "tags": renderTags(null); break;
      case "tag": renderTags(route.value); break;
      case "archives": renderArchives(); break;
      case "about": renderAbout(); break;
      case "post": await renderPostDetail(route.value); break;
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
