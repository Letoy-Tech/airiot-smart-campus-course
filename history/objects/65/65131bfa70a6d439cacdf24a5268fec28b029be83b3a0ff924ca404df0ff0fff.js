// 校园值班台 · 菜单切换 + 概览/设备数据（第02课第2步）
// 业务数据一律通过 data-service 获取，不直接导入 mock-data，也不请求后端。

import { getOverview, getDevices, getSpaces } from "./data-service.js";

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
const DATA_SOURCE_NOTE = "数据方式：浏览器演示（教学模拟）";

const CATEGORY_LABELS = {
  environment: "环境",
  energy: "能源",
  facility: "设施",
  lighting: "照明",
};

const QUALITY_LABELS = {
  fresh: "正常",
  stale: "较旧",
  missing: "缺失",
  invalid: "无效",
};

const menuItems = Array.from(document.querySelectorAll(".menu-item"));
const outlet = document.getElementById("view-outlet");
const sections = new Map();

let devicesView = null;
let devicesLoaded = false;
let devicesLoading = false;
let loadedDevices = [];
let loadedSpaces = [];
let loadedPoints = [];
let activeDetailButton = null;

const dashboardSection = document.getElementById("view-dashboard");
if (dashboardSection) {
  sections.set(DEFAULT_VIEW, dashboardSection);
}

function createFilterSelect(labelText, options) {
  const label = document.createElement("label");
  label.className = "filter-field";

  const caption = document.createElement("span");
  caption.className = "filter-label";
  caption.textContent = labelText;

  const select = document.createElement("select");
  select.className = "filter-control";

  for (const item of options) {
    const option = document.createElement("option");
    option.value = item.value;
    option.textContent = item.text;
    select.append(option);
  }

  label.append(caption, select);
  return { label, select };
}

