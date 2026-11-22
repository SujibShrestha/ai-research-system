/* ai-research UI — polls the FastAPI job endpoints and renders the report */
"use strict";

const STAGES = [
  { key: "search",   label: "Search",   detail: "Tavily web search" },
  { key: "read",     label: "Read",     detail: "Scrape the top source" },
  { key: "write",    label: "Write",    detail: "Draft the report" },
  { key: "critique", label: "Critique", detail: "Score and feedback" },
];

const el = (id) => document.getElementById(id);
const ui = {
  form: el("form"),
  topic: el("topic"),
  run: el("run"),
  pipeline: el("pipeline"),
  message: el("stage-message"),
  elapsed: el("elapsed"),
  steps: el("steps"),
  error: el("error"),
  errorText: el("error-text"),
  retry: el("retry"),
  results: el("results"),
  score: el("score"),
  scoreValue: el("score-value"),
  verdict: el("verdict-text"),
  copy: el("copy"),
  report: el("tab-report"),
  feedback: el("tab-feedback"),
  sources: el("tab-sources"),
  raw: el("tab-raw"),
};

let jobId = null;
let timer = null;
let startedAt = 0;
let pollMisses = 0;
let reportText = "";

init();

function init() {
  renderSteps();
  ui.form.addEventListener("submit", onSubmit);
  ui.retry.addEventListener("click", retry);
  ui.copy.addEventListener("click", copyReport);
  setupTabs();

  // a reload mid-run should not throw away a minute of work
  const saved = sessionStorage.getItem("researchJob");
  if (saved) resume(saved);
}

/* ---------- pipeline view ---------- */

function renderSteps() {
  ui.steps.innerHTML = "";
  STAGES.forEach((stage, i) => {
    const li = document.createElement("li");
    li.className = "step";
    li.dataset.state = "pending";
    li.dataset.stage = stage.key;

    const top = document.createElement("div");
    top.className = "step-top";

    const dot = document.createElement("span");
    dot.className = "step-dot";
    const num = document.createElement("span");
    num.textContent = String(i + 1);
    dot.appendChild(num);

    const label = document.createElement("span");
    label.className = "step-label";
    label.textContent = stage.label;

    top.append(dot, label);

    const detail = document.createElement("p");
    detail.className = "step-detail";
    detail.textContent = stage.detail;

    li.append(top, detail);
    ui.steps.appendChild(li);
  });
}

function setStage(stageKey, message) {
  const activeIndex = STAGES.findIndex((s) => s.key === stageKey);
  ui.steps.querySelectorAll(".step").forEach((node, i) => {
    node.dataset.state =
      activeIndex === -1 || i < activeIndex ? "done" :
      i === activeIndex ? "active" : "pending";
  });
  if (message) ui.message.textContent = message;
}

function markAllDone(message) {
  ui.steps.querySelectorAll(".step").forEach((node) => (node.dataset.state = "done"));
  if (message) ui.message.textContent = message;
}

function showPipeline() {
  ui.results.hidden = true;
  ui.error.hidden = true;
  ui.pipeline.hidden = false;
}

function startTimer() {
  startedAt = Date.now();
  ui.elapsed.textContent = "0s";
  clearInterval(timer);
  timer = setInterval(() => {
    ui.elapsed.textContent = Math.round((Date.now() - startedAt) / 1000) + "s";
  }, 1000);
}

function stopTimer() {
  clearInterval(timer);
  timer = null;
}

function fail(message) {
  stopTimer();
  ui.run.disabled = false;
  ui.message.textContent = "Run stopped";
  ui.errorText.textContent = message || "Something went wrong.";
  ui.error.hidden = false;
  sessionStorage.removeItem("researchJob");
}

/* ---------- job flow ---------- */

async function onSubmit(event) {
  event.preventDefault();
  const topic = ui.topic.value.trim();
  if (topic.length < 3) {
    ui.topic.focus();
    return;
  }

  ui.run.disabled = true;
  showPipeline();
  renderSteps();
  ui.message.textContent = "Starting…";
  startTimer();

  let data;
  try {
    const res = await fetch("/api/research", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic }),
    });
    if (!res.ok) throw new Error(await readDetail(res));
    data = await res.json();
  } catch (err) {
    fail(err.message);
    return;
  }

  jobId = data.id;
  sessionStorage.setItem("researchJob", jobId);
  pollMisses = 0;
  poll();
}

function resume(id) {
  jobId = id;
  showPipeline();
  renderSteps();
  ui.message.textContent = "Resuming…";
  startTimer();
  pollMisses = 0;
  poll();
}

async function poll() {
  let status;
  try {
    const res = await fetch(`/api/research/${jobId}`);
    if (!res.ok) throw new Error(await readDetail(res));
    status = await res.json();
    pollMisses = 0;
  } catch (err) {
    // transient network blips shouldn't kill a running job
    if (++pollMisses >= 3) return fail(err.message);
    setTimeout(poll, 2000);
    return;
  }

  if (status.status === "running") {
    setStage(status.stage, status.message);
    setTimeout(poll, 1000);
  } else if (status.status === "done") {
    finish(status.result || {});
  } else {
    fail(status.message);
  }
}

