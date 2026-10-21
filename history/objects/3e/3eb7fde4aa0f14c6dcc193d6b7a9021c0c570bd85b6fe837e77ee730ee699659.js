// 校园值班台 · 菜单切换 + 概览/设备/空间/设备责任数据（第03课第5步）
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

const menuItems = Array.from(document.querySelectorAll(".menu-item"));
const outlet = document.getElementById("view-outlet");
const sections = new Map();

let devicesView = null;
let devicesLoaded = false;
let devicesLoading = false;
let spacesView = null;
let spacesLoaded = false;
let spacesLoading = false;
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

  detail.append(
    detailHead,
    detailNotice,
    facts,
    detailActions,
    pointsHeading,
    pointsWrap,
    pointsEmpty
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
    errorBox,
    errorText,
    retryButton,
  };

  closeButton.addEventListener("click", () => {
    detail.hidden = true;
    detailRequestId += 1;
    activeDetailDeviceId = null;
    activeDetailSpaceId = null;
    if (activeDetailButton) {
      activeDetailButton.setAttribute("aria-expanded", "false");
      activeDetailButton = null;
    }
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

// 除概览、设备、空间、设备责任外，其余页面只显示标题和占位说明；文本一律用 textContent 写入。
for (const view of VIEWS) {
  if (view.id === DEFAULT_VIEW || !outlet) continue;

  let section;

  if (view.id === "devices") {
    section = createDevicesSection();
  } else if (view.id === "spaces") {
    section = createSpacesSection();
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
  return String(value);
}

function formatSampleTime(time) {
  if (time === null || time === undefined) return "无采样时间";
  const date = new Date(time);
  if (Number.isNaN(date.getTime())) return "无采样时间";
  return date.toLocaleString("zh-CN", { hour12: false });
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

// 进入现有设备页：清空搜索、类型、在线情况，只保留本次点击的空间筛选。
async function openDevicesForSpace(spaceId) {
  if (!devicesView) return;

  if (!devicesLoaded && !devicesLoading) {
    await loadDevices();
  }

  devicesView.searchInput.value = "";
  devicesView.categorySelect.value = "";
  devicesView.onlineSelect.value = "";

  const hasSpace = Array.from(devicesView.spaceSelect.options).some(
    (option) => option.value === spaceId
  );
  devicesView.spaceSelect.value = hasSpace ? spaceId : "";

  if (devicesLoaded) {
    applyDeviceFilters();
  }

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
