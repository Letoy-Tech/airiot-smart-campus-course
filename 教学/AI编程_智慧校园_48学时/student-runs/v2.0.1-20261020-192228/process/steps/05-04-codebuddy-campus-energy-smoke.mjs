// 临时冒烟脚本：用最小 DOM 桩验证能源页“比较历史”区域。
const created = [];
const svgNodes = [];

function makeElement(tagName) {
  return {
    tagName,
    className: "",
    id: "",
    hidden: false,
    textContent: "",
    type: "",
    scope: "",
    value: "",
    checked: false,
    disabled: false,
    rows: 0,
    dataset: {},
    style: {},
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
    appendChild(node) {
      this.children.push(node);
      return node;
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
    querySelectorAll(selector) {
      const results = [];
      const wantInput = selector.includes("input");
      const wantChecked = selector.includes(":checked");
      const walk = (node) => {
        for (const child of node.children) {
          if (wantInput && child.tagName === "input") {
            if (!wantChecked || child.checked) results.push(child);
          }
          walk(child);
        }
      };
      walk(this);
      return results;
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

function makeSvgElement(tagName) {
  const element = makeElement(tagName);
  element.attributes = {};
  svgNodes.push(element);
  return element;
}

function collectText(node) {
  let text = node.textContent || "";
  for (const child of node.children) text += collectText(child);
  return text;
}

globalThis.document = {
  createElement: (tag) => {
    const element = makeElement(tag);
    created.push(element);
    return element;
  },
  createElementNS: (_ns, tag) => makeSvgElement(tag),
  getElementById: () => makeElement("div"),
  querySelectorAll: () => [],
};

globalThis.window = {
  location: { hash: "#energy" },
  history: {
    replaceState: (_a, _b, url) => {
      globalThis.window.location.hash = url;
    },
  },
  addEventListener: () => {},
  localStorage: { getItem: () => null, setItem: () => {} },
};

process.on("unhandledRejection", (error) => {
  console.error("UNHANDLED:", error);
  process.exit(1);
});

const appPath =
  "file:///Users/learner/My%20Projects/Airiot%E5%A4%A7%E6%B9%BE%E5%8C%BA%E9%AB%98%E6%A0%A1%E4%BA%A7%E4%B8%9A%E8%81%94%E7%9B%9F/%E6%95%99%E5%AD%A6/AI%E7%BC%96%E7%A8%8B_%E6%99%BA%E6%85%A7%E6%A0%A1%E5%9B%AD_48%E5%AD%A6%E6%97%B6/student-runs/v2.0.1-20261020-192228/campus-lab/frontend/app.js";
const dataPath =
  "file:///Users/learner/My%20Projects/Airiot%E5%A4%A7%E6%B9%BE%E5%8C%BA%E9%AB%98%E6%A0%A1%E4%BA%A7%E4%B8%9A%E8%81%94%E7%9B%9F/%E6%95%99%E5%AD%A6/AI%E7%BC%96%E7%A8%8B_%E6%99%BA%E6%85%A7%E6%A0%A1%E5%9B%AD_48%E5%AD%A6%E6%97%B6/student-runs/v2.0.1-20261020-192228/campus-lab/frontend/mock-data.js";

await import(appPath);
await new Promise((resolve) => setTimeout(resolve, 80));

const compareBox = created.find((element) => element.className === "compare-devices");
const compareButton = created.find((element) => element.className === "compare-button");
const compareResults = created.find((element) => element.className === "compare-results");
const compareNotice = created.find((element) => element.className === "table-status compare-notice");
const boxes = compareBox.querySelectorAll('input[type="checkbox"]');

console.log("MODULE_EVAL_OK");
console.log("checkbox labels:", compareBox.children.length, "boxes:", boxes.length, "button disabled:", compareButton.disabled);

// 第一轮：比较 d05、d06 的功率历史。
boxes[0].checked = true;
boxes[0].listeners.change.forEach((handler) => handler());
boxes[1].checked = true;
boxes[1].listeners.change.forEach((handler) => handler());
compareButton.listeners.click.forEach((handler) => handler());
await new Promise((resolve) => setTimeout(resolve, 60));

console.log(
  "compare items:", compareResults.children.length,
  "svgs:", svgNodes.filter((node) => node.tagName === "svg").length,
  "notice:", compareNotice.textContent
);
console.log(
  "item deviceIds:", compareResults.children.map((item) => item.dataset.deviceId).join(",")
);

// 第二轮：d07 删掉功率历史，应该只在那台旁边写“没有历史样本”。
const mock = await import(dataPath);
mock.mockCampus.history = mock.mockCampus.history.filter(
  (entry) => !(entry.deviceId === "d07" && entry.tagId === "power")
);

boxes.forEach((box) => {
  box.checked = false;
});
boxes[0].checked = true;
boxes[0].listeners.change.forEach((handler) => handler());
boxes[2].checked = true;
boxes[2].listeners.change.forEach((handler) => handler());
compareButton.listeners.click.forEach((handler) => handler());
await new Promise((resolve) => setTimeout(resolve, 60));

const missingItem = compareResults.children.find((item) => item.dataset.deviceId === "d07");
const okItem = compareResults.children.find((item) => item.dataset.deviceId === "d05");
console.log(
  "d07 text:", collectText(missingItem),
  "| d05 has svg:", collectText(okItem).length === 0 || okItem.children.some((child) => child.className === "compare-chart"),
  "| notice:", compareNotice.textContent
);

// 第三轮：切到电压，勾选与结果都应清空并提示重新选择。
const metricSelect = created.find(
  (element) => element.tagName === "select" && element.options.some((option) => option.textContent === "电压 V")
);
metricSelect.value = "voltage";
metricSelect.listeners.change.forEach((handler) => handler());
await new Promise((resolve) => setTimeout(resolve, 40));

console.log(
  "after metric switch: items", compareResults.children.length,
  "checked", compareBox.querySelectorAll('input[type="checkbox"]:checked').length,
  "notice:", compareNotice.hidden, compareNotice.textContent
);
