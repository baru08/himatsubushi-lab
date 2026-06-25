(() => {
  "use strict";
  const DATA = window.FUTATSUNA_DATA;
  const $ = (id) => document.getElementById(id);
  const els = {
    categoryGrid: $("categoryGrid"),
    nameInput: $("nameInput"),
    generateBtn: $("generateBtn"),
    againBtn: $("againBtn"),
    copyBtn: $("copyBtn"),
    shareBtn: $("shareBtn"),
    clearHistoryBtn: $("clearHistoryBtn"),
    resultList: $("resultList"),
    historyList: $("historyList"),
    rareBadge: $("rareBadge")
  };

  let currentCategory = "all";
  let lastResults = [];
  const HISTORY_KEY = "futatsuna_dx_history_v1";

  function randomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function sanitizeName(name) {
    return String(name || "").trim().replace(/[\n\r<>]/g, "").slice(0, 20);
  }

  function weightedTemplate(hasName) {
    const entries = Object.entries(DATA.templates).filter(([, t]) => !t.needsName || hasName);
    const sum = entries.reduce((acc, [, t]) => acc + t.weight, 0);
    let roll = Math.random() * sum;
    for (const [key, tpl] of entries) {
      roll -= tpl.weight;
      if (roll <= 0) return { key, ...tpl };
    }
    return { key: entries[0][0], ...entries[0][1] };
  }

  function availableCategories() {
    if (currentCategory === "all") return DATA.categories.map(c => c.id).filter(id => id !== "all");
    return [currentCategory];
  }

  function buildName(categoryId, inputName) {
    const pool = DATA.pools[categoryId];
    const tpl = weightedTemplate(Boolean(inputName));
    const rareRoll = Math.random();
    let rarity = "normal";
    if (rareRoll < 0.006) rarity = "super";
    else if (rareRoll < 0.045) rarity = "rare";

    let result = tpl.pattern
      .replace("{name}", inputName)
      .replace("{a}", randomItem(pool.a))
      .replace("{b}", randomItem(pool.b || [""]))
      .replace("{title}", randomItem(pool.title))
      .replace("{prefix}", randomItem(pool.prefix))
      .replace("{noun}", randomItem(pool.noun))
      .replace("{solo}", randomItem(pool.solo));

    if (rarity === "rare" && !result.includes("★")) result = `★ ${result}`;
    if (rarity === "super") result = `★★★ ${result}`;

    return {
      text: result,
      category: DATA.categories.find(c => c.id === categoryId)?.label || categoryId,
      rarity
    };
  }

  function generate() {
    const name = sanitizeName(els.nameInput.value);
    const cats = availableCategories();
    const used = new Set();
    const results = [];
    let guard = 0;
    while (results.length < 3 && guard < 80) {
      guard++;
      const cat = randomItem(cats);
      const item = buildName(cat, name);
      if (!used.has(item.text)) {
        used.add(item.text);
        results.push(item);
      }
    }
    lastResults = results;
    renderResults(results);
    saveHistory(results.map(r => r.text));
    renderHistory();
  }

  function renderCategories() {
    els.categoryGrid.innerHTML = "";
    DATA.categories.forEach(cat => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `cat-btn${cat.id === currentCategory ? " active" : ""}`;
      btn.textContent = cat.label;
      btn.addEventListener("click", () => {
        currentCategory = cat.id;
        renderCategories();
      });
      els.categoryGrid.appendChild(btn);
    });
  }

  function renderResults(results) {
    els.resultList.innerHTML = "";
    const hasRare = results.some(r => r.rarity !== "normal");
    els.rareBadge.classList.toggle("hidden", !hasRare);
    els.rareBadge.textContent = results.some(r => r.rarity === "super") ? "SUPER RARE" : "RARE";

    results.forEach((r, i) => {
      const item = document.createElement("article");
      item.className = `result-item ${r.rarity}`;
      item.innerHTML = `
        <div><span class="result-num">${i + 1}</span><span class="result-name"></span></div>
        <div class="result-category">カテゴリ：${escapeHtml(r.category)}</div>
      `;
      item.querySelector(".result-name").textContent = r.text;
      els.resultList.appendChild(item);
    });
    els.copyBtn.disabled = false;
    els.shareBtn.disabled = false;
    if (hasRare) showConfetti();
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>'"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[ch]));
  }

  async function copyResults() {
    if (!lastResults.length) return;
    const text = lastResults.map((r, i) => `${i + 1}. ${r.text}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast("コピーしました");
    } catch {
      toast("コピーに失敗しました");
    }
  }

  function shareResults() {
    if (!lastResults.length) return;
    const main = lastResults[0].text.replace(/^★+\s*/, "");
    const text = `私の二つ名は「${main}」でした！\n\n二つ名メーカーDXで遊ぶ`; 
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(location.href)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); }
    catch { return []; }
  }

  function saveHistory(items) {
    const history = loadHistory();
    const next = [...items, ...history].filter(Boolean).slice(0, 20);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  }

  function renderHistory() {
    const history = loadHistory();
    els.historyList.innerHTML = "";
    if (!history.length) {
      const li = document.createElement("li");
      li.textContent = "まだ履歴はありません。";
      els.historyList.appendChild(li);
      return;
    }
    history.slice(0, 10).forEach(text => {
      const li = document.createElement("li");
      li.textContent = text;
      els.historyList.appendChild(li);
    });
  }

  function clearHistory() {
    localStorage.removeItem(HISTORY_KEY);
    renderHistory();
    toast("履歴を消しました");
  }

  function toast(message) {
    document.querySelectorAll(".toast").forEach(t => t.remove());
    const div = document.createElement("div");
    div.className = "toast";
    div.textContent = message;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 1700);
  }

  function showConfetti() {
    const div = document.createElement("div");
    div.className = "confetti";
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 950);
  }

  function countCombinations() {
    let total = 0;
    Object.values(DATA.pools).forEach(pool => {
      total += pool.a.length * pool.title.length;
      total += pool.a.length * (pool.b || [""]).length * pool.title.length;
      total += pool.prefix.length * pool.noun.length;
      total += pool.solo.length;
      total += pool.a.length * pool.title.length; // 名前あり型分
      total += pool.a.length * (pool.b || [""]).length * pool.title.length; // 名前あり型分
      total += pool.prefix.length * pool.noun.length; // 名前あり型分
    });
    return total;
  }

  function init() {
    renderCategories();
    renderHistory();
    els.generateBtn.addEventListener("click", generate);
    els.againBtn.addEventListener("click", generate);
    els.copyBtn.addEventListener("click", copyResults);
    els.shareBtn.addEventListener("click", shareResults);
    els.clearHistoryBtn.addEventListener("click", clearHistory);
    console.log(`二つ名メーカーDX combinations: ${countCombinations().toLocaleString()}+`);
  }

  init();
})();
