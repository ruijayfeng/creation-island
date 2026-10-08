import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { Store } from "../packages/agent-isles-web/lib/types/creation/store.js";
import {
  sample,
  complete,
  issues,
} from "../packages/agent-isles-web/lib/types/creation/content.js";
import { render } from "../packages/agent-isles-web/lib/types/creation/player.js";
import { modify } from "../packages/agent-isles-web/lib/types/creation/modifications.js";
import { Generator } from "../packages/agent-isles-web/lib/types/creation/generation.js";
const fixture = (t) => {
  const dir = mkdtempSync(join(tmpdir(), "creation-test-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return new Store(join(dir, "works.json"));
};
const cmd = (s, p) => s.command(randomUUID(), p);
const create = (s, kind = "quiz") => cmd(s, { op: "create", kind });
const edit = (s, w, data) =>
  cmd(s, { op: "edit", id: w.id, expectedRevision: w.revision, data });
const save = (s, w) =>
  cmd(s, { op: "save", id: w.id, expectedRevision: w.revision });
const settle = async (s, j) => {
  for (let i = 0; i < 500; i++) {
    const value = s.state.jobs.find((x) => x.id === j.id);
    if (!["queued", "generating", "validating"].includes(value.status))
      return value;
    await new Promise((r) => setTimeout(r, 2));
  }
  throw Error("task did not settle");
};
const fake = (responses) => {
  let calls = 0;
  return {
    get calls() {
      return calls;
    },
    llm: {
      async *stream(options) {
        assert.deepEqual(options.tools, []);
        assert.ok(options.signal);
        yield {
          type: "text-delta",
          index: 0,
          text: responses[Math.min(calls++, responses.length - 1)],
        };
        yield { type: "finish", reason: { kind: "stop" } };
      },
    },
    agentDefaultModel: {
      currentSelection: () => ({ provider: "test", model: "test" }),
    },
    webServer: { port: 9999 },
  };
};
test("all six localized samples are complete and renderer is self contained", () => {
  for (const kind of ["quiz", "card", "story"])
    for (const en of [false, true]) {
      const d = complete(sample(kind, en));
      const html = render(d, en);
      assert.match(html, /connect-src 'none'/);
      assert.doesNotMatch(html, /src="https?:/);
      assert.equal((html.match(/<script>/g) || []).length, 1);
    }
});
test("story rules reject cycles, unreachable nodes and broken endings", () => {
  let d = sample("story");
  d.content.nodes[1].choices[0].targetNodeId = "start";
  assert.match(issues(d).join(), /cycle/);
  d = sample("story");
  d.content.nodes.push({ id: "orphan", text: "x", ending: true, choices: [] });
  assert.match(issues(d).join(), /unreachable/);
  d = sample("story");
  d.content.nodes[0].choices[0].targetNodeId = "missing";
  assert.match(issues(d).join(), /missing target/);
});
test("quiz answer references and duplicate IDs are checked", () => {
  const d = sample("quiz");
  d.content.questions[0].answerId = "no";
  d.content.questions[1].id = d.content.questions[0].id;
  assert.match(issues(d).join(), /missing answer/);
  assert.match(issues(d).join(), /duplicate/);
});
test("renderer escapes script termination in user text", () => {
  const d = sample("card");
  d.title = "</script><script>alert(1)</script>";
  const html = render(d);
  assert.equal((html.match(/<script>/g) || []).length, 1);
  assert.ok(html.includes("\\u003c/script>"));
});
test("drafts allow incomplete fields but cannot become saved versions", (t) => {
  const s = fixture(t),
    w = create(s);
  w.draft.title = "";
  const changed = edit(s, w, w.draft);
  assert.equal(changed.draft.title, "");
  assert.throws(() => save(s, changed));
  assert.equal(s.state.works[0].versions.length, 0);
});
test("request retry is idempotent and changed request ID payload conflicts", (t) => {
  const s = fixture(t),
    id = randomUUID(),
    p = { op: "create", kind: "card" };
  const a = s.command(id, p);
  assert.deepEqual(s.command(id, p), a);
  assert.equal(s.state.works.length, 1);
  assert.throws(() => s.command(id, { ...p, kind: "quiz" }), /conflict/);
});
test("versions are immutable and stale revisions rejected", (t) => {
  const s = fixture(t);
  let w = save(s, create(s));
  const v = w.versions[0];
  const changed = structuredClone(w.draft);
  changed.title = "Revised";
  w = edit(s, w, changed);
  assert.throws(() => edit(s, { ...w, revision: 0 }, changed), /conflict/);
  w = cmd(s, {
    op: "restore",
    id: w.id,
    expectedRevision: w.revision,
    versionId: v.id,
  });
  assert.equal(w.draft.title, v.data.title);
  assert.equal(w.versions.length, 1);
});
test("state survives restart; unfinished jobs become interrupted", (t) => {
  const s = fixture(t),
    w = create(s);
  const j = cmd(s, {
    op: "generate",
    id: w.id,
    expectedRevision: 0,
    request: "test",
    target: "all",
  });
  const restarted = new Store(s.file);
  assert.equal(
    restarted.state.jobs.find((x) => x.id === j.id).status,
    "interrupted",
  );
  assert.equal(restarted.state.works[0].id, w.id);
});
test("corrupt storage is preserved instead of reset", (t) => {
  const s = fixture(t);
  writeFileSync(s.file, "broken");
  assert.throws(() => new Store(s.file));
  assert.equal(readFileSync(s.file, "utf8"), "broken");
});
test("trash cancels pending work, clears showcase and is recoverable", (t) => {
  const s = fixture(t);
  let w = save(s, create(s));
  const j = cmd(s, {
    op: "generate",
    id: w.id,
    expectedRevision: w.revision,
    request: "test",
  });
  w = cmd(s, { op: "trash", id: w.id, expectedRevision: w.revision });
  assert.equal(s.state.jobs.find((x) => x.id === j.id).status, "cancelled");
  assert.ok(s.state.showcase.every((x) => x === null));
  w = cmd(s, { op: "restoreTrash", id: w.id, expectedRevision: w.revision });
  assert.equal(w.deleted, false);
});
test("imports create new IDs; schema extensions are rejected", (t) => {
  const s = fixture(t),
    pack = {
      format: "creation-island",
      version: 1,
      rendererVersion: 1,
      data: sample("card"),
    };
  const a = cmd(s, { op: "import", pack }),
    b = cmd(s, { op: "import", pack });
  assert.notEqual(a.id, b.id);
  assert.throws(() =>
    cmd(s, {
      op: "import",
      pack: { ...pack, data: { ...pack.data, apiKey: "secret" } },
    }),
  );
});
test("scoped modifications cannot change other fields or IDs", () => {
  const d = sample("quiz"),
    q = { ...d.content.questions[2], prompt: "New question" };
  const next = modify(d, [{ op: "replaceQuestion", id: "q3", value: q }], "q3");
  assert.equal(next.content.questions[0].prompt, d.content.questions[0].prompt);
  assert.equal(next.content.questions[2].prompt, "New question");
  assert.throws(() => modify(d, [{ op: "setTitle", value: "Override" }], "q3"));
  assert.throws(() =>
    modify(
      d,
      [{ op: "replaceQuestion", id: "q3", value: { ...q, id: "q4" } }],
      "q3",
    ),
  );
});
test("Chinese ordinal requests bind to stable question IDs", (t) => {
  const s = fixture(t),
    w = create(s);
  const j = cmd(s, {
    op: "generate",
    id: w.id,
    expectedRevision: 0,
    request: "只改第三题，其他不动",
    target: "all",
  });
  assert.equal(j.target, "q3");
});
test("AI repairs malformed JSON once and does not mutate until adopted", async (t) => {
  const s = fixture(t),
    w = create(s),
    next = sample("quiz");
  next.title = "AI title";
  const ctx = fake([
    "not json",
    JSON.stringify({ type: "create", data: next }),
  ]);
  const g = new Generator(s, ctx),
    j = cmd(s, {
      op: "generate",
      id: w.id,
      expectedRevision: 0,
      request: "new title",
    });
  g.kick();
  const result = await settle(s, j);
  assert.equal(ctx.calls, 2);
  assert.equal(result.status, "ready");
  assert.notEqual(s.state.works[0].draft.title, "AI title");
  cmd(s, { op: "adopt", id: w.id, expectedRevision: 0, jobId: j.id });
  assert.equal(s.state.works[0].draft.title, "AI title");
});
test("bad AI output fails after exactly one repair", async (t) => {
  const s = fixture(t),
    w = create(s),
    ctx = fake(["invalid"]);
  const j = cmd(s, {
    op: "generate",
    id: w.id,
    expectedRevision: 0,
    request: "test",
  });
  new Generator(s, ctx).kick();
  const result = await settle(s, j);
  assert.equal(result.status, "failed");
  assert.equal(ctx.calls, 2);
  assert.equal(s.state.works[0].revision, 0);
});
test("clarification is retained without inventing a work", async (t) => {
  const s = fixture(t),
    w = create(s),
    ctx = fake([
      JSON.stringify({ type: "clarify", question: "Who is this for?" }),
    ]);
  const j = cmd(s, {
    op: "generate",
    id: w.id,
    expectedRevision: 0,
    request: "something",
  });
  new Generator(s, ctx).kick();
  const result = await settle(s, j);
  assert.equal(result.question, "Who is this for?");
  assert.equal(result.candidate, undefined);
  assert.equal(s.state.works[0].revision, 0);
});
test("cancelled late model results never overwrite drafts", async (t) => {
  const s = fixture(t),
    w = create(s);
  let release;
  const gate = new Promise((r) => (release = r));
  const ctx = fake([]);
  ctx.llm.stream = async function* () {
    await gate;
    yield {
      type: "text-delta",
      index: 0,
      text: JSON.stringify({ type: "create", data: sample("quiz") }),
    };
    yield { type: "finish", reason: { kind: "stop" } };
  };
  const g = new Generator(s, ctx),
    j = cmd(s, {
      op: "generate",
      id: w.id,
      expectedRevision: 0,
      request: "test",
    });
  g.kick();
  cmd(s, { op: "cancel", id: w.id, expectedRevision: 0, jobId: j.id });
  g.cancelInactive();
  release();
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(s.state.jobs[0].status, "cancelled");
  assert.equal(s.state.jobs[0].candidate, undefined);
  assert.equal(s.state.works[0].revision, 0);
});

test("storage failure preserves confirmed state and reports failure without crashing generation", async (t) => {
  const s = fixture(t),
    w = create(s);
  const original = structuredClone(s.state);
  const persist = s.change.bind(s);
  s.change = () => {
    throw Error("disk unavailable");
  };
  assert.throws(() => save(s, w));
  assert.deepEqual(s.state, original);
  s.change = persist;
  const j = cmd(s, {
    op: "generate",
    id: w.id,
    expectedRevision: 0,
    request: "test",
  });
  s.change = () => {
    throw Error("disk unavailable");
  };
  new Generator(s, fake([])).kick();
  const result = await settle(s, j);
  assert.equal(result.status, "failed");
  assert.equal(result.error, "storage");
  assert.equal(s.state.works[0].revision, 0);
});
test("adopt and discard have distinct states and retain confirmed versions", async (t) => {
  const s = fixture(t);
  let w = save(s, create(s));
  const g = new Generator(
    s,
    fake([JSON.stringify({ type: "create", data: sample("quiz") })]),
  );
  let j = cmd(s, {
    op: "generate",
    id: w.id,
    expectedRevision: w.revision,
    request: "test",
  });
  g.kick();
  await settle(s, j);
  w = cmd(s, {
    op: "adopt",
    id: w.id,
    expectedRevision: w.revision,
    jobId: j.id,
  });
  assert.equal(s.state.jobs.find((x) => x.id === j.id).status, "adopted");
  j = cmd(s, {
    op: "generate",
    id: w.id,
    expectedRevision: w.revision,
    request: "test",
  });
  g.kick();
  await settle(s, j);
  const before = structuredClone(s.state.works[0]);
  cmd(s, {
    op: "discard",
    id: w.id,
    expectedRevision: w.revision,
    jobId: j.id,
  });
  assert.equal(s.state.jobs.find((x) => x.id === j.id).status, "discarded");
  assert.deepEqual(s.state.works[0], before);
});

test("HTTP boundary rejects cross-origin writes and exports an editable round trip", async (t) => {
  const { createServer } = await import("node:http");
  const { installCreation } = await import(
    "../packages/agent-isles-web/lib/types/creation/routes.js"
  );
  const dir = mkdtempSync(join(tmpdir(), "creation-http-"));
  let handler;
  const server = createServer((req, res) => void handler(req, res));
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  t.after(async () => {
    await new Promise((r) => server.close(r));
    rmSync(dir, { recursive: true, force: true });
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const ctx = {
    ...fake([]),
    effect: (fn) => fn(),
    webServer: {
      port: server.address().port,
      register: (r) => {
        handler = r.handler;
        return () => {};
      },
    },
  };
  installCreation(ctx, dir);
  assert.equal((await fetch(origin)).status, 403);
  assert.equal(
    (
      await fetch(origin, {
        method: "POST",
        headers: {
          origin: "https://example.org",
          "content-type": "application/json",
          "x-creation-island": "1",
        },
        body: "{}",
      })
    ).status,
    403,
  );
  const api = async (p) => {
    const r = await fetch(origin, {
      method: "POST",
      headers: {
        origin,
        "content-type": "application/json",
        "x-creation-island": "1",
      },
      body: JSON.stringify({ requestId: randomUUID(), ...p }),
    });
    assert.equal(r.status, 200);
    return r.json();
  };
  let w = await api({ op: "create", kind: "card" });
  w = await api({ op: "save", id: w.id, expectedRevision: w.revision });
  const pack = await api({
    op: "export",
    id: w.id,
    versionId: w.versions[0].id,
    format: "json",
  });
  assert.match(pack.filename, /\.isle\.json$/);
  const data = JSON.parse(pack.body);
  assert.deepEqual(Object.keys(data).sort(), [
    "data",
    "format",
    "rendererVersion",
    "version",
  ]);
  const copy = await api({ op: "import", pack: data });
  assert.notEqual(copy.id, w.id);
  assert.deepEqual(copy.draft, w.draft);
  const html = await api({
    op: "export",
    id: w.id,
    versionId: w.versions[0].id,
    format: "html",
  });
  assert.match(html.body, /connect-src 'none'/);
  assert.doesNotMatch(
    html.body,
    /creation-library|apiKey|browser-url|\/Users\//,
  );
});
