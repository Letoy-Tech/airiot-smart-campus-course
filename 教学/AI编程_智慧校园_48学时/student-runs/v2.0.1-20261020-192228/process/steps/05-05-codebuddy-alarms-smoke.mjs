// 临时冒烟脚本：验证原始报警页的只读表格、搜索、分页与查看设备入口。
const created = [];
const svgNodes = [];

function makeElement(tagName) {
  return {
    tagName,
    className: "",
    hidden: false,
    textContent: "",
    type: "",
    value: "",
    checked: false,
    disabled: false,
    placeholder: "",
    dataset: {},
    options: [],
    children: [],
    listeners: {},
    classList: { add() {}, remove() {}, contains() { return false; } },
    append(...nodes) {
      for (const node of nodes) {
        if (!node) continue;
        this.children.push(node);
        if (node.tagName === "option") this.options.push(node);
      }
    },
    replaceChildren(...nodes) {
      this.children = [];
      this.options = [];
      for (const node of nodes) {
        if (!node) continue;
        this.children.push(node);
        if (node.tagName === "option") this.options.push(node);
      }
    },
    setAttribute(name, value) {
      this[name] = value;
    },
    removeAttribute(name) {
      delete this[name];
    },
    addEventListener(name, handler) {
      (this.listeners[name] = this.listeners[name] || []).push(handler);
    },
    querySelectorAll() {
      return [];
    },
    querySelector() {
      return null;
    },
    closest() {
      return null;
    },
    focus() {},
    scrollIntoView() {},
    isConnected: true,
  };
}

globalThis.document = {
  createElement: (tag) => {
    const element = makeElement(tag);
    created.push(element);
    return element;
  },
  createElementNS: (_ns, tag) => {
    const element = makeElement(tag);
    element.attributes = {};
    svgNodes.push(element);
    return element;
  },
  getElementById: () => makeElement("div"),
  querySelectorAll: () => [],
};

globalThis.window = {
  location: { hash: "#alarms" },
  history: { replaceState: (_a, _b, url) => { globalThis.window.location.hash = url; } },
  addEventListener: () => {},
  localStorage: { getItem: () => null, setItem: () => {} },
};

process.on("unhandledRejection", (error) => {
  console.error("UNHANDLED:", error);
  process.exit(1);
});

const base =
  "file:///Users/learner/My%20Projects/Airiot%E5%A4%A7%E6%B9%BE%E5%8C%BA%E9%AB%98%E6%A0%A1%E4%BA%A7%E4%B8%9A%E8%81%94%E7%9B%9F/%E6%95%99%E5%AD%A6/AI%E7%BC%96%E7%A8%8B_%E6%99%BA%E6%85%A7%E6%A0%A1%E5%9B%AD_48%E5%AD%A6%E6%97%B6/student-runs/v2.0.1-20261020-192228/campus-lab/frontend/";

const mock = await import(base + "mock-data.js");
const extra = Array.from({ length: 10 }, (_, index) => ({
  id: `a${String(index + 2).padStart(2, "0")}`,
  deviceId: ["d01", "d02", "d05", "d09", "d13"][index % 5],
  message: `教学样本：报警提醒-${index + 2}`,
  status: "SAMPLE_ACTIVE",
  level: index % 2 === 0 ? "NOTICE" : "WARNING",
  time: 1792454400000 + index * 60000,
  simulated: true,
}));
mock.mockCampus.alarms.push(...extra);
const snapshot = JSON.stringify(mock.mockCampus.alarms);

await import(base + "app.js");
await new Promise((resolve) => setTimeout(resolve, 120));

const table = created.find((element) => element.className === "data-table alarm-table");
const body = table.children.find((node) => node.tagName === "tbody");
const pageLabel = created.find((element) => element.className === "pager-status");
const summary = created.find((element) => element.className === "table-summary alarm-summary");
const emptyNote = created.find((element) => element.className === "table-empty alarm-empty");
const pagerButtons = created.filter((element) => element.className === "pager-button");
const prevButton = pagerButtons.find((button) => button.textContent === "上一页");
const nextButton = pagerButtons.find((button) => button.textContent === "下一页");
const searchInput = created.find(
  (element) => element.tagName === "input" && element.placeholder.includes("报警编号")
);

function rowText(row) {
  return row.children.map((cell) => cell.textContent + cell.children.map((child) => child.textContent).join("")).join(" | ");
}

console.log("MODULE_EVAL_OK");
console.log("page1 rows:", body.children.length, "label:", pageLabel.textContent, "prev:", prevButton.disabled, "next:", nextButton.disabled);
console.log("summary:", summary.textContent);
console.log("row1:", rowText(body.children[0]));

nextButton.listeners.click.forEach((handler) => handler());
nextButton.listeners.click.forEach((handler) => handler());
console.log("page3 rows:", body.children.length, "label:", pageLabel.textContent, "prev:", prevButton.disabled, "next:", nextButton.disabled);

searchInput.value = "报警提醒-3";
searchInput.listeners.input.forEach((handler) => handler());
console.log("search hit rows:", body.children.length, "label:", pageLabel.textContent, "summary:", summary.textContent);

searchInput.value = "不存在的关键词";
searchInput.listeners.input.forEach((handler) => handler());
console.log(
  "search miss: table hidden", table.hidden,
  "empty", emptyNote.hidden, JSON.stringify(emptyNote.textContent),
  "pager hidden", created.find((element) => element.className === "alarm-pager").hidden
);

searchInput.value = "";
searchInput.listeners.input.forEach((handler) => handler());
console.log("after clear rows:", body.children.length, "label:", pageLabel.textContent);

const forbidden = created
  .filter((element) => element.tagName === "button")
  .map((button) => button.textContent)
  .filter((text) => ["分派", "恢复", "核实", "关闭"].includes(text));
console.log("forbidden buttons:", forbidden.length);

const detailButton = body.children[0].children[7].children[0];
detailButton.listeners.click.forEach((handler) => handler());
await new Promise((resolve) => setTimeout(resolve, 80));
console.log("hash after 查看设备:", window.location.hash);

console.log("alarms unchanged:", JSON.stringify(mock.mockCampus.alarms) === snapshot);
