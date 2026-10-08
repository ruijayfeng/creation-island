import type { Content } from "./content.js";
/** This function is serialized into the standalone file. Keep every dependency local. */
function play(data: Content, en: boolean) {
  const root = document.getElementById("play")!,
    title = document.getElementById("title")!;
  title.textContent = data.title;
  let score = 0,
    index = 0;
  const label = (zh: string, english: string) => (en ? english : zh);
  const add = (tag: string, text: string) => {
    const el = document.createElement(tag);
    el.textContent = text;
    root.append(el);
    return el;
  };
  const button = (text: string, action: () => void) => {
    const b = add("button", text) as HTMLButtonElement;
    b.onclick = action;
    return b;
  };
  const clear = () => {
    root.replaceChildren();
  };
  function finish(text: string) {
    clear();
    add("span", label("作品完成", "COMPLETE")).className = "eyebrow";
    add("h2", text);
    button(label("再玩一次", "Play again"), start);
  }
  function quiz() {
    if (data.kind !== "quiz") return;
    if (index >= data.content.questions.length) {
      finish(
        `${label("得分", "Score")} ${Math.round((score / data.content.questions.length) * 100)} · ${data.content.ending}`,
      );
      return;
    }
    clear();
    const q = data.content.questions[index];
    add("small", `${index + 1} / ${data.content.questions.length}`);
    add("h2", q.prompt);
    const buttons: HTMLButtonElement[] = [];
    q.options.forEach((o) =>
      buttons.push(
        button(o.text, () => {
          buttons.forEach((b) => (b.disabled = true));
          if (o.id === q.answerId) score++;
          add(
            "p",
            o.id === q.answerId
              ? label("答对了！", "Correct!")
              : label("再了解一点吧", "Let’s learn more"),
          );
          add("p", q.explanation);
          button(label("继续", "Continue"), () => {
            index++;
            quiz();
          }).focus();
        }),
      ),
    );
  }
  function card() {
    if (data.kind !== "card") return;
    clear();
    add("small", data.content.recipient);
    add("h2", data.content.sections[index].text);
    if (index < data.content.sections.length - 1)
      button(label("下一份心意", "Next message"), () => {
        index++;
        card();
      });
    else {
      add("p", data.content.closing);
      add("p", `— ${data.content.signature}`);
      add("div", "✦ · ✧ · ✦").className = "sparkles";
      button(label("再次打开", "Open again"), start);
    }
  }
  function story(id: string) {
    if (data.kind !== "story") return;
    const n = data.content.nodes.find((n) => n.id === id);
    if (!n) return;
    clear();
    add(
      "small",
      n.ending
        ? label("一个结局", "AN ENDING")
        : label("你的选择", "YOUR CHOICE"),
    );
    add("h2", n.text);
    if (n.ending) button(label("试试另一条路", "Try another path"), start);
    else n.choices.forEach((c) => button(c.label, () => story(c.targetNodeId)));
  }
  function start() {
    clear();
    score = 0;
    index = 0;
    add(
      "p",
      data.kind === "card" ? data.content.recipient : data.content.intro,
    );
    button(
      data.kind === "card"
        ? label("打开这份心意", "Open your surprise")
        : label("开始", "Let’s begin"),
      () => {
        if (data.kind === "quiz") quiz();
        else if (data.kind === "card") card();
        else story(data.content.startNodeId);
      },
    );
  }
  const motion = document.getElementById("motion") as HTMLInputElement;
  motion.checked = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  motion.onchange = () =>
    document.body.classList.toggle("reduced", motion.checked);
  motion.onchange(new Event("change"));
  start();
}
export function render(content: Content, en = false): string {
  const data = JSON.stringify(content)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
  return `<!doctype html><html lang="${en ? "en" : "zh-CN"}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'"><title>Creation Island</title><style>
*{box-sizing:border-box}body{margin:0;background:#eef5ef;color:#23483f;font:17px/1.65 system-ui,-apple-system,sans-serif;min-height:100vh;display:grid;place-items:center;padding:24px}body.celebration{background:#fff1e3;color:#773f3c}body.night{background:#172c3a;color:#e9f2ea}main{width:min(100%,640px);padding:clamp(24px,5vw,48px);border:1px solid #829b8b55;border-radius:28px;background:#ffffff14;box-shadow:0 20px 80px #142c3310}h1{font-size:clamp(26px,5vw,38px);line-height:1.25}h2{font-size:24px;white-space:pre-wrap}p{white-space:pre-wrap;overflow-wrap:anywhere}button{display:block;width:100%;font:inherit;border:1px solid #829b8b77;border-radius:14px;padding:14px 18px;text-align:left;background:#ffffffc9;color:#23483f;margin:12px 0;cursor:pointer}button:disabled{opacity:.55;cursor:default}button:hover:not(:disabled){background:white}button:focus-visible,input:focus-visible{outline:3px solid #e99541;outline-offset:3px}small,.eyebrow{letter-spacing:2px;font-size:12px}footer{margin-top:30px;font-size:12px;opacity:.8}.sparkles{font-size:40px;animation:pop 700ms ease-out}.reduced *{animation:none!important}@media(prefers-reduced-motion:reduce){*{animation:none!important}}@keyframes pop{from{transform:scale(.5);opacity:0}to{transform:scale(1);opacity:1}}
</style><body class="${content.theme}"><main><small>CREATION ISLAND · ${en ? "MADE FOR YOU" : "为你而作"}</small><h1 id="title"></h1><div id="play" aria-live="polite"></div><footer><label><input type="checkbox" id="motion"> ${en ? "Reduce motion" : "关闭动效"}</label> · Creation Island</footer></main><script>(${play.toString()})(${data},${en})</script></body></html>`;
}