// 设备页：标题、筛选、读取状态、表格、设备总数、错误与重试。
function createDevicesSection() {
  const section = document.createElement("section");
  section.className = "panel view";
  section.id = "view-devices";
  section.hidden = true;

  const heading = document.createElement("h2");
  heading.textContent = "设备";

  const status = document.createElement("p");
  status.className = "table-status";
  status.textContent = "正在读取设备";

  const wrap = document.createElement("div");
  wrap.className = "table-wrap";
  wrap.hidden = true;

  const table = document.createElement("table");
  table.className = "data-table";

  const caption = document.createElement("caption");
  caption.className = "visually-hidden";
  caption.textContent = "设备列表";

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  for (const label of ["编号", "设备名称", "类型", "空间", "在线情况", "操作"]) {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = label;
    headRow.append(th);
  }
  thead.append(headRow);

  const tbody = document.createElement("tbody");

  table.append(caption, thead, tbody);

  const summary = document.createElement("p");
  summary.className = "table-summary";

  const filters = document.createElement("div");
  filters.className = "filters";
  filters.setAttribute("role", "group");
  filters.setAttribute("aria-label", "设备筛选");

  const searchField = document.createElement("label");
  searchField.className = "filter-field";

  const searchCaption = document.createElement("span");
  searchCaption.className = "filter-label";
  searchCaption.textContent = "搜索";

  const searchInput = document.createElement("input");
  searchInput.type = "search";
  searchInput.className = "filter-control";
  searchInput.placeholder = "名称或编号";
  searchInput.autocomplete = "off";

  searchField.append(searchCaption, searchInput);

  const categoryField = createFilterSelect("类型", [
    { value: "", text: "全部类型" },
    ...Object.entries(CATEGORY_LABELS).map(([value, text]) => ({
      value,
      text,
    })),
  ]);

  const spaceField = createFilterSelect("空间", [
    { value: "", text: "全部空间" },
  ]);

  const onlineField = createFilterSelect("在线情况", [
    { value: "", text: "全部" },
    { value: "true", text: "在线" },
    { value: "false", text: "离线" },
    { value: "null", text: "未知" },
  ]);

  const clearButton = document.createElement("button");
  clearButton.type = "button";
  clearButton.className = "clear-button";
  clearButton.textContent = "清空筛选";

  filters.append(
    searchField,
    categoryField.label,
    spaceField.label,
    onlineField.label,
    clearButton
  );

  const emptyNote = document.createElement("p");
  emptyNote.className = "table-empty";
  emptyNote.textContent = "没有符合条件的设备";
  emptyNote.hidden = true;

  const detail = document.createElement("section");
  detail.className = "device-detail";
  detail.id = "device-detail";
  detail.hidden = true;

  const detailHead = document.createElement("div");
  detailHead.className = "detail-head";

  const detailHeading = document.createElement("h3");
  detailHeading.textContent = "设备详情";

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "detail-close";
  closeButton.textContent = "收起详情";

  detailHead.append(detailHeading, closeButton);

  const facts = document.createElement("dl");
  facts.className = "detail-facts";

  const pointsHeading = document.createElement("h4");
  pointsHeading.textContent = "读数";

  const pointsWrap = document.createElement("div");
  pointsWrap.className = "table-wrap";

  const pointsTable = document.createElement("table");
  pointsTable.className = "data-table detail-table";

  const pointsCaption = document.createElement("caption");
  pointsCaption.className = "visually-hidden";
  pointsCaption.textContent = "设备读数";

  const pointsHead = document.createElement("thead");
  const pointsHeadRow = document.createElement("tr");
  for (const label of ["标签", "数值", "单位", "采样时间", "质量"]) {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = label;
    pointsHeadRow.append(th);
  }
  pointsHead.append(pointsHeadRow);

  const pointsBody = document.createElement("tbody");

  pointsTable.append(pointsCaption, pointsHead, pointsBody);
  pointsWrap.append(pointsTable);

  const pointsEmpty = document.createElement("p");
  pointsEmpty.className = "table-status detail-empty";
  pointsEmpty.textContent = "该设备暂无读数";
  pointsEmpty.hidden = true;

  detail.append(detailHead, facts, pointsHeading, pointsWrap, pointsEmpty);

  wrap.append(filters, table, emptyNote, summary, detail);

  const errorBox = document.createElement("div");
  errorBox.className = "table-error";
  errorBox.hidden = true;

  const errorText = document.createElement("p");
  errorText.className = "table-status";

  const retryButton = document.createElement("button");
  retryButton.type = "button";
  retryButton.className = "retry-button";
  retryButton.textContent = "重试";

  errorBox.append(errorText, retryButton);

  section.append(heading, status, wrap, errorBox);

  devicesView = {
    section,
    status,
    wrap,
    table,
    tbody,
    emptyNote,
    summary,
    searchInput,
    categorySelect: categoryField.select,
    spaceSelect: spaceField.select,
    onlineSelect: onlineField.select,
    clearButton,
    detail,
    facts,
    pointsTable,
    pointsBody,
    pointsEmpty,
    errorBox,
    errorText,
    retryButton,
  };

  closeButton.addEventListener("click", () => {
    detail.hidden = true;
    if (activeDetailButton) {
      activeDetailButton.setAttribute("aria-expanded", "false");
      activeDetailButton = null;
    }
  });

  searchInput.addEventListener("input", applyDeviceFilters);
  categoryField.select.addEventListener("change", applyDeviceFilters);
  spaceField.select.addEventListener("change", applyDeviceFilters);
  onlineField.select.addEventListener("change", applyDeviceFilters);

  clearButton.addEventListener("click", resetDeviceFilters);

  retryButton.addEventListener("click", () => {
    loadDevices();
  });

  return section;
}

