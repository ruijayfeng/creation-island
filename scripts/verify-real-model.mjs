import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { issues } from "../packages/agent-isles-web/lib/types/creation/content.js";
const home = resolve(
  homedir(),
  "Library/Application Support/Creation Island/data",
);
const origin = new URL(readFileSync(resolve(home, "browser-url.txt"), "utf8"))
  .origin;
const out = resolve("artifacts/acceptance");
mkdirSync(out, { recursive: true });
async function api(p) {
  const r = await fetch(origin + "/creation/api", {
    method: p ? "POST" : "GET",
    headers: {
      "content-type": "application/json",
      "x-creation-island": "1",
      origin,
    },
    ...(p ? { body: JSON.stringify({ requestId: randomUUID(), ...p }) } : {}),
    signal: AbortSignal.timeout(15000),
  });
  const d = await r.json();
  if (!r.ok) throw Error(d.error);
  return d;
}
const prompts = {
  quiz: "制作一个给朋友玩的植物常识问答，3题，每题2个选项，附简短解释。主题清新。标题是植物小挑战。",
  card: "制作给朋友小雨的生日互动贺卡，3段祝福，署名小风，风格温暖，庆祝主题。标题是给小雨的生日惊喜。",
  story:
    "制作一个小星星寻找家的分支故事，5个节点，至少2个不同结局，夜色主题。情节温暖，每个非结局节点2个选项。标题是星星归途。",
};
const records = [];
const record = (r) => {
  records.push(r);
  writeFileSync(
    resolve(out, "real-model.json"),
    JSON.stringify({ date: "2026-10-08", records }, null, 2),
  );
  console.log(
    JSON.stringify({
      kind: r.kind,
      scenario: r.scenario,
      run: r.run,
      status: r.status,
      seconds: r.seconds,
      error: r.error,
    }),
  );
};
async function generate(w, request, target = "all") {
  const job = await api({
    op: "generate",
    id: w.id,
    expectedRevision: w.revision,
    request,
    target,
  });
  for (let i = 0; i < 140; i++) {
    const s = await api(),
      j = s.jobs.find((j) => j.id === job.id);
    if (!["queued", "generating", "validating"].includes(j.status)) return j;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw Error("job timeout");
}
for (const kind of ["quiz", "card", "story"])
  for (const scenario of ["create", "clarify", "local"])
    for (let run = 1; run <= 2; run++) {
      const started = Date.now();
      let w;
      const jobs = [];
      try {
        w = await api({ op: "create", kind, en: false });
        let result;
        if (scenario === "clarify") {
          const question = await generate(
            w,
            "我还没有想好作品给谁、什么主题，请先向我澄清需求，不要生成作品。",
          );
          jobs.push(question);
          if (!question.question) throw Error("Expected clarification");
          result = await generate(w, prompts[kind]);
          jobs.push(result);
        } else if (scenario === "local") {
          w = await api({
            op: "save",
            id: w.id,
            expectedRevision: w.revision,
            summary: "Acceptance baseline",
          });
          const target =
            kind === "quiz" ? "q3" : kind === "card" ? "s2" : "start";
          result = await generate(
            w,
            kind === "quiz"
              ? "只把第三题改成判断帐篷防雨准备的常识题，其他题和标题不变。"
              : kind === "card"
                ? "只改第二段祝福，表达谢谢你一直陪伴，其余不变。"
                : "只改起始节点的文字，让海边氛围更温暖，保留所有选项与去向。",
            target,
          );
          jobs.push(result);
          if (result.candidate) {
            const a = structuredClone(w.draft),
              b = structuredClone(result.candidate);
            if (kind === "quiz") {
              a.content.questions[2] = b.content.questions[2];
            } else if (kind === "card") {
              a.content.sections[1] = b.content.sections[1];
            } else {
              a.content.nodes[0] = b.content.nodes[0];
            }
            if (!isDeepStrictEqual(a, b)) throw Error("Out-of-scope changes");
          }
        } else {
          result = await generate(w, prompts[kind]);
          jobs.push(result);
        }
        if (result.status !== "ready" || !result.candidate)
          throw Error(result.error ?? "No valid candidate");
        if (issues(result.candidate).length)
          throw Error("Content validation failed");
        w = await api({
          op: "adopt",
          id: w.id,
          expectedRevision: w.revision,
          jobId: result.id,
        });
        w = await api({
          op: "save",
          id: w.id,
          expectedRevision: w.revision,
          summary: `Acceptance ${kind} ${scenario} ${run}`,
        });
        const file = await api({
          op: "export",
          id: w.id,
          versionId: w.versions.at(-1).id,
          format: "html",
          en: false,
        });
        writeFileSync(
          resolve(out, `${kind}-${scenario}-${run}.html`),
          file.body,
        );
        record({
          kind,
          scenario,
          run,
          status: "passed-structure",
          seconds: Math.round((Date.now() - started) / 1000),
          workId: w.id,
          jobs,
          data: w.draft,
        });
      } catch (e) {
        record({
          kind,
          scenario,
          run,
          status: "failed",
          seconds: Math.round((Date.now() - started) / 1000),
          error: e.message,
          workId: w?.id,
          jobs,
        });
        if (!w || ["configuration", "quota", "model"].includes(e.message))
          process.exit(2);
      }
    }
console.log(
  "Completed 18 scenario runs. Semantic review and playback remain separate checks.",
);
