// 校园值班台 · 菜单切换 + 概览/设备/空间/设备责任数据（第04课第1步）
// 业务数据一律通过 data-service 获取，不直接导入 mock-data，也不请求后端。

import {
  getOverview,
  getDevices,
  getSpaces,
  saveSpace,
  getOwners,
  saveOwner,
} from "./data-service.js";

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

// 点位展示名只用于阅读；原 tagId 仍显示在下方，后续课程查找字段时按原值对应。
const POINT_LABELS = {
  temperature: "温度",
  humidity: "湿度",
  power: "功率",
  voltage: "电压",
  status: "状态",
  brightness: "亮度",
};

const QUALITY_CLASSES = {
  fresh: "is-fresh",
  stale: "is-stale",
  missing: "is-missing",
  invalid: "is-invalid",
};

// 固定时区格式化，避免同一份教学样本在不同机器上显示成不同日期。
const SAMPLE_TIME_FORMAT = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

const POINTS_NOTE_TEXT =
  "固定日期的教学样本，刷新不会产生新的采样时间。数值按原始字段显示：0 就是 0，null 显示“缺失”；状态点只显示原始数值，不推断故障含义。";

// 能源页可选的两项读数：字段、单位都写死，切换时不做任何换算。
const ENERGY_METRICS = {
  power: {
    tagId: "power",
    unit: "kW",
    label: "功率 kW",
    valueHeader: "功率",
    hint: "功率反映当前样本的用电强弱，本页没有累计用电量和电费。",
  },
  voltage: {
    tagId: "voltage",
    unit: "V",
    label: "电压 V",
    valueHeader: "电压",
    hint: "电压是当前样本的供电电压，本页没有累计用电量和电费。",
  },
};

const menuItems = Array.from(document.querySelectorAll(".menu-item"));
const outlet = document.getElementById("view-outlet");
const sections = new Map();