// 除概览、设备外，其余页面只显示标题和占位说明；文本一律用 textContent 写入。
for (const view of VIEWS) {
  if (view.id === DEFAULT_VIEW || !outlet) continue;

  let section;

  if (view.id === "devices") {
    section = createDevicesSection();
  } else {
    section = document.createElement("section");
    section.className = "panel view";
    section.id = `view-${view.id}`;
    section.hidden = true;

    const heading = document.createElement("h2");
    heading.textContent = view.title;

    const note = document.createElement("p");
    note.textContent = PLACEHOLDER;

    section.append(heading, note);
  }

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

  if (viewId === "devices" && !devicesLoaded) {
    loadDevices();
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

// 概览“设备总数”卡片：进入现有设备页，并清空筛选。
const openDevicesCard = document.getElementById("open-devices-card");
if (openDevicesCard) {
  openDevicesCard.addEventListener("click", () => {
    resetDeviceFilters();
    const devicesMenuItem = menuItems.find(
      (item) => item.dataset.view === "devices"
    );
    if (devicesMenuItem) {
      devicesMenuItem.click();
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

// ---------- 设备读取 ----------

function setDevicesStatus(text) {
  if (!devicesView) return;
  devicesView.status.textContent = text;
  devicesView.status.hidden = false;
  devicesView.wrap.hidden = true;
  devicesView.errorBox.hidden = true;
}

function showDevicesError(error) {
  if (!devicesView) return;
  const detail =
    error instanceof Error && error.message ? error.message : "未知错误";
  devicesView.status.hidden = true;
  devicesView.wrap.hidden = true;
  devicesView.errorBox.hidden = false;
  devicesView.errorText.textContent = `设备读取失败：${detail}`;
}

function formatOnline(value) {
  if (value === true) return { text: "在线", className: "is-online" };
  if (value === false) return { text: "离线", className: "is-offline" };
  return { text: "未知", className: "is-unknown" };
}

function renderDeviceRows(devices, spaces) {
  if (!devicesView) return;

  const spaceNames = new Map();
  for (const space of spaces) {
    spaceNames.set(space.id, space.name);
  }

  const tbody = devicesView.tbody;
  tbody.replaceChildren();

  for (const device of devices) {
    const row = document.createElement("tr");

    const idCell = document.createElement("td");
    idCell.textContent = device.id;

    const nameCell = document.createElement("td");
    nameCell.textContent = device.name;

    const categoryCell = document.createElement("td");
    categoryCell.textContent = CATEGORY_LABELS[device.category] ?? "未分类";

    const spaceCell = document.createElement("td");
    spaceCell.textContent = spaceNames.get(device.spaceId) ?? "未知空间";

    const onlineCell = document.createElement("td");
    const online = formatOnline(device.online);
    const badge = document.createElement("span");
    badge.className = `online-badge ${online.className}`;
    badge.textContent = online.text;
    onlineCell.append(badge);

    const actionCell = document.createElement("td");
    const detailButton = document.createElement("button");
    detailButton.type = "button";
    detailButton.className = "row-action";
    detailButton.textContent = "查看";
    detailButton.setAttribute("aria-expanded", "false");
    detailButton.setAttribute("aria-controls", "device-detail");
    detailButton.addEventListener("click", () => {
      openDeviceDetail(device.id, detailButton);
    });
    actionCell.append(detailButton);

    row.append(idCell, nameCell, categoryCell, spaceCell, onlineCell, actionCell);
    tbody.append(row);
  }
}

// ---------- 设备详情 ----------

function formatPointValue(value) {
  if (value === null || value === undefined) return "缺失";
  return String(value);
}

function formatSampleTime(time) {
  if (time === null || time === undefined) return "无采样时间";
  const date = new Date(time);
  if (Number.isNaN(date.getTime())) return "无采样时间";
  return date.toLocaleString("zh-CN", { hour12: false });
}

function renderDetailFacts(device, spaceName) {
  if (!devicesView) return;

  const entries = [
    ["编号", device.id],
    ["名称", device.name],
    ["类型", CATEGORY_LABELS[device.category] ?? "未分类"],
    ["空间", spaceName],
    ["在线情况", formatOnline(device.online).text],
  ];

  const facts = devicesView.facts;
  facts.replaceChildren();

  for (const [label, value] of entries) {
    const term = document.createElement("dt");
    term.textContent = label;

    const description = document.createElement("dd");
    description.textContent = value;

    facts.append(term, description);
  }
}

function renderDetailPoints(points) {
  if (!devicesView) return;

  const tbody = devicesView.pointsBody;
  tbody.replaceChildren();

  for (const point of points) {
    const row = document.createElement("tr");

    const tagCell = document.createElement("td");
    tagCell.textContent = point.tagId;

    const valueCell = document.createElement("td");
    valueCell.textContent = formatPointValue(point.value);

    const unitCell = document.createElement("td");
    unitCell.textContent =
      point.unit === null || point.unit === undefined ? "—" : point.unit;

    const timeCell = document.createElement("td");
    timeCell.textContent = formatSampleTime(point.time);

    const qualityCell = document.createElement("td");
    qualityCell.textContent = QUALITY_LABELS[point.quality] ?? "未知";

    row.append(tagCell, valueCell, unitCell, timeCell, qualityCell);
    tbody.append(row);
  }

  const isEmpty = points.length === 0;
  devicesView.pointsEmpty.hidden = !isEmpty;
  devicesView.pointsTable.hidden = isEmpty;
}

// 按设备原始 id 查找，只显示这一台设备的读数。
function openDeviceDetail(deviceId, triggerButton) {
  if (!devicesView) return;

  const device = loadedDevices.find((item) => item.id === deviceId);
  if (!device) return;

  const space = loadedSpaces.find((item) => item.id === device.spaceId);
  const points = loadedPoints.filter((point) => point.deviceId === device.id);

  renderDetailFacts(device, space ? space.name : "未知空间");
  renderDetailPoints(points);

  if (activeDetailButton && activeDetailButton !== triggerButton) {
    activeDetailButton.setAttribute("aria-expanded", "false");
  }
  activeDetailButton = triggerButton;
  triggerButton.setAttribute("aria-expanded", "true");

  devicesView.detail.hidden = false;
}

function matchesOnline(device, filter) {
  if (filter === "") return true;
  if (filter === "true") return device.online === true;
  if (filter === "false") return device.online === false;
  return device.online === null;
}

// 多个条件同时生效；总数与当前数量都按已读取的数组计算。
function applyDeviceFilters() {
  if (!devicesView) return;

  const keyword = devicesView.searchInput.value.trim().toLowerCase();
  const category = devicesView.categorySelect.value;
  const spaceId = devicesView.spaceSelect.value;
  const online = devicesView.onlineSelect.value;

  const filtered = loadedDevices.filter((device) => {
    if (keyword !== "") {
      const haystack = `${device.id} ${device.name}`.toLowerCase();
      if (!haystack.includes(keyword)) return false;
    }
    if (category !== "" && device.category !== category) return false;
    if (spaceId !== "" && device.spaceId !== spaceId) return false;
    return matchesOnline(device, online);
  });

  renderDeviceRows(filtered, loadedSpaces);

  devicesView.summary.textContent =
    `当前显示 ${filtered.length} 台 / 全部 ${loadedDevices.length} 台`;

  const isEmpty = filtered.length === 0;
  devicesView.table.hidden = isEmpty;
  devicesView.emptyNote.hidden = !isEmpty;
}

function fillSpaceOptions(spaces) {
  if (!devicesView) return;

  const select = devicesView.spaceSelect;
  const current = select.value;

  select.replaceChildren();

  const allOption = document.createElement("option");
  allOption.value = "";
  allOption.textContent = "全部空间";
  select.append(allOption);

  for (const space of spaces) {
    const option = document.createElement("option");
    option.value = space.id;
    option.textContent = space.name;
    select.append(option);
  }

  // 重新载入时保留仍然有效的空间选择。
  select.value = spaces.some((space) => space.id === current) ? current : "";
}

// 清空搜索与三个下拉框；数据尚未读取时只复位控件，避免出现 0 台。
function resetDeviceFilters() {
  if (!devicesView) return;

  devicesView.searchInput.value = "";
  devicesView.categorySelect.value = "";
  devicesView.spaceSelect.value = "";
  devicesView.onlineSelect.value = "";

  if (devicesLoaded) {
    applyDeviceFilters();
  }
}

async function loadDevices() {
  if (!devicesView || devicesLoading) return;

  devicesLoading = true;
  setDevicesStatus("正在读取设备");

  try {
    const [devices, spaces, overview] = await Promise.all([
      getDevices(),
      getSpaces(),
      getOverview(),
    ]);

    loadedDevices = devices;
    loadedSpaces = spaces;
    loadedPoints = overview.points;

    if (devices.length === 0) {
      setDevicesStatus("没有设备");
      devicesLoaded = true;
      return;
    }

    fillSpaceOptions(spaces);
    applyDeviceFilters();

    devicesView.status.hidden = true;
    devicesView.wrap.hidden = false;
    devicesView.errorBox.hidden = true;
    devicesLoaded = true;
  } catch (error) {
    showDevicesError(error);
    console.error("设备数据读取失败", error);
  } finally {
    devicesLoading = false;
  }
}

// ---------- 概览底部说明 ----------

const STAT_TARGETS = [
  ["stat-devices", "devices"],
  ["stat-spaces", "spaces"],
  ["stat-points", "points"],
];

function setStatText(text) {
  for (const [id] of STAT_TARGETS) {
    const element = document.getElementById(id);
    if (element) element.textContent = text;
  }
}

// 卡片数值取自实际返回数组的长度，不写死。
function setStatCounts(overview) {
  for (const [id, key] of STAT_TARGETS) {
    const element = document.getElementById(id);
    if (element) element.textContent = String(overview[key].length);
  }
}

function describeError(error) {
  return error instanceof Error && error.message ? error.message : "未知错误";
}

async function showOverviewSummary() {
  const note = document.getElementById("data-note");

  setStatText("正在读取");

  try {
    const overview = await getOverview();
    setStatCounts(overview);

    if (note) {
      const deviceCount = overview.devices.length;
      const spaceCount = overview.spaces.length;
      const pointCount = overview.points.length;
      note.textContent =
        `${DATA_SOURCE_NOTE}｜设备 ${deviceCount} 台 · ` +
        `空间 ${spaceCount} 个 · 点位 ${pointCount} 个`;
    }
  } catch (error) {
    // 读取失败时明确显示，不用 0 冒充数量。
    setStatText("读取失败");
    if (note) {
      note.textContent = `${DATA_SOURCE_NOTE}｜读取失败：${describeError(error)}，请刷新页面重试`;
    }
    console.error("练习数据载入失败", error);
  }
}

showOverviewSummary();
