// 临时冒烟脚本：用最小 DOM 桩加载 app.js，检查模块求值不报错，并走一遍历史页渲染。
const created = [];
const svgNodes = [];

function makeElement(tagName) {
  const element = {
    tagName,
    className: "",
    id: "",
    hidden: false,
    textContent: "",
    type: "",
    scope: "",
    value: "",
    disabled: false,
    placeholder: "",
    autocomplete: "",
    rows: 0,
    tabIndex: 0,
    dataset: {},
    style: {},
    options: [],
    rows_: [],
    children: [],
    listeners: {},
    append(...nodes) {
      for (const node of nodes) {
        if (node === null || node === undefined) continue;
        this.children.push(node);
        if (node.tagName === "option") this.options.push(node);
      }
    },
    appendChild(node) {
      this.children.push(node);
      return node;
    },
    replaceChildren(...nodes) {
      this.children = [];
      this.options = [];
      for (const node of nodes) {
        if (node === null || node === undefined) continue;
        this.children.push(node);
        if (node.tagName === "option") this.options.push(node);
      }
    },
    setAttribute(name, value) {
      this[name] = value;
      this.attributes = this.attributes || {};
      this.attributes[name] = value;
    },
    removeAttribute(name) {
      delete this[name];
      if (this.attributes) delete this.attributes[name];
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
    classList: { add() {}, remove() {}, contains() { return false; } },
    focus() {},
    scrollIntoView() {},
    isConnected: true,
  };
  created.push(element);
  return element;
}

function makeSvgElement(tagName) {
  const element = makeElement(tagName);
  element.attributes = {};
  svgNodes.push(element);
  return element;
}

globalThis.document = {
  createElement: (tag) => makeElement(tag),
  createElementNS: (_ns, tag) => makeSvgElement(tag),
  getElementById: () => makeElement("div"),
  querySelectorAll: () => [],
};

globalThis.window = {
  location: { hash: "#history?deviceId=d05&tagId=power" },
  history: {
    replaceState: (_a, _b, url) => {
      console.log("REPLACE_STATE", url);
      globalThis.window.location.hash = url;
    },
  },
  addEventListener: () => {},
  localStorage: {
    getItem: () => null,
    setItem: () => {},
  },
};

globalThis.URLSearchParams = URLSearchParams;

process.on("unhandledRejection", (error) => {
  console.error("UNHANDLED:", error);
  process.exit(1);
});

await import(
  "file:///Users/learner/My%20Projects/Airiot%E5%A4%A7%E6%B9%BE%E5%8C%BA%E9%AB%98%E6%A0%A1%E4%BA%A7%E4%B8%9A%E8%81%94%E7%9B%9F/%E6%95%99%E5%AD%A6/AI%E7%BC%96%E7%A8%8B_%E6%99%BA%E6%85%A7%E6%A0%A1%E5%9B%AD_48%E5%AD%A6%E6%97%B6/student-runs/v2.0.1-20261020-192228/campus-lab/frontend/app.js"
);

await new Promise((resolve) => setTimeout(resolve, 60));

const svgs = svgNodes.filter((node) => node.tagName === "svg");
const circles = svgNodes.filter((node) => node.tagName === "circle");
const texts = svgNodes.filter((node) => node.tagName === "text");
const polylines = svgNodes.filter((node) => node.tagName === "polyline");

console.log("MODULE_EVAL_OK");
console.log("svg count:", svgs.length, "points:", circles.length, "polylines:", polylines.length, "texts:", texts.length);
console.log("last hash:", window.location.hash);

// 模拟在同一台设备上把点位从 power 改选 voltage，确认图和表被整体替换。
const pointSelect = created.find(
  (element) =>
    element.tagName === "select" &&
    element.options.some((option) => option.textContent === "请选择点位")
);
console.log("selects:", created.filter((e) => e.tagName === "select").map((e) => [e.options.map((o) => o.value).join(","), Object.keys(e.listeners)]));
pointSelect.value = "voltage";
console.log("handlers:", pointSelect.listeners.change.length, "value:", pointSelect.value);
console.log("handler source:", String(pointSelect.listeners.change[0]).slice(0, 200));
try {
  pointSelect.listeners.change.forEach((handler) => handler());
} catch (error) {
  console.log("HANDLER ERROR", error);
}
console.log("hash right after handler:", window.location.hash, "svg now:", svgNodes.filter((n) => n.tagName === "svg").length);
await new Promise((resolve) => setTimeout(resolve, 40));

const svgsAfter = svgNodes.filter((node) => node.tagName === "svg");
const lastSvg = svgsAfter[svgsAfter.length - 1];
const lastCircles = lastSvg.children.filter((node) => node.tagName === "circle");
const lastLines = lastSvg.children.filter((node) => node.tagName === "polyline");
console.log("after switch: svg total", svgsAfter.length, "circles in last svg", lastCircles.length, "lines", lastLines.length);
console.log("hash after switch:", window.location.hash);

// 再模拟换设备：图与表必须先清空，再按新点位重建。
const deviceSelect = created.find(
  (element) =>
    element.tagName === "select" &&
    element.options.some((option) => option.textContent === "请选择设备")
);
const chartBox = created.find((element) => element.className === "history-chart");
deviceSelect.value = "d01";
deviceSelect.listeners.change.forEach((handler) => handler());
await new Promise((resolve) => setTimeout(resolve, 20));
console.log("after device switch: hash", window.location.hash, "chart children", chartBox.children.length);

pointSelect.value = "temperature";
pointSelect.listeners.change.forEach((handler) => handler());
await new Promise((resolve) => setTimeout(resolve, 20));
const svgsFinal = svgNodes.filter((node) => node.tagName === "svg");
const finalSvg = svgsFinal[svgsFinal.length - 1];
const rangeSelect = created.find(
  (element) =>
    element.tagName === "select" &&
    element.options.some((option) => option.textContent === "样本末时刻前15分钟")
);
rangeSelect.value = "15m";
rangeSelect.listeners.change.forEach((handler) => handler());
await new Promise((resolve) => setTimeout(resolve, 20));
const historyTable = created.find((element) => element.className === "data-table history-table");
const historyBody = historyTable.children.find((node) => node.tagName === "tbody");
const svgsRange = svgNodes.filter((node) => node.tagName === "svg");
const rangeSvg = svgsRange[svgsRange.length - 1];
console.log(
  "after 15m: chart children", chartBox.children.length,
  "rows", historyBody.children.length,
  "circles", rangeSvg.children.filter((node) => node.tagName === "circle").length,
  "lines", rangeSvg.children.filter((node) => node.tagName === "polyline").length
);

console.log(
  "after new point: hash", window.location.hash,
  "chart children", chartBox.children.length,
  "circles", finalSvg.children.filter((node) => node.tagName === "circle").length,
  "lines", finalSvg.children.filter((node) => node.tagName === "polyline").length
);
