// 校园值班台 · 菜单切换（第01课第4步）
// 只做页面切换，不读取业务数据，也不请求后端。

const VIEWS = [
  { id: "dashboard", title: "概览" },
  { id: "devices", title: "设备" },
  { id: "spaces", title: "空间" },
  { id: "energy", title: "能源" },
  { id: "history", title: "历史" },
  { id: "alarms", title: "原始报警" },
  { id: "cases", title: "演练事件" },
  { id: "owners", title: "设备责任" },
  { id: "admin", title: "管理" },
];

const DEFAULT_VIEW = "dashboard";
const PLACEHOLDER = "这个页面会在后续课程完成";

const menuItems = Array.from(document.querySelectorAll(".menu-item"));
const outlet = document.getElementById("view-outlet");
const sections = new Map();

const dashboardSection = document.getElementById("view-dashboard");
if (dashboardSection) {
  sections.set(DEFAULT_VIEW, dashboardSection);
}

// 除概览外，八个页面只生成标题和占位说明；文本一律用 textContent 写入。
for (const view of VIEWS) {
  if (view.id === DEFAULT_VIEW || !outlet) continue;

  const section = document.createElement("section");
  section.className = "panel view";
  section.id = `view-${view.id}`;
  section.hidden = true;

  const heading = document.createElement("h2");
  heading.textContent = view.title;

  const note = document.createElement("p");
  note.textContent = PLACEHOLDER;

  section.append(heading, note);
  outlet.append(section);
  sections.set(view.id, section);
}

for (const item of menuItems) {
  const viewId = item.dataset.view;
  if (sections.has(viewId)) {
    item.setAttribute("aria-controls", `view-${viewId}`);
  }
}

function normalizeView(hash) {
  const id = hash.replace(/^#\/?/, "");
  return sections.has(id) ? id : DEFAULT_VIEW;
}

function render(viewId) {
  for (const [id, section] of sections) {
    section.hidden = id !== viewId;
  }

  for (const item of menuItems) {
    if (item.dataset.view === viewId) {
      item.setAttribute("aria-current", "page");
    } else {
      item.removeAttribute("aria-current");
    }
  }
}

for (const item of menuItems) {
  item.addEventListener("click", () => {
    const viewId = sections.has(item.dataset.view)
      ? item.dataset.view
      : DEFAULT_VIEW;

    render(viewId);

    // 只改地址片段，不发起导航，也不刷新页面。
    if (window.location.hash !== `#${viewId}`) {
      window.location.hash = viewId;
    }
  });
}

window.addEventListener("hashchange", () => {
  render(normalizeView(window.location.hash));
});

const initialView = normalizeView(window.location.hash);
render(initialView);

// 首次进入或片段无效时，用 replaceState 校正地址，不新增历史记录。
if (window.location.hash !== `#${initialView}`) {
  window.history.replaceState(null, "", `#${initialView}`);
}
