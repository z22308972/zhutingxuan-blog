/**
 * 极简博客防 XSS Markdown 渲染器与阅读时长估算
 */
(function () {
  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function sanitizeUrl(rawUrl) {
    const url = String(rawUrl || "").trim();
    if (!url) return "";
    if (url.startsWith("/") && !url.startsWith("//")) return url;
    if (/^https?:\/\//i.test(url) || /^mailto:/i.test(url)) return url;
    return "";
  }

  function renderInline(text) {
    const tokens = [];
    const stash = (html) => {
      const idx = tokens.length;
      tokens.push(html);
      return `\u0000TOK${idx}\u0000`;
    };
    let s = escapeHtml(text);

    s = s.replace(/`([^`\n]+)`/g, (_, code) => stash(`<code>${code}</code>`));

    s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, rawUrl) => {
      const safe = sanitizeUrl(rawUrl);
      if (!safe) return escapeHtml(alt || "");
      return stash(
        `<img src="${escapeHtml(safe)}" alt="${alt || "配图"}" loading="lazy" data-lightbox-src="${escapeHtml(safe)}" />`
      );
    });

    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, rawUrl) => {
      let safe = sanitizeUrl(rawUrl);
      // 兼容旧版「链接」按钮误填 https://example.com 或空白 https:// 占位符：若显示文字本身就是网址则直接跳转到该真实网址
      const trimmedLabel = String(label || "").trim();
      if (
        (/^https?:\/\/example\.com\/?$/i.test(safe) || /^https?:\/\/?$/i.test(safe) || !safe) &&
        /^https?:\/\/\S+$/i.test(trimmedLabel)
      ) {
        safe = sanitizeUrl(trimmedLabel);
      }
      if (!safe) return label;
      const ext = /^https?:\/\//i.test(safe) ? ' target="_blank" rel="noopener noreferrer"' : "";
      return stash(`<a href="${escapeHtml(safe)}"${ext}>${label}</a>`);
    });

    // 自动识别正文中的裸网址（https:// 或 http://），直接粘贴即可点击跳转
    s = s.replace(/(https?:\/\/[^\s<>"'）)】」』，。；！？、]+)/gi, (rawUrl) => {
      const cleaned = rawUrl.replace(/[.,;:!?]+$/, "");
      const trailing = rawUrl.slice(cleaned.length);
      const safe = sanitizeUrl(cleaned);
      if (!safe) return rawUrl;
      return stash(`<a href="${escapeHtml(safe)}" target="_blank" rel="noopener noreferrer">${cleaned}</a>`) + trailing;
    });

    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/__([^_]+)__/g, "<strong>$1</strong>");
    s = s.replace(/~~([^~]+)~~/g, "<del>$1</del>");
    s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");

    return s.replace(/\u0000TOK(\d+)\u0000/g, (_, idx) => tokens[Number(idx)] || "");
  }

  function isTableDivider(line) {
    return /^\s*\|?(\s*:?-{3,}:?\s*\|)+\s*:?-{3,}:?\s*\|?\s*$/.test(line);
  }

  function splitCells(line) {
    return line
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => c.trim());
  }

  function renderMarkdown(md) {
    if (!md || !md.trim()) return '<p class="muted-empty">暂无正文内容</p>';

    const lines = String(md).replace(/\r\n?/g, "\n").split("\n");
    const out = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      if (/^\s*$/.test(line)) {
        i++;
        continue;
      }

      const fence = line.match(/^```(.*)$/);
      if (fence) {
        const lang = escapeHtml((fence[1] || "").trim().split(/\s+/)[0] || "CODE").toUpperCase();
        const buf = [];
        i++;
        while (i < lines.length && !/^```\s*$/.test(lines[i])) {
          buf.push(lines[i]);
          i++;
        }
        if (i < lines.length) i++;
        out.push(`<pre data-lang="${lang}"><code>${escapeHtml(buf.join("\n"))}</code></pre>`);
        continue;
      }

      if (/^\s*(?:[-*_]\s*){3,}$/.test(line)) {
        out.push("<hr />");
        i++;
        continue;
      }

      const h = line.match(/^(#{1,6})\s+(.*)$/);
      if (h) {
        const level = Math.min(h[1].length, 4);
        const text = h[2].trim();
        out.push(text ? `<h${level}>${renderInline(text)}</h${level}>` : `<p>${escapeHtml(line)}</p>`);
        i++;
        continue;
      }

      if (/^\s*>\s?/.test(line)) {
        const q = [];
        while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
          q.push(lines[i].replace(/^\s*>\s?/, ""));
          i++;
        }
        out.push(`<blockquote><p>${q.map(renderInline).join("<br />")}</p></blockquote>`);
        continue;
      }

      if (line.includes("|") && i + 1 < lines.length && isTableDivider(lines[i + 1])) {
        const headers = splitCells(line);
        i += 2;
        const rows = [];
        while (i < lines.length && lines[i].includes("|") && !/^\s*$/.test(lines[i])) {
          rows.push(splitCells(lines[i]));
          i++;
        }
        const thead = `<thead><tr>${headers.map((c) => `<th>${renderInline(c)}</th>`).join("")}</tr></thead>`;
        const tbody = `<tbody>${rows
          .map(
            (r) =>
              `<tr>${headers
                .map((_, idx) => `<td>${renderInline(r[idx] || "")}</td>`)
                .join("")}</tr>`
          )
          .join("")}</tbody>`;
        out.push(`<div class="table-wrap"><table>${thead}${tbody}</table></div>`);
        continue;
      }

      if (/^\s*[-*+]\s+/.test(line)) {
        const items = [];
        let hasTask = false;
        while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
          const raw = lines[i].replace(/^\s*[-*+]\s+/, "");
          const t = raw.match(/^\[( |x|X)\]\s+(.*)$/);
          if (t) {
            hasTask = true;
            const done = t[1].toLowerCase() === "x";
            items.push(
              `<li class="task-item${done ? " done" : ""}"><span class="task-box">${done ? "✓" : ""}</span><span>${renderInline(t[2])}</span></li>`
            );
          } else {
            items.push(`<li>${renderInline(raw)}</li>`);
          }
          i++;
        }
        out.push(`<ul${hasTask ? ' class="task-list"' : ""}>${items.join("")}</ul>`);
        continue;
      }

      if (/^\s*\d+\.\s+/.test(line)) {
        const items = [];
        while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
          items.push(`<li>${renderInline(lines[i].replace(/^\s*\d+\.\s+/, ""))}</li>`);
          i++;
        }
        out.push(`<ol>${items.join("")}</ol>`);
        continue;
      }

      const para = [];
      while (
        i < lines.length &&
        !/^\s*$/.test(lines[i]) &&
        !/^```/.test(lines[i]) &&
        !/^(#{1,6})\s+/.test(lines[i]) &&
        !/^\s*>\s?/.test(lines[i]) &&
        !/^\s*[-*+]\s+/.test(lines[i]) &&
        !/^\s*\d+\.\s+/.test(lines[i]) &&
        !/^\s*(?:[-*_]\s*){3,}$/.test(lines[i])
      ) {
        para.push(lines[i]);
        i++;
      }
      if (para.length === 0) {
        para.push(lines[i]);
        i++;
      }
      out.push(`<p>${para.map(renderInline).join("<br />")}</p>`);
    }

    return out.join("\n");
  }

  function stripMarkdown(md) {
    return String(md || "")
      .replace(/```[\s\S]*?```/g, "")
      .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/[#>*_`~|-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function estimateReadMinutes(md) {
    const clean = stripMarkdown(md);
    const chars = clean.replace(/\s+/g, "").length;
    return Math.max(1, Math.ceil(chars / 350));
  }

  window.BlogMarkdown = {
    escapeHtml,
    renderMarkdown,
    stripMarkdown,
    estimateReadMinutes
  };
})();
