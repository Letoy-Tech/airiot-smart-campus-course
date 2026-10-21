// 临时脚本：检查共用图表横轴首末刻度是否按 start / end 对齐。
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
  location: { hash: process.env.HASH },
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

await import(base + "app.js");
await new Promise((resolve) => setTimeout(resolve, 80));

// 能源页：勾两台后点比较，取最后一张比较图。
if (process.env.HASH === "#energy") {
  const box = created.find((element) => element.className === "compare-devices");
  const boxes = box.querySelectorAll('input[type="checkbox"]');
  boxes[0].checked = true;
  boxes[0].listeners.change.forEach((handler) => handler());
  boxes[1].checked = true;
  boxes[1].listeners.change.forEach((handler) => handler());
  const button = created.find((element) => element.className === "compare-button");
  button.listeners.click.forEach((handler) => handler());
  await new Promise((resolve) => setTimeout(resolve, 60));
}

const svgs = svgNodes.filter((node) => node.tagName === "svg");
const svg = svgs[svgs.length - 1];
const ticks = svg.children.filter(
  (node) => node.tagName === "text" && node.class === "chart-tick"
);
console.log(
  "svg count:",
  svgs.length,
  "| viewBox:",
  svg.viewBox,
  "| tick anchors:",
  ticks.map((tick) => `${tick["text-anchor"]}@${tick.x}`).join(" "),
  "| labels:",
  ticks.map((tick) => tick.textContent).join(" | ")
);
