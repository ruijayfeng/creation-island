import type { Content } from "../../creation/content.js";
import { tr } from "./words.js";

export function outline(data: Content, en: boolean) {
  const t = tr(en);
  if (data.kind === "quiz")
    return data.content.questions.map((q, i) => ({
      id: q.id,
      label: `${t("prompt")} ${i + 1}`,
      text: q.prompt,
    }));
  if (data.kind === "card")
    return data.content.sections.map((s, i) => ({
      id: s.id,
      label: `${t("section")} ${i + 1}`,
      text: s.text,
    }));
  return data.content.nodes.map((n, i) => ({
    id: n.id,
    label: `${t("node")} ${i + 1}`,
    text: n.text,
  }));
}

export type Comparison = {
  key: string;
  label: string;
  before?: string;
  after?: string;
};
// Stable item IDs keep insertions and reordering from looking like unrelated text edits.
export function comparison(
  before: Content,
  after: Content,
  en: boolean,
): Comparison[] {
  const t = tr(en);
  const describe = (d: Content) => {
    const rows = new Map<string, { label: string; text: string }>();
    const put = (key: string, label: string, text: string) =>
      rows.set(key, { label, text });
    put("title", t("title"), d.title);
    put("theme", t("theme"), t(d.theme));
    if (d.kind !== "card") put("intro", t("intro"), d.content.intro);
    if (d.kind === "quiz") {
      put("ending", t("ending"), d.content.ending);
      d.content.questions.forEach((q, i) =>
        put(
          `q:${q.id}`,
          `${t("prompt")} ${i + 1}`,
          [
            q.prompt,
            ...q.options.map(
              (o, j) =>
                `${j + 1}. ${o.text}${o.id === q.answerId ? ` · ${t("answer")}` : ""}`,
            ),
            `${t("explanation")}：${q.explanation}`,
          ].join("\n"),
        ),
      );
    } else if (d.kind === "card") {
      put("recipient", t("recipient"), d.content.recipient);
      put("signature", t("signature"), d.content.signature);
      put("closing", t("ending"), d.content.closing);
      d.content.sections.forEach((s, i) =>
        put(`s:${s.id}`, `${t("section")} ${i + 1}`, s.text),
      );
    } else {
      const label = (id: string) => {
        const index = d.content.nodes.findIndex((n) => n.id === id);
        return index < 0 ? t("missingNode") : `${t("node")} ${index + 1}`;
      };
      put("start", t("startNode"), label(d.content.startNodeId));
      d.content.nodes.forEach((n, i) =>
        put(
          `n:${n.id}`,
          `${t("node")} ${i + 1}`,
          [
            n.text,
            n.ending
              ? t("isEnding")
              : n.choices
                  .map((c) => `${c.label} → ${label(c.targetNodeId)}`)
                  .join("\n"),
          ].join("\n"),
        ),
      );
    }
    return rows;
  };
  const old = describe(before),
    next = describe(after);
  return [...new Set([...old.keys(), ...next.keys()])].flatMap((key) => {
    const a = old.get(key),
      b = next.get(key);
    return a?.text === b?.text && a?.label === b?.label
      ? []
      : [
          {
            key,
            label: b?.label ?? a!.label,
            before: a ? `${a.label}\n${a.text}` : undefined,
            after: b ? `${b.label}\n${b.text}` : undefined,
          },
        ];
  });
}