async function readDetail(res) {
  try {
    const body = await res.json();
    return typeof body.detail === "string" ? body.detail : `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

function retry() {
  ui.error.hidden = true;
  ui.form.requestSubmit();
}

/* ---------- results ---------- */

function finish(result) {
  stopTimer();
  markAllDone("Report ready");
  ui.run.disabled = false;
  sessionStorage.removeItem("researchJob");

  reportText = result.report || "";
  renderScoreAndVerdict(result.feedback || "");
  renderMarkdown(ui.report, reportText, "The writer returned an empty report.");
  renderPlain(ui.feedback, result.feedback || "", "No critique was produced.");
  renderSources(result.search_result || "");
  renderRaw(result);

  ui.results.hidden = false;
  ui.results.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderScoreAndVerdict(feedback) {
  const score = feedback.match(/Score\s*:\s*(\d+(?:\.\d+)?)\s*\/\s*10/i);
  ui.score.hidden = !score;
  if (score) ui.scoreValue.textContent = `${score[1]}/10`;

  const verdict = feedback.match(/One line verdict:\s*(.+)/i);
  ui.verdict.textContent = verdict ? verdict[1].trim() : "—";
}

function renderMarkdown(target, text, fallback) {
  target.textContent = "";
  if (!text.trim()) {
    target.textContent = fallback;
    return;
  }
  // LLM output can carry raw HTML from scraped pages — sanitize before injecting
  if (window.marked && window.DOMPurify) {
    target.innerHTML = DOMPurify.sanitize(marked.parse(text));
  } else {
    const pre = document.createElement("pre");
    pre.textContent = text;
    target.appendChild(pre);
  }
}

function renderPlain(target, text, fallback) {
  target.textContent = text.trim() ? text : fallback;
}

function renderSources(searchResult) {
  ui.sources.textContent = "";
  const urls = [...new Set([...searchResult.matchAll(/URL:\s*(\S+)/g)].map((m) => m[1]))];

  if (!urls.length) {
    const p = document.createElement("p");
    p.className = "empty-note";
    p.textContent = "No URLs were captured in the search results.";
    ui.sources.appendChild(p);
    return;
  }

  const list = document.createElement("ol");
  list.className = "sources-list";
  urls.forEach((url, i) => {
    const li = document.createElement("li");

    const idx = document.createElement("span");
    idx.className = "idx";
    idx.textContent = String(i + 1).padStart(2, "0");

    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = url;

    li.append(idx, a);
    list.appendChild(li);
  });
  ui.sources.appendChild(list);
}

function renderRaw(result) {
  ui.raw.textContent = "";
  const blocks = [
    ["Search results", result.search_result],
    ["Scraped content", result.scraped_content],
  ];

  blocks.forEach(([title, text]) => {
    if (!text) return;
    const wrap = document.createElement("div");
    wrap.className = "raw-block";

    const h = document.createElement("h3");
    h.textContent = title;

    const pre = document.createElement("pre");
    pre.textContent = text;

    wrap.append(h, pre);
    ui.raw.appendChild(wrap);
  });

  if (!ui.raw.childNodes.length) {
    const p = document.createElement("p");
    p.className = "empty-note";
    p.textContent = "No raw research was captured.";
    ui.raw.appendChild(p);
  }
}

async function copyReport() {
  if (!reportText) return;
  try {
    await navigator.clipboard.writeText(reportText);
    ui.copy.textContent = "Copied";
    setTimeout(() => (ui.copy.textContent = "Copy report"), 1500);
  } catch {
    ui.copy.textContent = "Copy failed";
    setTimeout(() => (ui.copy.textContent = "Copy report"), 1500);
  }
}

/* ---------- tabs ---------- */

function setupTabs() {
  const tabs = [...document.querySelectorAll('[role="tab"]')];

  const select = (tab) => {
    tabs.forEach((t) => {
      const selected = t === tab;
      t.setAttribute("aria-selected", String(selected));
      t.tabIndex = selected ? 0 : -1;
      document.getElementById(t.getAttribute("aria-controls")).hidden = !selected;
    });
  };

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => select(tab));
    tab.addEventListener("keydown", (e) => {
      const i = tabs.indexOf(tab);
      const next =
        e.key === "ArrowRight" ? tabs[(i + 1) % tabs.length] :
        e.key === "ArrowLeft" ? tabs[(i - 1 + tabs.length) % tabs.length] :
        e.key === "Home" ? tabs[0] :
        e.key === "End" ? tabs[tabs.length - 1] : null;
      if (next) {
        e.preventDefault();
        select(next);
        next.focus();
      }
    });
  });
}
