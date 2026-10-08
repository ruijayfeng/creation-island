import { z } from "zod";
const text = (max: number) => z.string().max(max);
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/);
export const option = z.object({ id, text: text(120) }).strict();
export const question = z
  .object({
    id,
    prompt: text(300),
    options: z.array(option).max(4),
    answerId: text(80),
    explanation: text(600),
  })
  .strict();
export const section = z.object({ id, text: text(1000) }).strict();
export const storyNode = z
  .object({
    id,
    text: text(1500),
    choices: z
      .array(z.object({ id, label: text(120), targetNodeId: id }).strict())
      .max(3),
    ending: z.boolean(),
  })
  .strict();
const base = {
  schemaVersion: z.literal(1),
  title: text(80),
  theme: z.enum(["fresh", "celebration", "night"]),
};
export const contentSchema = z.discriminatedUnion("kind", [
  z
    .object({
      ...base,
      kind: z.literal("quiz"),
      content: z
        .object({
          intro: text(1000),
          questions: z.array(question).max(8),
          ending: text(1000),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...base,
      kind: z.literal("card"),
      content: z
        .object({
          recipient: text(80),
          sections: z.array(section).max(5),
          signature: text(80),
          closing: text(1000),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...base,
      kind: z.literal("story"),
      content: z
        .object({
          intro: text(1000),
          startNodeId: text(80),
          nodes: z.array(storyNode).max(12),
        })
        .strict(),
    })
    .strict(),
]);
export type Content = z.infer<typeof contentSchema>;
export type Kind = Content["kind"];
export function issues(input: unknown): string[] {
  const parsed = contentSchema.safeParse(input);
  if (!parsed.success)
    return parsed.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`);
  const d = parsed.data,
    errors: string[] = [];
  const require = (value: string, path: string) => {
    if (!value.trim()) errors.push(`${path}: required`);
  };
  const unique = (ids: string[], path: string) => {
    if (new Set(ids).size !== ids.length) errors.push(`${path}: duplicate ID`);
  };
  require(d.title, "title");
  if (d.kind === "quiz") {
    if (d.content.questions.length < 3) errors.push("questions: minimum 3");
    unique(
      d.content.questions.map((q) => q.id),
      "questions",
    );
    d.content.questions.forEach((q) => {
      require(q.prompt, q.id);
      require(q.explanation, `${q.id}.explanation`);
      if (q.options.length < 2) errors.push(`${q.id}: minimum 2 options`);
      unique(
        q.options.map((o) => o.id),
        q.id,
      );
      q.options.forEach((o) => require(o.text, `${q.id}.${o.id}`));
      if (!q.options.some((o) => o.id === q.answerId))
        errors.push(`${q.id}: missing answer`);
    });
  } else if (d.kind === "card") {
    require(d.content.recipient, "recipient");
    require(d.content.signature, "signature");
    require(d.content.closing, "closing");
    if (!d.content.sections.length) errors.push("sections: minimum 1");
    unique(
      d.content.sections.map((s) => s.id),
      "sections",
    );
    d.content.sections.forEach((s) => require(s.text, s.id));
  } else {
    const nodes = d.content.nodes,
      map = new Map(nodes.map((n) => [n.id, n]));
    if (nodes.length < 3) errors.push("nodes: minimum 3");
    unique(
      nodes.map((n) => n.id),
      "nodes",
    );
    if (!map.has(d.content.startNodeId)) errors.push("startNodeId: missing");
    if (nodes.filter((n) => n.ending).length < 2)
      errors.push("endings: minimum 2");
    nodes.forEach((n) => {
      require(n.text, n.id);
      unique(
        n.choices.map((c) => c.id),
        n.id,
      );
      if ((n.ending && n.choices.length) || (!n.ending && n.choices.length < 2))
        errors.push(`${n.id}: invalid choices`);
      n.choices.forEach((c) => {
        require(c.label, `${n.id}.${c.id}`);
        if (!map.has(c.targetNodeId)) errors.push(`${n.id}: missing target`);
      });
    });
    const visiting = new Set<string>(),
      visited = new Set<string>();
    function visit(key: string) {
      if (visiting.has(key)) {
        errors.push("story: cycle");
        return;
      }
      if (visited.has(key)) return;
      const n = map.get(key);
      if (!n) return;
      visiting.add(key);
      n.choices.forEach((c) => visit(c.targetNodeId));
      visiting.delete(key);
      visited.add(key);
    }
    visit(d.content.startNodeId);
    if (visited.size !== nodes.length) errors.push("story: unreachable nodes");
  }
  return errors;
}
export function complete(input: unknown): Content {
  const d = contentSchema.parse(input),
    errors = issues(d);
  if (errors.length) throw new Error(errors.join("\n"));
  return d;
}
export function sample(kind: Kind, en = false): Content {
  const title = en
    ? {
        quiz: "Campfire quiz",
        card: "A little birthday surprise",
        story: "The lost star",
      }
    : {
        quiz: "出发吧，露营小队",
        card: "今天的快乐，送给你",
        story: "迷路的星星",
      };
  const base = {
    schemaVersion: 1 as const,
    title: title[kind],
    theme: "fresh" as const,
  };
  if (kind === "quiz")
    return {
      ...base,
      kind,
      content: {
        intro: en
          ? "Five tiny adventures before the campfire."
          : "围坐篝火前，先来一场小小的露营挑战。",
        ending: en
          ? "Ready for your next adventure!"
          : "带上好奇心，下一站见！",
        questions: (en
          ? [
              [
                "What keeps a sleeping bag dry?",
                "A waterproof bag",
                "An open basket",
                "Store it sealed and away from moisture.",
              ],
              [
                "Where should you pitch a tent?",
                "Flat, safe ground",
                "A river channel",
                "Avoid flood paths and check local conditions.",
              ],
              [
                "What belongs in a first-aid kit?",
                "Bandages",
                "Only snacks",
                "Bring suitable supplies and learn how to use them.",
              ],
              [
                "What should you do with your litter?",
                "Take it home",
                "Bury plastic",
                "Leave the campsite clean.",
              ],
              [
                "What helps after sunset?",
                "A headlamp",
                "Sunglasses",
                "Keep hands free and bring spare power.",
              ],
            ]
          : [
              [
                "睡袋怎样收纳更不容易受潮？",
                "放进防水袋",
                "敞开放在篮子里",
                "收纳时保持干燥，并做好防水。",
              ],
              [
                "搭帐篷应优先选择哪里？",
                "平整且安全的地面",
                "河道低洼处",
                "避开可能涨水的区域，并查看当地安全提示。",
              ],
              [
                "急救包里适合放什么？",
                "创可贴和绷带",
                "只有零食",
                "携带适合的急救用品，并学习基本使用方法。",
              ],
              [
                "离开营地时垃圾怎么办？",
                "分类带走",
                "把塑料埋进土里",
                "带走垃圾，保留整洁的自然环境。",
              ],
              [
                "夜间活动哪样装备更方便？",
                "头灯",
                "太阳镜",
                "头灯让双手保持自由，记得准备备用电源。",
              ],
            ]
        ).map((q, i) => ({
          id: `q${i + 1}`,
          prompt: q[0],
          options: [
            { id: "a", text: q[1] },
            { id: "b", text: q[2] },
          ],
          answerId: "a",
          explanation: q[3],
        })),
      },
    };
  if (kind === "card")
    return {
      ...base,
      kind,
      theme: "celebration",
      content: {
        recipient: en ? "Dear friend" : "亲爱的朋友",
        sections: (en
          ? [
              "A small surprise for your day.",
              "Thank you for all the ordinary moments that became special.",
              "May your new year be full of curiosity and gentle courage.",
            ]
          : [
              "今天，想送你一个小小的惊喜。",
              "谢谢你把平凡的日子，变成值得记住的片段。",
              "愿新的一岁，有好奇心，也有慢慢来的勇气。",
            ]
        ).map((text, i) => ({ id: `s${i + 1}`, text })),
        signature: en ? "Your friend" : "你的朋友",
        closing: en ? "Happy birthday!" : "生日快乐，天天开心！",
      },
    };
  return {
    ...base,
    kind,
    theme: "night",
    content: {
      intro: en
        ? "A tiny star has lost its way. Which path will you choose?"
        : "一颗小星星落在了岛上。你愿意陪它找回天空吗？",
      startNodeId: "start",
      nodes: [
        {
          id: "start",
          text: en
            ? "At the shore, a star is flickering beside two paths."
            : "海边，一颗星星轻轻闪烁。前面有两条路。",
          ending: false,
          choices: [
            {
              id: "a",
              label: en ? "Visit the lighthouse" : "去灯塔问问",
              targetNodeId: "light",
            },
            {
              id: "b",
              label: en ? "Follow the forest trail" : "沿森林小径走",
              targetNodeId: "forest",
            },
          ],
        },
        {
          id: "light",
          text: en
            ? "The keeper offers a lantern and a paper boat."
            : "守塔人递来一盏灯和一只纸船。",
          ending: false,
          choices: [
            {
              id: "a",
              label: en ? "Raise the lantern" : "举起灯光",
              targetNodeId: "sky",
            },
            {
              id: "b",
              label: en ? "Sail the boat" : "放走纸船",
              targetNodeId: "sea",
            },
          ],
        },
        {
          id: "forest",
          text: en
            ? "Fireflies offer to guide you to a hill or a stream."
            : "萤火虫邀请你去山顶，也可以顺着小溪前行。",
          ending: false,
          choices: [
            {
              id: "a",
              label: en ? "Climb the hill" : "走上山顶",
              targetNodeId: "sky",
            },
            {
              id: "b",
              label: en ? "Follow the stream" : "顺着小溪",
              targetNodeId: "sea",
            },
          ],
        },
        {
          id: "sky",
          text: en
            ? "The star finds its constellation. A new light will always greet you."
            : "星星找到了自己的星座。从此抬头，总有一盏光向你问好。",
          ending: true,
          choices: [],
        },
        {
          id: "sea",
          text: en
            ? "The star becomes a beacon on the sea. Sometimes home is a new beginning."
            : "星星留在海上，成了指路的光。有时，新的起点也是家。",
          ending: true,
          choices: [],
        },
      ],
    },
  };
}