let devicesView = null;
let devicesLoaded = false;
let devicesLoading = false;
let spacesView = null;
let spacesLoaded = false;
let spacesLoading = false;
let energyView = null;
let energyLoaded = false;
let energyLoading = false;
let energyMetric = "power";
let energyOverview = null;
let loadedDevices = [];
let loadedSpaces = [];
let loadedPoints = [];
let activeDetailButton = null;
let activeDetailDeviceId = null;
let activeDetailSpaceId = null;
let detailRequestId = 0;
let activeSpaceEditor = null;
let pendingSpaceTargetId = null;
let ownersView = null;
let ownersLoaded = false;
let ownersLoading = false;
let activeOwnerButton = null;
let currentOwnerDevice = null;
let currentOwnerVersion = 0;
let ownerSaving = false;
let pendingOwnerTargetId = null;

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

  const detailNotice = document.createElement("p");
  detailNotice.className = "table-status detail-notice";
  detailNotice.hidden = true;

  const facts = document.createElement("dl");
  facts.className = "detail-facts";

  const detailActions = document.createElement("div");
  detailActions.className = "detail-actions";
  detailActions.hidden = true;

  const ownerLinkButton = document.createElement("button");
  ownerLinkButton.type = "button";
  ownerLinkButton.className = "row-action";
  ownerLinkButton.textContent = "查看责任登记";

  const spaceLinkButton = document.createElement("button");
  spaceLinkButton.type = "button";
  spaceLinkButton.className = "row-action";
  spaceLinkButton.textContent = "查看所在空间";

  detailActions.append(ownerLinkButton, spaceLinkButton);

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
  for (const label of ["点位", "数值", "单位", "采样时间", "质量"]) {
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

  // 读数说明：明确样本时间是固定数据，0 与 null 不混用，状态点不推断含义。
  const pointsNote = document.createElement("p");
  pointsNote.className = "data-note detail-note";
  pointsNote.textContent = POINTS_NOTE_TEXT;
  pointsNote.hidden = true;

  detail.append(
    detailHead,
    detailNotice,
    facts,
    detailActions,
    pointsHeading,
    pointsWrap,
    pointsEmpty,
    pointsNote
  );

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
    detailNotice,
    facts,
    detailActions,
    ownerLinkButton,
    spaceLinkButton,
    pointsHeading,
    pointsWrap,
    pointsTable,
    pointsBody,
    pointsEmpty,
    pointsNote,
    errorBox,
    errorText,
    retryButton,
  };

  closeButton.addEventListener("click", () => {
    closeDeviceDetail();
  });

  ownerLinkButton.addEventListener("click", () => {
    if (activeDetailDeviceId) {
      openOwnersForDevice(activeDetailDeviceId);
    }
  });

  spaceLinkButton.addEventListener("click", () => {
    if (activeDetailSpaceId) {
      openSpacesForSpace(activeDetailSpaceId);
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

// 空间页：标题、读取状态、四张空间卡片、浏览器演示说明。
function createSpacesSection() {
  const section = document.createElement("section");
  section.className = "panel view";
  section.id = "view-spaces";
  section.hidden = true;

  const heading = document.createElement("h2");
  heading.textContent = "空间";

  const status = document.createElement("p");
  status.className = "table-status";
  status.textContent = "正在读取空间";

  const grid = document.createElement("div");
  grid.className = "space-grid";
  grid.hidden = true;

  const note = document.createElement("p");
  note.className = "data-note";
  note.textContent = "当前浏览器演示，尚未写入数据库";

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

  section.append(heading, status, grid, note, errorBox);

  spacesView = {
    section,
    status,
    grid,
    note,
    errorBox,
    errorText,
    retryButton,
  };

  retryButton.addEventListener("click", () => {
    loadSpaces();
  });

  return section;
}

// 能源页：只展示能源设备的功率读数，按空间分组。
function createEnergySection() {
  const section = document.createElement("section");
  section.className = "panel view";
  section.id = "view-energy";
  section.hidden = true;

  const heading = document.createElement("h2");
  heading.textContent = "能源";

  // 读数项只有这两项；设备范围始终是 category=energy 的四台。
  const filters = document.createElement("div");
  filters.className = "filters energy-filters";
  filters.setAttribute("role", "group");
  filters.setAttribute("aria-label", "读数项选择");

  const metricField = createFilterSelect("读数项", [
    { value: "power", text: "功率 kW" },
    { value: "voltage", text: "电压 V" },
  ]);
  metricField.select.value = energyMetric;
  filters.append(metricField.label);

  const initialMetric = ENERGY_METRICS[energyMetric];

  const metricHeading = document.createElement("h3");
  metricHeading.className = "energy-title";
  metricHeading.textContent = initialMetric.label;

  const hint = document.createElement("p");
  hint.className = "block-hint";
  hint.textContent = initialMetric.hint;

  const status = document.createElement("p");
  status.className = "table-status";
  status.textContent = "正在读取读数";

  const groups = document.createElement("div");
  groups.className = "energy-groups";
  groups.hidden = true;

  const empty = document.createElement("p");
  empty.className = "table-empty";
  empty.textContent = "没有能源设备";
  empty.hidden = true;

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

  section.append(
    heading,
    filters,
    metricHeading,
    hint,
    status,
    groups,
    empty,
    errorBox
  );

  energyView = {
    section,
    metricSelect: metricField.select,
    metricHeading,
    hint,
    status,
    groups,
    empty,
    errorBox,
    errorText,
    retryButton,
  };

  metricField.select.addEventListener("change", () => {
    setEnergyMetric(metricField.select.value);
  });

  retryButton.addEventListener("click", () => {
    loadEnergy();
  });

  return section;
}

// 设备责任页：负责人表格与登记表单；负责人固定为课堂角色 manager。
function createOwnersSection() {
  const section = document.createElement("section");
  section.className = "panel view";
  section.id = "view-owners";
  section.hidden = true;

  const heading = document.createElement("h2");
  heading.textContent = "设备责任";

  const role = document.createElement("p");
  role.className = "owner-role";
  role.textContent = "处理人 manager（课堂角色）";

  const status = document.createElement("p");
  status.className = "table-status";
  status.textContent = "正在读取负责人";

  const wrap = document.createElement("div");
  wrap.className = "table-wrap";
  wrap.hidden = true;

  const table = document.createElement("table");
  table.className = "data-table owner-table";

  const caption = document.createElement("caption");
  caption.className = "visually-hidden";
  caption.textContent = "设备责任列表";

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  for (const label of ["编号", "设备名称", "当前负责人", "备注", "操作"]) {
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

  wrap.append(table, summary);

  const note = document.createElement("p");
  note.className = "data-note";
  note.textContent = "当前浏览器演示，尚未写入数据库";

  const editor = document.createElement("form");
  editor.className = "owner-editor";
  editor.id = "owner-editor";
  editor.hidden = true;

  const editorHeading = document.createElement("h3");
  editorHeading.textContent = "登记设备责任";

  const facts = document.createElement("dl");
  facts.className = "owner-facts";

  const deviceTerm = document.createElement("dt");
  deviceTerm.textContent = "设备";
  const editorDevice = document.createElement("dd");

  const ownerTerm = document.createElement("dt");
  ownerTerm.textContent = "当前负责人";
  const editorOwner = document.createElement("dd");

  const versionTerm = document.createElement("dt");
  versionTerm.textContent = "版本";
  const editorVersion = document.createElement("dd");

  facts.append(
    deviceTerm,
    editorDevice,
    ownerTerm,
    editorOwner,
    versionTerm,
    editorVersion
  );

  const editorRole = document.createElement("p");
  editorRole.className = "owner-role";
  editorRole.textContent = "处理人 manager（课堂角色）";

  const noteField = document.createElement("label");
  noteField.className = "owner-field";

  const noteLabel = document.createElement("span");
  noteLabel.className = "owner-field-label";
  noteLabel.textContent = "备注";

  const noteInput = document.createElement("textarea");
  noteInput.className = "owner-note-input";
  noteInput.rows = 3;
  noteInput.placeholder = "例如：日常巡检由该同学负责";
  noteInput.autocomplete = "off";

  noteField.append(noteLabel, noteInput);

  const editorError = document.createElement("div");
  editorError.className = "table-error owner-editor-error";
  editorError.hidden = true;

  const editorErrorText = document.createElement("p");
  editorErrorText.className = "table-status";

  const reloadButton = document.createElement("button");
  reloadButton.type = "button";
  reloadButton.className = "retry-button";
  reloadButton.textContent = "重新读取";
  reloadButton.hidden = true;

  editorError.append(editorErrorText, reloadButton);

  const formActions = document.createElement("div");
  formActions.className = "owner-form-actions";

  const saveButton = document.createElement("button");
  saveButton.type = "submit";
  saveButton.className = "owner-save";
  saveButton.textContent = "保存";

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.className = "owner-cancel";
  cancelButton.textContent = "取消";

  formActions.append(saveButton, cancelButton);

  editor.append(
    editorHeading,
    facts,
    editorRole,
    noteField,
    editorError,
    formActions
  );

  const loadErrorBox = document.createElement("div");
  loadErrorBox.className = "table-error";
  loadErrorBox.hidden = true;

  const loadErrorText = document.createElement("p");
  loadErrorText.className = "table-status";

  const loadRetryButton = document.createElement("button");
  loadRetryButton.type = "button";
  loadRetryButton.className = "retry-button";
  loadRetryButton.textContent = "重试";

  loadErrorBox.append(loadErrorText, loadRetryButton);

  section.append(heading, role, status, wrap, note, editor, loadErrorBox);

  ownersView = {
    section,
    role,
    status,
    wrap,
    tbody,
    summary,
    note,
    editor,
    editorDevice,
    editorOwner,
    editorVersion,
    noteInput,
    editorError,
    editorErrorText,
    reloadButton,
    saveButton,
    cancelButton,
    loadErrorBox,
    loadErrorText,
    loadRetryButton,
  };

  loadRetryButton.addEventListener("click", () => {
    loadOwners();
  });

  cancelButton.addEventListener("click", () => {
    const triggerButton = activeOwnerButton;
    closeOwnerEditor();
    if (triggerButton) triggerButton.focus();
  });

  reloadButton.addEventListener("click", async () => {
    closeOwnerEditor();
    await loadOwners();
  });

  editor.addEventListener("submit", handleOwnerSubmit);

  return section;
}

// 除概览、设备、空间、能源、设备责任外，其余页面只显示标题和占位说明；文本一律用 textContent 写入。
for (const view of VIEWS) {
  if (view.id === DEFAULT_VIEW || !outlet) continue;

  let section;

  if (view.id === "devices") {
    section = createDevicesSection();
  } else if (view.id === "spaces") {
    section = createSpacesSection();
  } else if (view.id === "energy") {
    section = createEnergySection();
  } else if (view.id === "owners") {
    section = createOwnersSection();
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

  if (viewId === "spaces" && !spacesLoaded) {
    loadSpaces();
  }

  if (viewId === "energy" && !energyLoaded) {
    loadEnergy();
  }

  if (viewId === "owners" && !ownersLoaded) {
    loadOwners();
  }

  // 从空间或责任页回到设备页时，详情若仍展开则重新读取当前内容。
  if (
    viewId === "devices" &&
    devicesView &&
    !devicesView.detail.hidden &&
    activeDetailDeviceId
  ) {
    openDeviceDetail(activeDetailDeviceId, activeDetailButton);
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

// 设备表同样显示空间位置，空间位置修改后一起更新。
function formatSpaceLabel(space) {
  if (!space) return "未知空间";

  const building =
    typeof space.building === "string" && space.building.trim() !== ""
      ? space.building.trim()
      : "未知楼栋";
  const floor =
    typeof space.floor === "string" && space.floor.trim() !== ""
      ? space.floor.trim()
      : "未知楼层";
  const floorText = floor.endsWith("层") ? floor : `${floor}层`;

  return `${space.name}（${building} ${floorText}）`;
}

function renderDeviceRows(devices, spaces) {
  if (!devicesView) return;

  const spaceLabels = new Map();
  for (const space of spaces) {
    spaceLabels.set(space.id, formatSpaceLabel(space));
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
    spaceCell.textContent = spaceLabels.get(device.spaceId) ?? "未知空间";

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
    detailButton.dataset.deviceId = device.id;
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
  // 0 是真实读数，只能用 null/undefined 判断缺失，不能用真假值判断。
  if (typeof value === "number" && !Number.isFinite(value)) return "缺失";
  return String(value);
}

// 空字符串和 null 都表示原始数据没有单位，这里只写明“无单位”，不补 °C、kW 之类。
function formatPointUnit(unit) {
  if (typeof unit !== "string" || unit.trim() === "") return "无单位";
  return unit;
}

// 采样时间只读原始 time 字段，不使用当前时间，因此刷新不会出现新的时间。
function formatSampleTime(time) {
  if (typeof time !== "number" || !Number.isFinite(time)) return "无采样时间";
  const date = new Date(time);
  if (Number.isNaN(date.getTime())) return "无采样时间";
  return SAMPLE_TIME_FORMAT.format(date);
}

function formatPointName(tagId) {
  return POINT_LABELS[tagId] ?? "未知点位";
}

function formatQuality(quality) {
  return QUALITY_LABELS[quality] ?? "未知";
}

// 点位单元格：中文名在上，原 tagId 在下，设备详情和概览共用同一套写法。
function createPointTagCell(tagId) {
  const cell = document.createElement("td");
  cell.className = "point-tag";

  const name = document.createElement("span");
  name.className = "point-name";
  name.textContent = formatPointName(tagId);

  const code = document.createElement("code");
  code.className = "point-code";
  code.textContent =
    typeof tagId === "string" && tagId !== "" ? tagId : "未知标签";

  cell.append(name, code);
  return cell;
}

// 质量只是数据状态标签，不写成故障结论。
function createQualityBadge(quality) {
  const badge = document.createElement("span");
  badge.className =
    `quality-badge ${QUALITY_CLASSES[quality] ?? "is-unknown"}`;
  badge.textContent = formatQuality(quality);
  return badge;
}

function renderDetailFacts(device, space, owner) {
  if (!devicesView) return;

  const entries = [
    ["编号", device.id],
    ["名称", device.name],
    ["类型", CATEGORY_LABELS[device.category] ?? "未分类"],
    ["空间", formatSpaceLabel(space)],
    ["在线情况", formatOnline(device.online).text],
    ["当前负责人", owner ? owner.username : "尚未登记"],
    ["备注", owner ? owner.note || "—" : "尚未登记"],
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

// 每行一个读数：中文点位名 + 原 tagId、原始数值、单位、采样时间、质量。
function renderDetailPoints(points) {
  if (!devicesView) return;

  const tbody = devicesView.pointsBody;
  tbody.replaceChildren();

  for (const point of points) {
    const row = document.createElement("tr");
    row.dataset.tagId =
      typeof point.tagId === "string" ? point.tagId : "";

    // 原 tagId 一起显示，方便后续课程按字段名查找接口和数据库列。
    const tagCell = createPointTagCell(point.tagId);

    const valueCell = document.createElement("td");
    valueCell.className = "point-value";
    const valueText = formatPointValue(point.value);
    valueCell.textContent = valueText;
    if (valueText === "缺失") valueCell.classList.add("is-missing");

    const unitCell = document.createElement("td");
    unitCell.className = "point-unit";
    unitCell.textContent = formatPointUnit(point.unit);

    const timeCell = document.createElement("td");
    timeCell.className = "point-time";
    timeCell.textContent = formatSampleTime(point.time);

    const qualityCell = document.createElement("td");
    qualityCell.append(createQualityBadge(point.quality));

    row.append(tagCell, valueCell, unitCell, timeCell, qualityCell);
    tbody.append(row);
  }

  const isEmpty = points.length === 0;
  devicesView.pointsEmpty.hidden = !isEmpty;
  devicesView.pointsTable.hidden = isEmpty;
}

// 收起详情只影响详情本身，设备表的筛选条件一律不动。
function closeDeviceDetail() {
  if (!devicesView) return;

  devicesView.detail.hidden = true;
  detailRequestId += 1;
  activeDetailDeviceId = null;
  activeDetailSpaceId = null;

  if (activeDetailButton) {
    activeDetailButton.setAttribute("aria-expanded", "false");
    activeDetailButton = null;
  }
}

// 每次打开都重新读取空间与负责人，避免显示修改前的旧副本。
async function openDeviceDetail(deviceId, triggerButton) {
  if (!devicesView) return;

  const device = loadedDevices.find((item) => item.id === deviceId);
  if (!device) return;

  let button = triggerButton;
  if (button && !button.isConnected) {
    button =
      Array.from(devicesView.tbody.querySelectorAll("button[data-device-id]")).find(
        (item) => item.dataset.deviceId === device.id
      ) ?? null;
  }

  const requestId = ++detailRequestId;
  activeDetailDeviceId = device.id;
  activeDetailSpaceId = device.spaceId ?? null;

  if (activeDetailButton && activeDetailButton !== button) {
    activeDetailButton.setAttribute("aria-expanded", "false");
  }
  activeDetailButton = button;
  if (button) button.setAttribute("aria-expanded", "true");

  devicesView.detail.hidden = false;
  devicesView.detailNotice.hidden = false;
  devicesView.detailNotice.textContent = "正在读取当前负责人和空间";
  devicesView.facts.hidden = true;
  devicesView.detailActions.hidden = true;
  devicesView.pointsHeading.hidden = true;
  devicesView.pointsWrap.hidden = true;
  devicesView.pointsEmpty.hidden = true;
  devicesView.pointsNote.hidden = true;

  try {
    const [spaces, owners] = await Promise.all([getSpaces(), getOwners()]);
    if (requestId !== detailRequestId) return;

    loadedSpaces = spaces;
    const space = spaces.find((item) => item.id === device.spaceId);
    const owner =
      owners.find((item) => item && item.deviceId === device.id) ?? null;
    const points = loadedPoints.filter(
      (point) => point.deviceId === device.id
    );

    activeDetailSpaceId = space ? space.id : null;

    renderDetailFacts(device, space, owner);
    renderDetailPoints(points);

    devicesView.detailNotice.hidden = true;
    devicesView.facts.hidden = false;
    devicesView.detailActions.hidden = false;
    devicesView.spaceLinkButton.disabled = !space;
    devicesView.pointsHeading.hidden = false;
    devicesView.pointsWrap.hidden = false;
    devicesView.pointsNote.hidden = false;
  } catch (error) {
    if (requestId !== detailRequestId) return;
    devicesView.detailNotice.hidden = false;
    devicesView.detailNotice.textContent =
      `设备详情读取失败：${describeError(error)}，请收起详情后重试`;
    console.error("设备详情读取失败", error);
  }
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

// ---------- 空间读取 ----------

function setSpacesStatus(text) {
  if (!spacesView) return;
  spacesView.status.textContent = text;
  spacesView.status.hidden = false;
  spacesView.grid.hidden = true;
  spacesView.errorBox.hidden = true;
}

function showSpacesError(error) {
  if (!spacesView) return;
  const detail =
    error instanceof Error && error.message ? error.message : "未知错误";
  pendingSpaceTargetId = null;
  spacesView.status.hidden = true;
  spacesView.grid.hidden = true;
  spacesView.errorBox.hidden = false;
  spacesView.errorText.textContent = `空间读取失败：${detail}`;
}

// 定位空间卡片：滚动到可见位置、聚焦卡片并高亮，便于从设备详情跳转后确认。
function focusSpaceCard(spaceId) {
  if (!spacesView || !spaceId) return;

  for (const card of spacesView.grid.querySelectorAll(".space-card.is-target")) {
    card.classList.remove("is-target");
  }

  const card = Array.from(spacesView.grid.children).find(
    (item) => item.dataset.spaceId === spaceId
  );
  if (!card) return;

  card.classList.add("is-target");
  card.scrollIntoView({ block: "center" });
  card.focus({ preventScroll: true });
}

// 设备按 spaceId 归属，数量从已读取的设备数组逐台累计，不写死。
function countDevicesBySpace(devices) {
  const counts = new Map();
  for (const device of devices) {
    if (!device || typeof device.spaceId !== "string") continue;
    counts.set(device.spaceId, (counts.get(device.spaceId) ?? 0) + 1);
  }
  return counts;
}

// 表单字段：标签包住输入框，供空间位置编辑复用。
function createSpaceField(labelText, inputId, value) {
  const field = document.createElement("label");
  field.className = "space-form-field";

  const caption = document.createElement("span");
  caption.className = "space-form-label";
  caption.textContent = labelText;

  const input = document.createElement("input");
  input.type = "text";
  input.id = inputId;
  input.className = "filter-control";
  input.value = value ?? "";
  input.autocomplete = "off";

  field.append(caption, input);
  return { field, input };
}

// 按数据原始顺序展示空间，每张卡片显示名称、楼栋、楼层和设备数量。
function renderSpaceCards(spaces, devices) {
  if (!spacesView) return;

  const counts = countDevicesBySpace(devices);
  const grid = spacesView.grid;
  grid.replaceChildren();
  activeSpaceEditor = null;

  for (const space of spaces) {
    const card = document.createElement("article");
    card.className = "space-card";
    card.dataset.spaceId = space.id;
    card.tabIndex = -1;

    const name = document.createElement("h3");
    name.id = `space-name-${space.id}`;
    name.textContent = space.name;
    card.setAttribute("aria-labelledby", name.id);

    const facts = document.createElement("dl");
    facts.className = "space-facts";

    const buildingTerm = document.createElement("dt");
    buildingTerm.textContent = "楼栋";
    const buildingValue = document.createElement("dd");
    buildingValue.textContent = space.building ?? "未知";

    const floorTerm = document.createElement("dt");
    floorTerm.textContent = "楼层";
    const floorValue = document.createElement("dd");
    floorValue.textContent = space.floor ?? "未知";

    facts.append(buildingTerm, buildingValue, floorTerm, floorValue);

    const count = document.createElement("p");
    count.className = "space-count";
    count.textContent = `设备 ${counts.get(space.id) ?? 0} 台`;

    const actions = document.createElement("div");
    actions.className = "space-actions";

    const viewButton = document.createElement("button");
    viewButton.type = "button";
    viewButton.className = "space-action";
    viewButton.textContent = "查看设备";
    viewButton.setAttribute("aria-label", `查看${space.name}的设备`);
    viewButton.addEventListener("click", () => {
      openDevicesForSpace(space.id);
    });

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "space-action is-secondary";
    editButton.textContent = "编辑位置";
    editButton.setAttribute("aria-label", `编辑${space.name}的位置`);
    editButton.setAttribute("aria-expanded", "false");
    editButton.setAttribute("aria-controls", `space-editor-${space.id}`);

    actions.append(viewButton, editButton);

    // 编辑表单只含楼栋、楼层；空间名称只读展示，ID 与设备归属不参与修改。
    const form = document.createElement("form");
    form.className = "space-form";
    form.id = `space-editor-${space.id}`;
    form.hidden = true;

    const formName = document.createElement("p");
    formName.className = "space-form-name";
    formName.textContent = `空间：${space.name}`;

    const buildingField = createSpaceField(
      "楼栋",
      `space-building-${space.id}`,
      space.building
    );
    const floorField = createSpaceField(
      "楼层",
      `space-floor-${space.id}`,
      space.floor
    );

    const errorText = document.createElement("p");
    errorText.className = "space-form-error";
    errorText.setAttribute("role", "alert");
    errorText.hidden = true;

    const formActions = document.createElement("div");
    formActions.className = "space-form-actions";

    const saveButton = document.createElement("button");
    saveButton.type = "submit";
    saveButton.className = "space-save";
    saveButton.textContent = "保存";

    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.className = "space-cancel";
    cancelButton.textContent = "取消";

    formActions.append(saveButton, cancelButton);
    form.append(
      formName,
      buildingField.field,
      floorField.field,
      errorText,
      formActions
    );

    function closeEditor() {
      form.hidden = true;
      editButton.setAttribute("aria-expanded", "false");
      errorText.hidden = true;
      errorText.textContent = "";
      buildingField.input.value = space.building ?? "";
      floorField.input.value = space.floor ?? "";
      if (activeSpaceEditor && activeSpaceEditor.form === form) {
        activeSpaceEditor = null;
      }
    }

    let saving = false;

    editButton.addEventListener("click", () => {
      if (!form.hidden) {
        closeEditor();
        return;
      }

      if (activeSpaceEditor && activeSpaceEditor.form !== form) {
        activeSpaceEditor.close();
      }

      buildingField.input.value = space.building ?? "";
      floorField.input.value = space.floor ?? "";
      errorText.hidden = true;
      errorText.textContent = "";
      form.hidden = false;
      editButton.setAttribute("aria-expanded", "true");
      activeSpaceEditor = { form, close: closeEditor };
      buildingField.input.focus();
    });

    cancelButton.addEventListener("click", () => {
      closeEditor();
      editButton.focus();
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (saving) return;

      saving = true;
      saveButton.disabled = true;
      cancelButton.disabled = true;
      saveButton.textContent = "正在保存";
      errorText.hidden = true;

      try {
        await saveSpace(space.id, {
          building: buildingField.input.value,
          floor: floorField.input.value,
        });

        // 保存成功后重新读取空间，用返回后的数据展示，不自行拼改页面。
        await loadSpaces();
      } catch (error) {
        // 失败时保留输入内容和表单，方便学生直接修改后重试。
        errorText.textContent = `保存失败：${describeError(error)}`;
        errorText.hidden = false;
        form.hidden = false;
        editButton.setAttribute("aria-expanded", "true");
      } finally {
        saving = false;
        saveButton.disabled = false;
        cancelButton.disabled = false;
        saveButton.textContent = "保存";
      }
    });

    card.append(name, facts, count, actions, form);
    grid.append(card);
  }
}

async function loadSpaces() {
  if (!spacesView || spacesLoading) return;

  spacesLoading = true;
  setSpacesStatus("正在读取空间");

  try {
    const [spaces, devices] = await Promise.all([getSpaces(), getDevices()]);

    if (spaces.length === 0) {
      pendingSpaceTargetId = null;
      setSpacesStatus("没有空间");
      spacesLoaded = true;
      return;
    }

    renderSpaceCards(spaces, devices);

    // 设备表共用同一份空间数据；已加载时同步名称与筛选下拉框。
    loadedSpaces = spaces;
    if (devicesView && devicesLoaded) {
      fillSpaceOptions(spaces);
      applyDeviceFilters();
    }

    spacesView.status.hidden = true;
    spacesView.grid.hidden = false;
    spacesView.errorBox.hidden = true;
    spacesLoaded = true;

    const targetId = pendingSpaceTargetId;
    pendingSpaceTargetId = null;
    if (targetId) focusSpaceCard(targetId);
  } catch (error) {
    showSpacesError(error);
    console.error("空间数据读取失败", error);
  } finally {
    spacesLoading = false;
  }
}

// 进入设备页时只保留一项筛选：搜索、类型、空间、在线情况先全部清空，再设置本次入口的条件。
async function openDevicesWithFilter({ spaceId = "", category = "" } = {}) {
  if (!devicesView) return;

  if (!devicesLoaded && !devicesLoading) {
    await loadDevices();
  }

  devicesView.searchInput.value = "";
  devicesView.categorySelect.value = "";
  devicesView.spaceSelect.value = "";
  devicesView.onlineSelect.value = "";

  if (spaceId) {
    const hasSpace = Array.from(devicesView.spaceSelect.options).some(
      (option) => option.value === spaceId
    );
    devicesView.spaceSelect.value = hasSpace ? spaceId : "";
  }

  if (category) {
    const hasCategory = Array.from(devicesView.categorySelect.options).some(
      (option) => option.value === category
    );
    devicesView.categorySelect.value = hasCategory ? category : "";
  }

  if (devicesLoaded) {
    applyDeviceFilters();
  }

  // 旧详情属于上一批条件，先收起；本次筛选保留，学生可再从行内点“查看”。
  closeDeviceDetail();

  openDevicesView();
}

// 空间页“查看设备”和概览空间入口共用：只保留该空间筛选。
async function openDevicesForSpace(spaceId) {
  return openDevicesWithFilter({ spaceId });
}

// 概览“能源”入口：只保留 energy 类型筛选。
async function openDevicesForCategory(category) {
  return openDevicesWithFilter({ category });
}

// 从设备详情进入空间页并定位到指定空间。
async function openSpacesForSpace(spaceId) {
  if (!spaceId) return;

  pendingSpaceTargetId = spaceId;
  if (activeSpaceEditor) activeSpaceEditor.close();

  const spacesMenuItem = menuItems.find(
    (item) => item.dataset.view === "spaces"
  );
  if (spacesMenuItem) {
    spacesMenuItem.click();
  } else {
    render("spaces");
    window.location.hash = "spaces";
  }

  if (spacesLoaded) {
    await loadSpaces();
  }
}

// ---------- 设备责任 ----------

function ownerVersionOf(owner) {
  if (owner && Number.isInteger(owner.version) && owner.version >= 0) {
    return owner.version;
  }
  return 0;
}

function setOwnersStatus(text) {
  if (!ownersView) return;
  ownersView.status.textContent = text;
  ownersView.status.hidden = false;
  ownersView.wrap.hidden = true;
  ownersView.loadErrorBox.hidden = true;
}

function showOwnersError(error) {
  if (!ownersView) return;
  const detail =
    error instanceof Error && error.message ? error.message : "未知错误";
  pendingOwnerTargetId = null;
  ownersView.status.hidden = true;
  ownersView.wrap.hidden = true;
  ownersView.loadErrorBox.hidden = false;
  ownersView.loadErrorText.textContent = `负责人读取失败：${detail}`;
}

// 定位责任表格中的设备行：滚动到可见位置、高亮并聚焦“登记”按钮。
function focusOwnerDevice(deviceId) {
  if (!ownersView || !deviceId) return;

  for (const row of ownersView.tbody.querySelectorAll("tr.is-target")) {
    row.classList.remove("is-target");
  }

  const row = Array.from(ownersView.tbody.rows).find(
    (item) => item.dataset.deviceId === deviceId
  );
  if (!row) return;

  row.classList.add("is-target");
  row.scrollIntoView({ block: "center" });
  const button = row.querySelector("button");
  if (button) button.focus({ preventScroll: true });
}

// 设备全部列出；没有负责人记录时显示“尚未登记”，版本按 0 处理。
function renderOwnerRows(devices, owners) {
  if (!ownersView) return;

  const ownersByDevice = new Map();
  for (const owner of owners) {
    if (!owner || typeof owner.deviceId !== "string") continue;
    ownersByDevice.set(owner.deviceId, owner);
  }

  const tbody = ownersView.tbody;
  tbody.replaceChildren();

  for (const device of devices) {
    const owner = ownersByDevice.get(device.id);

    const row = document.createElement("tr");
    row.dataset.deviceId = device.id;

    const idCell = document.createElement("td");
    idCell.textContent = device.id;

    const nameCell = document.createElement("td");
    nameCell.textContent = device.name;

    const ownerCell = document.createElement("td");
    if (owner) {
      const ownerName = document.createElement("span");
      ownerName.className = "owner-name";
      ownerName.textContent = owner.username;

      const ownerVersion = document.createElement("span");
      ownerVersion.className = "owner-version";
      ownerVersion.textContent = `版本 ${ownerVersionOf(owner)}`;

      ownerCell.append(ownerName, ownerVersion);
    } else {
      ownerCell.textContent = "尚未登记";
    }

    const noteCell = document.createElement("td");
    noteCell.className = "owner-note";
    noteCell.textContent = owner ? owner.note : "—";

    const actionCell = document.createElement("td");
    const registerButton = document.createElement("button");
    registerButton.type = "button";
    registerButton.className = "row-action";
    registerButton.textContent = "登记";
    registerButton.setAttribute("aria-expanded", "false");
    registerButton.setAttribute("aria-controls", "owner-editor");
    registerButton.setAttribute(
      "aria-label",
      `登记${device.name}的责任人`
    );
    registerButton.addEventListener("click", () => {
      openOwnerEditor(device, owner, registerButton);
    });
    actionCell.append(registerButton);

    row.append(idCell, nameCell, ownerCell, noteCell, actionCell);
    tbody.append(row);
  }

  const registeredCount = devices.filter((device) =>
    ownersByDevice.has(device.id)
  ).length;
  ownersView.summary.textContent =
    `已登记 ${registeredCount} 台 / 全部 ${devices.length} 台`;
}

function openOwnerEditor(device, owner, triggerButton) {
  if (!ownersView) return;

  if (!ownersView.editor.hidden && activeOwnerButton === triggerButton) {
    closeOwnerEditor();
    return;
  }

  currentOwnerDevice = device;
  currentOwnerVersion = ownerVersionOf(owner);

  ownersView.editorDevice.textContent = `${device.id} ${device.name}`;
  ownersView.editorOwner.textContent = owner ? owner.username : "尚未登记";
  ownersView.editorVersion.textContent = String(currentOwnerVersion);
  ownersView.noteInput.value = owner ? owner.note : "";
  ownersView.editorError.hidden = true;
  ownersView.reloadButton.hidden = true;

  if (activeOwnerButton && activeOwnerButton !== triggerButton) {
    activeOwnerButton.setAttribute("aria-expanded", "false");
  }

  activeOwnerButton = triggerButton;
  triggerButton.setAttribute("aria-expanded", "true");
  ownersView.editor.hidden = false;
  ownersView.noteInput.focus();
}

function closeOwnerEditor() {
  if (!ownersView) return;

  ownersView.editor.hidden = true;
  ownersView.noteInput.value = "";
  ownersView.editorError.hidden = true;
  ownersView.reloadButton.hidden = true;

  if (activeOwnerButton) {
    activeOwnerButton.setAttribute("aria-expanded", "false");
  }
  activeOwnerButton = null;
  currentOwnerDevice = null;
  currentOwnerVersion = 0;
}

async function handleOwnerSubmit(event) {
  event.preventDefault();
  if (!ownersView || !currentOwnerDevice || ownerSaving) return;

  const deviceId = currentOwnerDevice.id;
  const expectedVersion = currentOwnerVersion;

  ownerSaving = true;
  ownersView.saveButton.disabled = true;
  ownersView.cancelButton.disabled = true;
  ownersView.saveButton.textContent = "正在保存";
  ownersView.editorError.hidden = true;
  ownersView.reloadButton.hidden = true;

  try {
    await saveOwner(deviceId, {
      username: "manager",
      note: ownersView.noteInput.value,
      expectedVersion,
    });

    closeOwnerEditor();
    await loadOwners();
  } catch (error) {
    // 版本不一致时不自动重试：保留表单，提示重新读取后再决定。
    ownersView.editor.hidden = false;
    ownersView.editorError.hidden = false;
    ownersView.editorErrorText.textContent = `保存失败：${describeError(error)}`;
    ownersView.reloadButton.hidden = !(
      error && error.code === "VERSION_CONFLICT"
    );
  } finally {
    ownerSaving = false;
    ownersView.saveButton.disabled = false;
    ownersView.cancelButton.disabled = false;
    ownersView.saveButton.textContent = "保存";
  }
}

async function loadOwners() {
  if (!ownersView || ownersLoading) return;

  ownersLoading = true;
  setOwnersStatus("正在读取负责人");

  try {
    const [devices, owners] = await Promise.all([getDevices(), getOwners()]);

    if (devices.length === 0) {
      pendingOwnerTargetId = null;
      setOwnersStatus("没有设备");
      ownersLoaded = true;
      return;
    }

    renderOwnerRows(devices, owners);

    ownersView.status.hidden = true;
    ownersView.wrap.hidden = false;
    ownersView.loadErrorBox.hidden = true;
    ownersLoaded = true;

    const targetId = pendingOwnerTargetId;
    pendingOwnerTargetId = null;
    if (targetId) focusOwnerDevice(targetId);
  } catch (error) {
    showOwnersError(error);
    console.error("负责人数据读取失败", error);
  } finally {
    ownersLoading = false;
  }
}

// 从设备详情进入设备责任页，重新读取后定位到该设备。
async function openOwnersForDevice(deviceId) {
  if (!deviceId) return;

  pendingOwnerTargetId = deviceId;
  closeOwnerEditor();

  const ownersMenuItem = menuItems.find(
    (item) => item.dataset.view === "owners"
  );
  if (ownersMenuItem) {
    ownersMenuItem.click();
  } else {
    render("owners");
    window.location.hash = "owners";
  }

  if (ownersLoaded) {
    await loadOwners();
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

// ---------- 能源页：只看能源设备自己的功率或电压点位 ----------

function setEnergyStatus(text) {
  if (!energyView) return;
  energyView.status.textContent = text;
  energyView.status.hidden = false;
  energyView.groups.hidden = true;
  energyView.empty.hidden = true;
  energyView.errorBox.hidden = true;
}

function showEnergyError(error) {
  if (!energyView) return;
  energyView.status.hidden = true;
  energyView.groups.hidden = true;
  energyView.empty.hidden = true;
  energyView.errorBox.hidden = false;
  energyView.errorText.textContent = `读数读取失败：${describeError(error)}`;
}

// 严格按 category=energy 选设备，其他类型即使有 power 点位也不进这一页。
function pickEnergyDevices(devices) {
  return devices.filter((device) => device && device.category === "energy");
}

// 只在该设备自己的点位里找与当前读数项同字段、同单位的那一条；找不到返回 null。
function findMetricPoint(points, deviceId, metric) {
  return (
    points.find(
      (point) =>
        point &&
        point.deviceId === deviceId &&
        point.tagId === metric.tagId &&
        point.unit === metric.unit
    ) ?? null
  );
}

function createEnergyGroup(spaceLabel, metric) {
  const group = document.createElement("section");
  group.className = "energy-group";

  const heading = document.createElement("h4");
  heading.textContent = spaceLabel;

  const wrap = document.createElement("div");
  wrap.className = "table-wrap";

  const table = document.createElement("table");
  table.className = "data-table energy-table";

  const caption = document.createElement("caption");
  caption.className = "visually-hidden";
  caption.textContent = `${spaceLabel}的${metric.valueHeader}读数`;

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  for (const label of [
    "设备名称",
    metric.valueHeader,
    "单位",
    "质量",
    "原采样时间",
    "操作",
  ]) {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = label;
    headRow.append(th);
  }
  thead.append(headRow);

  const tbody = document.createElement("tbody");
  table.append(caption, thead, tbody);
  wrap.append(table);
  group.append(heading, wrap);

  return { group, tbody };
}

function createEnergyRow(device, point, metric) {
  const row = document.createElement("tr");

  const nameCell = document.createElement("td");
  const name = document.createElement("span");
  name.className = "device-name";
  name.textContent = device.name;

  const code = document.createElement("code");
  code.className = "point-code";
  code.textContent =
    typeof device.id === "string" && device.id !== "" ? device.id : "无设备编号";

  nameCell.append(name, code);

  // 数值照原样写：0 就是 0；value 为 null 显示“缺失”；没有点位显示“没有这项样本”。
  const valueCell = document.createElement("td");
  valueCell.className = "energy-value";

  if (point === null) {
    valueCell.textContent = "没有这项样本";
    valueCell.classList.add("is-missing");
  } else {
    const valueText = formatPointValue(point.value);
    valueCell.textContent = valueText;
    if (valueText === "缺失") valueCell.classList.add("is-missing");
  }

  // 单位取自该点位自己的 unit 字段；没有点位时不补单位。
  const unitCell = document.createElement("td");
  unitCell.className = "energy-unit";
  unitCell.textContent = point ? formatPointUnit(point.unit) : "—";

  const qualityCell = document.createElement("td");
  if (point) {
    qualityCell.append(createQualityBadge(point.quality));
  } else {
    qualityCell.textContent = "—";
  }

  const timeCell = document.createElement("td");
  timeCell.textContent = point ? formatSampleTime(point.time) : "—";

  const actionCell = document.createElement("td");
  const detailButton = document.createElement("button");
  detailButton.type = "button";
  detailButton.className = "row-action";
  detailButton.textContent = "查看设备";
  detailButton.dataset.deviceId = device.id;
  detailButton.setAttribute("aria-label", `查看${device.name}的设备详情`);
  detailButton.addEventListener("click", () => {
    openExistingDeviceDetail(device.id, detailButton);
  });
  actionCell.append(detailButton);

  row.append(nameCell, valueCell, unitCell, qualityCell, timeCell, actionCell);
  return row;
}

function renderEnergyGroups(overview) {
  if (!energyView) return;

  const metric = ENERGY_METRICS[energyMetric] ?? ENERGY_METRICS.power;
  const energyDevices = pickEnergyDevices(overview.devices);
  const container = energyView.groups;
  container.replaceChildren();

  if (energyDevices.length === 0) {
    container.hidden = true;
    energyView.empty.hidden = false;
    return;
  }

  const spaceById = new Map();
  for (const space of overview.spaces) {
    if (space && typeof space.id === "string") {
      spaceById.set(space.id, space);
    }
  }

  // 按空间分组，顺序沿用空间数据；找不到所属空间的设备放到最后。
  const groups = new Map();
  for (const device of energyDevices) {
    const key = spaceById.has(device.spaceId) ? device.spaceId : "unknown";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(device);
  }

  for (const space of overview.spaces) {
    const devices = groups.get(space.id);
    if (!devices) continue;

    const group = createEnergyGroup(formatSpaceLabel(space), metric);
    for (const device of devices) {
      group.tbody.append(
        createEnergyRow(
          device,
          findMetricPoint(overview.points, device.id, metric),
          metric
        )
      );
    }
    container.append(group.group);
  }

  const orphanDevices = groups.get("unknown");
  if (orphanDevices) {
    const group = createEnergyGroup("未知空间", metric);
    for (const device of orphanDevices) {
      group.tbody.append(
        createEnergyRow(
          device,
          findMetricPoint(overview.points, device.id, metric),
          metric
        )
      );
    }
    container.append(group.group);
  }

  container.hidden = false;
}

// 切换读数项：标题、表头、数值、单位、质量、时间一起重画，旧数值不会留在页面上。
function setEnergyMetric(value) {
  const key = ENERGY_METRICS[value] ? value : "power";
  energyMetric = key;

  if (!energyView) return;

  const metric = ENERGY_METRICS[key];
  energyView.metricSelect.value = key;
  energyView.metricHeading.textContent = metric.label;
  energyView.hint.textContent = metric.hint;

  if (energyOverview) {
    renderEnergyGroups(energyOverview);
  }
}

async function loadEnergy() {
  if (!energyView || energyLoading) return;

  energyLoading = true;
  setEnergyStatus("正在读取读数");

  try {
    const overview = await getOverview();
    energyOverview = overview;
    renderEnergyGroups(overview);

    energyView.status.hidden = true;
    energyView.errorBox.hidden = true;
    energyLoaded = true;
  } catch (error) {
    showEnergyError(error);
    console.error("能源读数读取失败", error);
  } finally {
    energyLoading = false;
  }
}

// ---------- 概览统计：空间、类型、点位质量与需留意读数（第04课第2步） ----------

let dashboardBlocks = null;
let deviceDetailOpening = false;

function createCountBlock(title, hint) {
  const block = document.createElement("section");
  block.className = "dashboard-block";

  const heading = document.createElement("h3");
  heading.textContent = title;

  const hintText = document.createElement("p");
  hintText.className = "block-hint";
  hintText.textContent = hint;

  const status = document.createElement("p");
  status.className = "table-status";
  status.textContent = "正在读取";

  const list = document.createElement("ul");
  list.className = "count-list";
  list.hidden = true;

  block.append(heading, hintText, status, list);
  return { block, status, list };
}

// 需留意读数：复用设备详情的入口，不另做一套详情页面。
function createAttentionBlock() {
  const block = document.createElement("section");
  block.className = "dashboard-block";

  const heading = document.createElement("h3");
  heading.textContent = "需留意的读数";

  const hintText = document.createElement("p");
  hintText.className = "block-hint";
  hintText.textContent =
    "只列出质量不是“正常”的点位；质量是数据状态标签，不代表设备故障。";

  const status = document.createElement("p");
  status.className = "table-status";
  status.textContent = "正在读取";

  const wrap = document.createElement("div");
  wrap.className = "table-wrap";
  wrap.hidden = true;

  const table = document.createElement("table");
  table.className = "data-table";

  const caption = document.createElement("caption");
  caption.className = "visually-hidden";
  caption.textContent = "需留意的读数";

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  for (const label of ["设备名称", "点位", "质量", "原采样时间", "操作"]) {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = label;
    headRow.append(th);
  }
  thead.append(headRow);

  const tbody = document.createElement("tbody");
  table.append(caption, thead, tbody);
  wrap.append(table);

  const empty = document.createElement("p");
  empty.className = "table-empty";
  empty.textContent = "当前样本没有需留意的读数";
  empty.hidden = true;

  block.append(heading, hintText, status, wrap, empty);
  return { block, status, wrap, tbody, empty };
}

function ensureDashboardSummary() {
  if (dashboardBlocks) return dashboardBlocks;

  const container = document.getElementById("dashboard-summary");
  if (!container) return null;

  const spaces = createCountBlock(
    "各空间设备数量",
    "按设备所在空间统计，单位：台；点击空间可只看该空间的设备。"
  );
  const categories = createCountBlock(
    "各类型设备数量",
    "环境、能源、设施、照明四类，单位：台；点击能源可只看能源设备。"
  );
  const quality = createCountBlock(
    "点位质量分布",
    "按点位数量统计，不是设备数量，单位：项。"
  );
  const attention = createAttentionBlock();

  container.replaceChildren(
    spaces.block,
    categories.block,
    quality.block,
    attention.block
  );

  dashboardBlocks = { spaces, categories, quality, attention };
  return dashboardBlocks;
}

function renderCountList(list, rows) {
  list.replaceChildren();

  for (const [label, text, onSelect] of rows) {
    const item = document.createElement("li");

    // 带跳转的行做成按钮，其余保持纯文字，避免看起来能点却点不动。
    const content = document.createElement(onSelect ? "button" : "div");
    content.className = onSelect ? "count-item is-action" : "count-item";

    if (onSelect) {
      content.type = "button";
      content.setAttribute("aria-label", `${label} ${text}，查看设备`);
      content.addEventListener("click", onSelect);
    }

    const name = document.createElement("span");
    name.className = "count-label";
    name.textContent = label;

    const value = document.createElement("span");
    value.className = "count-value";
    value.textContent = text;

    content.append(name, value);
    item.append(content);
    list.append(item);
  }

  list.hidden = rows.length === 0;
}

function renderCountBlock(block, rows) {
  renderCountList(block.list, rows);

  if (rows.length === 0) {
    block.status.hidden = false;
    block.status.textContent = "没有可统计的数据";
  } else {
    block.status.hidden = true;
  }
}

function countDevicesByCategory(devices) {
  const counts = new Map();
  for (const device of devices) {
    if (!device || typeof device.id !== "string") continue;
    const key = typeof device.category === "string" ? device.category : "";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

// 质量统计以点位为单位，一项读数算一项，不按设备去重。
function countPointsByQuality(points) {
  const counts = new Map();
  for (const point of points) {
    if (!point || typeof point.deviceId !== "string") continue;
    const key = QUALITY_LABELS[point.quality] ? point.quality : "unknown";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function buildSpaceCountRows(overview) {
  const counts = countDevicesBySpace(overview.devices);
  const knownIds = new Set(overview.spaces.map((space) => space.id));

  const rows = overview.spaces.map((space) => [
    space.name,
    `${counts.get(space.id) ?? 0} 台`,
    () => openDevicesForSpace(space.id),
  ]);

  // 找不到所属空间的设备单独列出，避免数量被悄悄漏掉。
  const orphanCount = overview.devices.filter(
    (device) => !device || !knownIds.has(device.spaceId)
  ).length;
  if (orphanCount > 0) {
    rows.push(["未关联空间", `${orphanCount} 台`]);
  }

  return rows;
}

function buildCategoryCountRows(devices) {
  const counts = countDevicesByCategory(devices);
  const rows = [];

  for (const [key, label] of Object.entries(CATEGORY_LABELS)) {
    // 概览只给“能源”留入口，其余类型保持纯文字，不额外增加跳转。
    const onSelect =
      key === "energy"
        ? () => openDevicesForCategory("energy")
        : null;
    rows.push([label, `${counts.get(key) ?? 0} 台`, onSelect]);
    counts.delete(key);
  }

  let unknownCount = 0;
  for (const value of counts.values()) unknownCount += value;
  if (unknownCount > 0) {
    rows.push(["未分类", `${unknownCount} 台`]);
  }

  return rows;
}

function buildQualityCountRows(points) {
  const counts = countPointsByQuality(points);
  const rows = [];

  for (const [key, label] of Object.entries(QUALITY_LABELS)) {
    rows.push([label, `${counts.get(key) ?? 0} 项`]);
    counts.delete(key);
  }

  let unknownCount = 0;
  for (const value of counts.values()) unknownCount += value;
  if (unknownCount > 0) {
    rows.push(["未知质量", `${unknownCount} 项`]);
  }

  return rows;
}

// 非 fresh 点位逐条列出：设备名称、点位、质量、原采样时间，按钮打开现有设备详情。
function renderAttentionRows(overview) {
  const refs = dashboardBlocks ? dashboardBlocks.attention : null;
  if (!refs) return;

  const deviceById = new Map();
  for (const device of overview.devices) {
    if (device && typeof device.id === "string") {
      deviceById.set(device.id, device);
    }
  }

  const rows = overview.points.filter(
    (point) => point && point.quality !== "fresh"
  );

  refs.tbody.replaceChildren();

  for (const point of rows) {
    const device = deviceById.get(point.deviceId) ?? null;
    const row = document.createElement("tr");

    const deviceCell = document.createElement("td");
    const deviceName = document.createElement("span");
    deviceName.className = "device-name";
    deviceName.textContent = device ? device.name : "未知设备";

    const deviceCode = document.createElement("code");
    deviceCode.className = "point-code";
    deviceCode.textContent =
      typeof point.deviceId === "string" && point.deviceId !== ""
        ? point.deviceId
        : "无设备编号";

    deviceCell.append(deviceName, deviceCode);

    const pointCell = createPointTagCell(point.tagId);

    const qualityCell = document.createElement("td");
    qualityCell.append(createQualityBadge(point.quality));

    const timeCell = document.createElement("td");
    timeCell.textContent = formatSampleTime(point.time);

    const actionCell = document.createElement("td");
    const detailButton = document.createElement("button");
    detailButton.type = "button";
    detailButton.className = "row-action";
    detailButton.textContent = "查看设备";

    if (device) {
      detailButton.dataset.deviceId = device.id;
      detailButton.setAttribute(
        "aria-label",
        `查看${device.name}的设备详情`
      );
      detailButton.addEventListener("click", () => {
        openExistingDeviceDetail(device.id, detailButton);
      });
    } else {
      detailButton.disabled = true;
      detailButton.title = "找不到对应设备，无法打开详情";
    }
    actionCell.append(detailButton);

    row.append(deviceCell, pointCell, qualityCell, timeCell, actionCell);
    refs.tbody.append(row);
  }

  const isEmpty = rows.length === 0;
  refs.status.hidden = true;
  refs.wrap.hidden = isEmpty;
  refs.empty.hidden = !isEmpty;
}

function renderDashboardSummary(overview) {
  const refs = ensureDashboardSummary();
  if (!refs) return;

  renderCountBlock(refs.spaces, buildSpaceCountRows(overview));
  renderCountBlock(refs.categories, buildCategoryCountRows(overview.devices));
  renderCountBlock(refs.quality, buildQualityCountRows(overview.points));
  renderAttentionRows(overview);
}

function showDashboardError(message) {
  const refs = dashboardBlocks;
  if (!refs) return;

  for (const block of [refs.spaces, refs.categories, refs.quality]) {
    block.status.hidden = false;
    block.status.textContent = `读取失败：${message}`;
    block.list.hidden = true;
  }

  refs.attention.status.hidden = false;
  refs.attention.status.textContent = `读取失败：${message}`;
  refs.attention.wrap.hidden = true;
  refs.attention.empty.hidden = true;
}

// 切到现有设备页，不改动设备页本身的读取入口和错误提示。
function openDevicesView() {
  const devicesMenuItem = menuItems.find(
    (item) => item.dataset.view === "devices"
  );

  if (devicesMenuItem) {
    devicesMenuItem.click();
    return;
  }

  render("devices");
  window.location.hash = "devices";
}

// 概览和能源页共用：跳到设备页，清空筛选后打开现有详情，定位到真实 deviceId。
async function openExistingDeviceDetail(deviceId, triggerButton) {
  if (!deviceId || deviceDetailOpening) return;

  deviceDetailOpening = true;
  if (triggerButton) triggerButton.disabled = true;

  try {
    // 先确保设备数据已读入，再切到设备页，避免切换后又读一次。
    if (!devicesLoaded) {
      await loadDevices();
    }

    // 读取失败时也切到设备页，让现有的错误提示和重试按钮显示出来。
    if (!devicesLoaded || !devicesView) {
      openDevicesView();
      return;
    }

    openDevicesView();

    resetDeviceFilters();
    applyDeviceFilters();

    const rowButton =
      Array.from(
        devicesView.tbody.querySelectorAll("button[data-device-id]")
      ).find((item) => item.dataset.deviceId === deviceId) ?? null;

    const row = rowButton ? rowButton.closest("tr") : null;
    if (row) row.scrollIntoView({ block: "center" });

    await openDeviceDetail(deviceId, rowButton);
    devicesView.detail.scrollIntoView({ block: "nearest" });
  } finally {
    if (triggerButton) triggerButton.disabled = false;
    deviceDetailOpening = false;
  }
}

async function showOverviewSummary() {
  const note = document.getElementById("data-note");

  setStatText("正在读取");
  ensureDashboardSummary();

  try {
    const overview = await getOverview();
    setStatCounts(overview);
    renderDashboardSummary(overview);

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
    showDashboardError(describeError(error));
    if (note) {
      note.textContent = `${DATA_SOURCE_NOTE}｜读取失败：${describeError(error)}，请刷新页面重试`;
    }
    console.error("练习数据载入失败", error);
  }
}

showOverviewSummary();
