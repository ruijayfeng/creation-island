import type { Content } from "../../creation/content.js";
import { comparison, outline } from "./presentation.js";
import { tr } from "./words.js";

export function Cover({ data, en }: { data: Content; en: boolean }) {
  const t = tr(en);
  const excerpt =
    data.kind === "card" ? data.content.sections[0]?.text : data.content.intro;
  const count =
    data.kind === "quiz"
      ? `${data.content.questions.length} ${t("questionsUnit")}`
      : data.kind === "card"
        ? `${t("forRecipient")} ${data.content.recipient}`
        : `${data.content.nodes.filter((n) => n.ending).length} ${t("endingsUnit")}`;
  return (
    <div className={`ci-cover ${data.theme} ci-cover-${data.kind}`}>
      <div className="ci-cover-meta">
        <span>{t(data.kind)}</span>
        <span>{count}</span>
      </div>
      <strong>{data.title || t("title")}</strong>
      <p>{excerpt}</p>
      <div className="ci-cover-decoration" aria-hidden="true">
        {data.kind === "quiz" ? (
          <>
            <i>A</i>
            <i>B</i>
            <i>C</i>
          </>
        ) : data.kind === "card" ? (
          <i>↗</i>
        ) : (
          <>
            <i>01</i>
            <b>↗</b>
            <i>02</i>
            <b>↘</b>
            <i>03</i>
          </>
        )}
      </div>
    </div>
  );
}

export function Outline({
  data,
  en,
  selected,
  onSelect,
}: {
  data: Content;
  en: boolean;
  selected: string;
  onSelect(id: string): void;
}) {
  const t = tr(en),
    items = outline(data, en);
  return (
    <nav className="ci-outline" aria-label={t("outline")}>
      <span className="ci-eyebrow">{t("outline")}</span>
      <button
        aria-current={selected === "all" ? "true" : undefined}
        onClick={() => onSelect("all")}
        className="ci-overview"
      >
        <strong>{t("workSettings")}</strong>
        <small>{t("settingsHint")}</small>
      </button>
      <div className="ci-outline-list">
        {items.map((item, i) => {
          const node =
            data.kind === "story"
              ? data.content.nodes.find((n) => n.id === item.id)
              : undefined;
          return (
            <div key={item.id} className="ci-outline-item">
              <button
                aria-current={selected === item.id ? "true" : undefined}
                onClick={() => onSelect(item.id)}
              >
                <span className="ci-item-number">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.text || t("emptyText")}</small>
                </span>
                {node && (
                  <em>
                    {node.id ===
                    (data.kind === "story" && data.content.startNodeId)
                      ? t("startBadge")
                      : node.ending
                        ? t("endBadge")
                        : ""}
                  </em>
                )}
              </button>
              {node && !node.ending && (
                <div className="ci-route-links">
                  {node.choices.map((choice) => {
                    const dest = items.find(
                      (x) => x.id === choice.targetNodeId,
                    );
                    return (
                      <button
                        key={choice.id}
                        disabled={!dest}
                        onClick={() => dest && onSelect(dest.id)}
                        title={choice.label}
                      >
                        ↳ {choice.label || t("choices")} →{" "}
                        {dest?.label ?? t("missingNode")}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="ci-outline-hint">{t("outlineHint")}</p>
    </nav>
  );
}

export function ChangeReview({
  before,
  after,
  en,
}: {
  before: Content;
  after: Content;
  en: boolean;
}) {
  const t = tr(en),
    rows = comparison(before, after, en);
  return (
    <div className="ci-review-diff">
      <p className="ci-review-summary">
        {rows.length} {t("changedItems")} · {t("unchangedHint")}
      </p>
      {rows.map((row) => (
        <article key={row.key} className="ci-diff-item">
          <h3>{row.label}</h3>
          <div className="ci-diff-pair">
            <div>
              <small>{t("before")}</small>
              <p>{row.before ?? t("notPresent")}</p>
            </div>
            <div>
              <small>{t("after")}</small>
              <p>{row.after ?? t("removedItem")}</p>
            </div>
          </div>
        </article>
      ))}
      {!rows.length && <p>{t("noChanges")}</p>}
    </div>
  );
}
