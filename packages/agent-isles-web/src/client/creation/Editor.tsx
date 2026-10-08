import type { Content } from "../../creation/content.js";
import { tr } from "./words.js";
export function Editor({
  data,
  onChange,
  en,
  selected = "all",
}: {
  data: Content;
  onChange(d: Content): void;
  en: boolean;
  selected?: string;
}) {
  const t = tr(en);
  const change = (f: (d: Content) => void) => {
    const next = structuredClone(data);
    f(next);
    onChange(next);
  };
  const field = (
    label: string,
    value: string,
    max: number,
    set: (s: string) => void,
  ) => (
    <label className="ci-field">
      {label}
      <textarea
        rows={value.length > 90 ? 4 : 2}
        value={value}
        maxLength={max}
        onChange={(e) => set(e.target.value)}
      />
      <small>
        {value.length}/{max}
      </small>
    </label>
  );
  return (
    <div className="ci-editor">
      {selected === "all" && <>
      {field(t("title"), data.title, 80, (value) =>
        change((d) => {
          d.title = value;
        }),
      )}
      <label className="ci-field">
        {t("theme")}
        <select
          value={data.theme}
          onChange={(e) =>
            change((d) => {
              d.theme = e.target.value as Content["theme"];
            })
          }
        >
          {(["fresh", "celebration", "night"] as const).map((x) => (
            <option key={x} value={x}>
              {t(x)}
            </option>
          ))}
        </select>
      </label>
      {data.kind !== "card" &&
        field(t("intro"), data.content.intro, 1000, (value) =>
          change((d) => {
            if (d.kind !== "card") d.content.intro = value;
          }),
        )}
      </>}
      {data.kind === "quiz" && (
        <>
          {data.content.questions.map((q, i) => (
            <fieldset key={q.id} hidden={selected !== q.id}>
              <legend>
                {t("prompt")} {i + 1}
              </legend>
              {field(t("prompt"), q.prompt, 300, (value) =>
                change((d) => {
                  if (d.kind === "quiz") d.content.questions[i].prompt = value;
                }),
              )}
              {q.options.map((o, j) => (
                <div key={o.id}>
                  {field(`${t("choices")} ${j + 1}`, o.text, 120, (value) =>
                    change((d) => {
                      if (d.kind === "quiz")
                        d.content.questions[i].options[j].text = value;
                    }),
                  )}
                  <button
                    onClick={() =>
                      change((d) => {
                        if (d.kind === "quiz")
                          d.content.questions[i].options.splice(j, 1);
                      })
                    }
                    disabled={q.options.length <= 2}
                  >
                    {t("remove")}
                  </button>
                </div>
              ))}
              <button
                disabled={q.options.length >= 4}
                onClick={() =>
                  change((d) => {
                    if (d.kind === "quiz")
                      d.content.questions[i].options.push({
                        id: crypto.randomUUID(),
                        text: "",
                      });
                  })
                }
              >
                + {t("choices")}
              </button>
              <label className="ci-field">
                {t("answer")}
                <select
                  value={q.answerId}
                  onChange={(e) =>
                    change((d) => {
                      if (d.kind === "quiz")
                        d.content.questions[i].answerId = e.target.value;
                    })
                  }
                >
                  <option value="">—</option>
                  {q.options.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.text || o.id}
                    </option>
                  ))}
                </select>
              </label>
              {field(t("explanation"), q.explanation, 600, (value) =>
                change((d) => {
                  if (d.kind === "quiz")
                    d.content.questions[i].explanation = value;
                }),
              )}
              <div className="ci-row">
                <button
                  disabled={i === 0}
                  onClick={() =>
                    change((d) => {
                      if (d.kind === "quiz")
                        [d.content.questions[i - 1], d.content.questions[i]] = [
                          d.content.questions[i],
                          d.content.questions[i - 1],
                        ];
                    })
                  }
                >
                  {t("up")}
                </button>
                <button
                  disabled={i === data.content.questions.length - 1}
                  onClick={() =>
                    change((d) => {
                      if (d.kind === "quiz")
                        [d.content.questions[i + 1], d.content.questions[i]] = [
                          d.content.questions[i],
                          d.content.questions[i + 1],
                        ];
                    })
                  }
                >
                  {t("down")}
                </button>
                <button
                  onClick={() =>
                    change((d) => {
                      if (d.kind === "quiz") d.content.questions.splice(i, 1);
                    })
                  }
                >
                  {t("remove")}
                </button>
              </div>
            </fieldset>
          ))}
          {selected === "all" && <button
            disabled={data.content.questions.length >= 8}
            onClick={() =>
              change((d) => {
                if (d.kind === "quiz")
                  d.content.questions.push({
                    id: crypto.randomUUID(),
                    prompt: "",
                    options: [
                      { id: "a", text: "" },
                      { id: "b", text: "" },
                    ],
                    answerId: "a",
                    explanation: "",
                  });
              })
            }
          >
            + {t("prompt")}
          </button>}
          {selected === "all" && field(t("ending"), data.content.ending, 1000, (value) =>
            change((d) => {
              if (d.kind === "quiz") d.content.ending = value;
            }),
          )}
        </>
      )}
      {data.kind === "card" && (
        <>
          {selected === "all" && field(t("recipient"), data.content.recipient, 80, (value) =>
            change((d) => {
              if (d.kind === "card") d.content.recipient = value;
            }),
          )}
          {data.content.sections.map((s, i) => (
            <fieldset key={s.id} hidden={selected !== s.id}>
              <legend>{i + 1}</legend>
              {field(t("text"), s.text, 1000, (value) =>
                change((d) => {
                  if (d.kind === "card") d.content.sections[i].text = value;
                }),
              )}
              <div className="ci-row">
                <button
                  disabled={i === 0}
                  onClick={() =>
                    change((d) => {
                      if (d.kind === "card")
                        [d.content.sections[i - 1], d.content.sections[i]] = [
                          d.content.sections[i],
                          d.content.sections[i - 1],
                        ];
                    })
                  }
                >
                  {t("up")}
                </button>
                <button
                  disabled={i === data.content.sections.length - 1}
                  onClick={() =>
                    change((d) => {
                      if (d.kind === "card")
                        [d.content.sections[i + 1], d.content.sections[i]] = [
                          d.content.sections[i],
                          d.content.sections[i + 1],
                        ];
                    })
                  }
                >
                  {t("down")}
                </button>
                <button
                  onClick={() =>
                    change((d) => {
                      if (d.kind === "card") d.content.sections.splice(i, 1);
                    })
                  }
                >
                  {t("remove")}
                </button>
              </div>
            </fieldset>
          ))}
          {selected === "all" && <button
            disabled={data.content.sections.length >= 5}
            onClick={() =>
              change((d) => {
                if (d.kind === "card")
                  d.content.sections.push({
                    id: crypto.randomUUID(),
                    text: "",
                  });
              })
            }
          >
            + {t("text")}
          </button>}
          {selected === "all" && field(t("signature"), data.content.signature, 80, (value) =>
            change((d) => {
              if (d.kind === "card") d.content.signature = value;
            }),
          )}
          {selected === "all" && field(t("ending"), data.content.closing, 1000, (value) =>
            change((d) => {
              if (d.kind === "card") d.content.closing = value;
            }),
          )}
        </>
      )}
      {data.kind === "story" && (
        <>
          {selected === "all" && <label className="ci-field">
            {t("startNode")}
            <select
              value={data.content.startNodeId}
              onChange={(e) =>
                change((d) => {
                  if (d.kind === "story")
                    d.content.startNodeId = e.target.value;
                })
              }
            >
              {data.content.nodes.map((n, index) => (
                <option value={n.id} key={n.id}>
                  {index + 1} · {n.text.slice(0, 18)}
                </option>
              ))}
            </select>
          </label>}
          {data.content.nodes.map((n, i) => (
            <fieldset key={n.id} hidden={selected !== n.id}>
              <legend>
                {t("nodes")} {i + 1}
              </legend>
              {field(t("text"), n.text, 1500, (value) =>
                change((d) => {
                  if (d.kind === "story") d.content.nodes[i].text = value;
                }),
              )}
              <label>
                <input
                  type="checkbox"
                  checked={n.ending}
                  onChange={(e) =>
                    change((d) => {
                      if (d.kind === "story") {
                        d.content.nodes[i].ending = e.target.checked;
                        d.content.nodes[i].choices = e.target.checked
                          ? []
                          : [
                              {
                                id: "a",
                                label: "",
                                targetNodeId: d.content.nodes[0].id,
                              },
                              {
                                id: "b",
                                label: "",
                                targetNodeId: d.content.nodes[0].id,
                              },
                            ];
                      }
                    })
                  }
                />
                {t("isEnding")}
              </label>
              {n.choices.map((c, j) => (
                <div key={c.id}>
                  {field(`${t("choices")} ${j + 1}`, c.label, 120, (value) =>
                    change((d) => {
                      if (d.kind === "story")
                        d.content.nodes[i].choices[j].label = value;
                    }),
                  )}
                  <label className="ci-field">
                    {t("target")}
                    <select
                      value={c.targetNodeId}
                      onChange={(e) =>
                        change((d) => {
                          if (d.kind === "story")
                            d.content.nodes[i].choices[j].targetNodeId =
                              e.target.value;
                        })
                      }
                    >
                      {data.content.nodes.map((node, index) => (
                        <option key={node.id} value={node.id}>
                          {index + 1} · {node.text.slice(0, 18)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    disabled={n.choices.length <= 2}
                    onClick={() =>
                      change((d) => {
                        if (d.kind === "story")
                          d.content.nodes[i].choices.splice(j, 1);
                      })
                    }
                  >
                    {t("remove")}
                  </button>
                </div>
              ))}
              {!n.ending && (
                <button
                  disabled={n.choices.length >= 3}
                  onClick={() =>
                    change((d) => {
                      if (d.kind === "story")
                        d.content.nodes[i].choices.push({
                          id: crypto.randomUUID(),
                          label: "",
                          targetNodeId: d.content.nodes[0].id,
                        });
                    })
                  }
                >
                  + {t("choices")}
                </button>
              )}
              <button
                onClick={() =>
                  change((d) => {
                    if (d.kind === "story") d.content.nodes.splice(i, 1);
                  })
                }
              >
                {t("remove")}
              </button>
            </fieldset>
          ))}
          {selected === "all" && <button
            disabled={data.content.nodes.length >= 12}
            onClick={() =>
              change((d) => {
                if (d.kind === "story")
                  d.content.nodes.push({
                    id: `node_${crypto.randomUUID().slice(0, 8)}`,
                    text: "",
                    choices: [],
                    ending: true,
                  });
              })
            }
          >
            + {t("nodes")}
          </button>}
        </>
      )}
    </div>
  );
}
