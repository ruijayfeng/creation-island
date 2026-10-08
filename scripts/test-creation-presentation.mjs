import test from "node:test";
import assert from "node:assert/strict";
import { sample } from "../packages/agent-isles-web/lib/types/creation/content.js";
import { comparison } from "../packages/agent-isles-web/lib/types/client/creation/presentation.js";

test("review exposes an answer-only edit and omits unchanged questions", () => {
  const before = sample("quiz", false),
    after = structuredClone(before);
  after.content.questions[2].answerId =
    after.content.questions[2].options[1].id;
  const rows = comparison(before, after, false);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].label, "题目 3");
  assert.notEqual(rows[0].before, rows[0].after);
  assert.ok(
    rows[0].after.includes(
      after.content.questions[2].options[1].text + " · 正确答案",
    ),
  );
});

test("review matches stable sections across moves and deletion", () => {
  const before = sample("card", false),
    after = structuredClone(before);
  after.content.sections = [
    after.content.sections[2],
    after.content.sections[0],
  ];
  const rows = comparison(before, after, false);
  const moved = rows.find(
    (row) => row.key === `s:${before.content.sections[2].id}`,
  );
  assert.ok(moved.before.startsWith("段落 3\n"));
  assert.ok(moved.after.startsWith("段落 1\n"));
  assert.ok(moved.after.includes(before.content.sections[2].text));
  const removed = rows.find(
    (row) => row.key === `s:${before.content.sections[1].id}`,
  );
  assert.equal(removed.after, undefined);
});

test("review exposes story route-only edits and distinguishes destinations", () => {
  const before = sample("story", true),
    after = structuredClone(before);
  const branch = after.content.nodes.find((node) => node.choices.length >= 2);
  branch.choices[0].targetNodeId = branch.choices[1].targetNodeId;
  const rows = comparison(before, after, true);
  assert.equal(rows.length, 1);
  assert.notEqual(rows[0].before, rows[0].after);
  assert.ok(rows[0].after.includes("→ Node "));
});
