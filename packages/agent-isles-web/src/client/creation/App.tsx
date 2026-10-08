import { useState, useEffect, useRef, useSyncExternalStore } from "react";
import type { AgentIslesWorldInjected } from "../AgentIslesWorld.js";
import { ModelSettings } from "../ModelSettings.js";
import type { AgentIslesTranslate } from "../locales.js";
import { isWorldToHostMessage } from "../world-bridge.js";
import {
  sample,
  issues,
  type Content,
  type Kind,
} from "../../creation/content.js";
import type { State, Work, Version } from "../../creation/store.js";
import { render } from "../../creation/player.js";
import { changes } from "../../creation/modifications.js";
import { Cover, Outline, ChangeReview } from "./WorkVisuals.js";
import { outline } from "./presentation.js";
import { Editor } from "./Editor.js";
import { tr, errorText, changeText } from "./words.js";
import { styles } from "./styles.js";
const kinds: Kind[] = ["quiz", "card", "story"];
async function api<T>(payload?: Record<string, unknown>): Promise<T> {
  const response = await fetch("/creation/api", {
    method: payload ? "POST" : "GET",
    headers: { "content-type": "application/json", "x-creation-island": "1" },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
    signal: AbortSignal.timeout(15000),
  });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error ?? "network");
  return value as T;
}
const command = <T,>(p: Record<string, unknown>) =>
  api<T>({ requestId: crypto.randomUUID(), ...p });
export function CreationApp(
  props: AgentIslesWorldInjected & { t: AgentIslesTranslate },
) {
  const locale = useSyncExternalStore(
    props.localeState.subscribe.bind(props.localeState),
    props.localeState.getSnapshot.bind(props.localeState),
  ).active;
  const en = !locale.startsWith("zh"),
    t = tr(en);
  const [page, setPage] = useState<
      "home" | "inspiration" | "library" | "studio"
    >("home"),
    [state, setState] = useState<State>({
      works: [],
      jobs: [],
      showcase: Array(6).fill(null),
      showcaseRevision: 0,
      requests: {},
    });
  const [selected, setSelected] = useState<string>(),
    [draft, setDraft] = useState<Content>(),
    [valid, setValid] = useState<Content>(),
    [preview, setPreview] = useState<Content>(),
    [previewWork, setPreviewWork] = useState<string>(),
    [settings, setSettings] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [saving, setSaving] = useState(false),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false);
  const [request, setRequest] = useState(""),
    [idea, setIdea] = useState(""),
    [recommendation, setRecommendation] = useState<Kind | "choose">(),
    [target, setTarget] = useState("all"),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [trash, setTrash] = useState(false),
    [narrow, setNarrow] = useState(false),
    [restart, setRestart] = useState(0),
    [light, setLight] = useState(false),
    [worldState, setWorldState] = useState("loading"),
    [versions, setVersions] = useState(false),
    [mobilePane, setMobilePane] = useState("editor"),
    [mode, setMode] = useState<"edit" | "play" | "review">("edit"),
    [partnerOpen, setPartnerOpen] = useState(false),
    [exportChoice, setExportChoice] = useState<string>(),
    [viewVersion, setViewVersion] = useState<Version>(),
    [receipt, setReceipt] = useState<{
      url: string;
      name: string;
      html: boolean;
      exportId: string;
      version: string;
    }>(),
    [welcome, setWelcome] = useState(
      () => localStorage.getItem("creation-welcome") !== "yes",
    );
  const canvasRoot = useRef<HTMLDivElement>(null);
  const appRoot = useRef<HTMLDivElement>(null),
    stateRef = useRef(state);
  stateRef.current = state;
  const frame = useRef<HTMLIFrameElement>(null),
    current = useRef<Work>(),
    live = useRef<Content>(),
    savedText = useRef(""),
    chain = useRef<Promise<unknown>>(Promise.resolve()),
    lastSave = useRef<{
      requestId: string;
      payload: Record<string, unknown>;
    }>();
  useEffect(() => {
    if (appRoot.current) appRoot.current.scrollTop = 0;
  }, [page, selected]);
  useEffect(() => {
    if (canvasRoot.current) canvasRoot.current.scrollTop = 0;
    if (window.innerWidth <= 800 && appRoot.current)
      appRoot.current.scrollTop = 0;
  }, [selected, target, mode, mobilePane]);
  useEffect(() => {
    setNotice("");
  }, [en]);
  const refresh = async () => {
    const next = await api<State>();
    setState(next);
    return next;
  };
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(errorText(e instanceof Error ? e.message : "network", en));
    } finally {
      setBusy(false);
    }
  };
  const flush = () => {
    const data = live.current,
      w = current.current;
    if (!data || !w) return Promise.resolve();
    const copy = structuredClone(data),
      id = w.id;
    const task = chain.current
      .catch(() => {})
      .then(async () => {
        if (
          current.current?.id !== id ||
          JSON.stringify(copy) === savedText.current
        )
          return;
        setSaving(true);
        const payload = {
          op: "edit",
          id,
          expectedRevision: current.current.revision,
          data: copy,
        };
        const pending =
          lastSave.current &&
          JSON.stringify(lastSave.current.payload) === JSON.stringify(payload)
            ? lastSave.current
            : { requestId: crypto.randomUUID(), payload };
        lastSave.current = pending;
        try {
          const updated = await api<Work>({
            requestId: pending.requestId,
            ...pending.payload,
          });
          current.current = updated;
          savedText.current = JSON.stringify(copy);
          lastSave.current = undefined;
          setDirty(JSON.stringify(live.current) !== savedText.current);
          await refresh();
        } finally {
          setSaving(false);
        }
      });
    chain.current = task;
    return task;
  };
  const load = (w: Work) => {
    setNotice("");
    current.current = w;
    live.current = w.draft;
    savedText.current = JSON.stringify(w.draft);
    lastSave.current = undefined;
    setSelected(w.id);
    setDraft(w.draft);
    setValid(!issues(w.draft).length ? w.draft : w.versions.at(-1)?.data);
    setDirty(false);
    setTarget("all");
    setMode("edit");
    setMobilePane("editor");
    setPartnerOpen(false);
    setRequest("");
    setPage("studio");
    setVersions(false);
    setViewVersion(undefined);
    localStorage.setItem("creation-last", w.id);
  };
  const open = (w: Work) =>
    run(async () => {
      await flush();
      load(w);
    });
  const mutate = (data: Content) => {
    live.current = data;
    setDraft(data);
    setDirty(true);
    setViewVersion(undefined);
    if (target !== "all" && !outline(data, en).some((x) => x.id === target))
      setTarget("all");
    if (!issues(data).length) setValid(data);
  };
  const go = (p: typeof page) =>
    run(async () => {
      await flush();
      setPage(p);
      setNotice("");
    });
  const act = async (op: string, extra: Record<string, unknown> = {}) => {
    await flush();
    const w = current.current;
    if (!w) return;
    const result = await command<Work>({
      op,
      id: w.id,
      expectedRevision: w.revision,
      ...extra,
    });
    await refresh();
    if (result?.draft) {
      current.current = result;
      live.current = result.draft;
      savedText.current = JSON.stringify(result.draft);
      setDraft(result.draft);
      if (
        target !== "all" &&
        !outline(result.draft, en).some((x) => x.id === target)
      )
        setTarget("all");
      setDirty(false);
      if (!issues(result.draft).length) setValid(result.draft);
    }
    return result;
  };
  const create = (kind: Kind) =>
    run(async () => {
      await flush();
      load(await command<Work>({ op: "create", kind, en }));
      await refresh();
    });
  const download = async (format: string, choice?: "save" | "previous") => {
    await flush();
    let w = current.current;
    if (!w) return;
    let version = w.versions.at(-1);
    if (
      version &&
      JSON.stringify(version.data) !== JSON.stringify(w.draft) &&
      !choice
    ) {
      setExportChoice(format);
      return;
    }
    if (!version || choice === "save") {
      w = await act("save", { summary: t("newVersion") });
      version = w?.versions.at(-1);
    }
    if (!w || !version) throw new Error("format");
    const file = await api<{
      filename: string;
      body: string;
      exportId: string;
    }>({ op: "export", id: w.id, versionId: version.id, format, en });
    const url = URL.createObjectURL(
      new Blob([file.body], {
        type: format === "html" ? "text/html" : "application/json",
      }),
    );
    setReceipt({
      url,
      name: file.filename,
      html: format === "html",
      exportId: file.exportId,
      version: new Date(version.created).toLocaleString(),
    });
    setExportChoice(undefined);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.filename;
    a.click();
  };
  useEffect(() => {
    void refresh().catch(() => setError(errorText("network", en)));
    const timer = setInterval(() => {
      void refresh().catch(() => {});
    }, 1500);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const timer = setTimeout(() => {
      void flush().catch((e) => setError(errorText(e.message, en)));
    }, 650);
    return () => clearTimeout(timer);
  }, [draft, dirty]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty || saving) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, saving]);
  useEffect(() => {
    return () => {
      if (receipt) URL.revokeObjectURL(receipt.url);
    };
  }, [receipt]);
  const taskPhase =
    state.jobs.find((j) =>
      ["queued", "generating", "validating"].includes(j.status),
    )?.status ??
    [...state.jobs]
      .reverse()
      .find((j) => j.status === "ready" || j.status === "failed")?.status;
  useEffect(() => {
    const send = () => {
      frame.current?.contentWindow?.postMessage(
        {
          source: "agent-isles-host",
          version: 2,
          type: "world:init",
          payload: {
            locale: en ? "en" : "zh",
            workspace: null,
            sessionId: null,
            panelOpen: page !== "home",
            residents: [
              {
                id: "coder",
                displayName: t("partner"),
                status:
                  taskPhase === "ready"
                    ? "approval"
                    : taskPhase === "failed"
                      ? "failed"
                      : taskPhase === "queued"
                        ? "thinking"
                        : taskPhase
                          ? "working"
                          : "idle",
              },
              { id: "teacher", displayName: t("inspiration"), status: "idle" },
              { id: "file_keeper", displayName: t("library"), status: "idle" },
            ],
          },
        },
        location.origin,
      );
      frame.current?.contentWindow?.postMessage(
        {
          source: "agent-isles-host",
          version: 2,
          type: "creation:showcase",
          payload: stateRef.current.showcase.map((s) => {
            const w = stateRef.current.works.find((w) => w.id === s?.workId),
              v = w?.versions.find((v) => v.id === s?.versionId);
            return v ? { kind: v.data.kind, theme: v.data.theme } : null;
          }),
        },
        location.origin,
      );
    };
    const listener = (e: MessageEvent) => {
      if (
        e.origin !== location.origin ||
        e.source !== frame.current?.contentWindow ||
        !isWorldToHostMessage(e.data)
      )
        return;
      if (e.data.type === "world:ready" || e.data.type === "world:playable") {
        setWorldState("ready");
        send();
      }
      if (e.data.type === "showcase:selected") {
        const slot = stateRef.current.showcase[e.data.payload.slot],
          w = stateRef.current.works.find((w) => w.id === slot?.workId),
          v = w?.versions.find((v) => v.id === slot?.versionId);
        if (v) {
          setPreviewWork(w?.id);
          setPreview(v.data);
        } else void go("inspiration");
      }
      if (e.data.type === "resident:selected") {
        if (e.data.payload.residentId === "coder" && current.current)
          void go("studio");
        else
          void go(
            e.data.payload.residentId === "file_keeper"
              ? "library"
              : "inspiration",
          );
      }
    };
    window.addEventListener("message", listener);
    send();
    const timer = setTimeout(
      () => setWorldState((s) => (s === "loading" ? "failed" : s)),
      45000,
    );
    return () => {
      clearTimeout(timer);
      window.removeEventListener("message", listener);
    };
  }, [en, page, light, state.showcaseRevision, taskPhase]);
  useEffect(() => {
    if (!preview && !settings && !welcome && !exportChoice) return;
    const root = appRoot.current;
    const modal =
      root?.querySelector<HTMLElement>(".ci-modal:last-of-type") ??
      Array.from(root?.querySelectorAll<HTMLElement>(".ci-modal") ?? []).at(-1);
    if (!root || !modal) return;
    const previous = document.activeElement as HTMLElement | null;
    const blocked = Array.from(root.children).filter(
      (n): n is HTMLElement =>
        n instanceof HTMLElement && n !== modal && !n.inert,
    );
    blocked.forEach((n) => {
      n.inert = true;
    });
    const focusable = () =>
      Array.from(
        modal.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled),iframe,[tabindex="0"]',
        ),
      ).filter((n) => n.getClientRects().length);
    focusable()[0]?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !welcome) {
        e.preventDefault();
        setPreview(undefined);
        setSettings(false);
        setExportChoice(undefined);
      }
      if (e.key !== "Tab") return;
      const nodes = focusable(),
        first = nodes[0],
        last = nodes.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    modal.addEventListener("keydown", key);
    return () => {
      blocked.forEach((n) => {
        n.inert = false;
      });
      modal.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [!!preview, settings, welcome, !!exportChoice]);
  useEffect(() => {
    if (new URLSearchParams(location.search).get("agent-isles") === "workbench")
      return;
    const changed: HTMLElement[] = [];
    let node: HTMLElement | null = appRoot.current;
    while (node && node !== document.body) {
      for (const sibling of Array.from(node.parentElement?.children ?? [])) {
        if (
          sibling !== node &&
          sibling instanceof HTMLElement &&
          !["SCRIPT", "STYLE", "LINK"].includes(sibling.tagName) &&
          !sibling.inert
        ) {
          sibling.inert = true;
          changed.push(sibling);
        }
      }
      node = node.parentElement;
    }
    return () =>
      changed.forEach((el) => {
        el.inert = false;
      });
  }, []);
  const latestJob = state.jobs.filter((j) => j.workId === selected).at(-1);
  useEffect(() => {
    if (latestJob?.status === "ready" && latestJob.candidate) {
      setMode("review");
      setMobilePane("editor");
    } else setMode((m) => (m === "review" ? "edit" : m));
  }, [latestJob?.id, latestJob?.status, selected]);
  if (new URLSearchParams(location.search).get("agent-isles") === "workbench")
    return null;
  const work = state.works.find((w) => w.id === selected),
    job = state.jobs.filter((j) => j.workId === selected).at(-1),
    activeJob =
      job && ["queued", "generating", "validating"].includes(job.status);
  const targets = draft ? outline(draft, en) : [];
  const playable =
    viewVersion?.data ??
    (job?.status === "ready" && job.candidate ? job.candidate : valid);
  const cover = (data: Content) => <Cover data={data} en={en} />;
  const recent = state.works
    .filter((w) => !w.deleted)
    .sort((a, b) => b.updated.localeCompare(a.updated))
    .slice(0, 3);
  const reviewStale = !!job && (!!dirty || job.revision !== work?.revision);
  const selectItem = (id: string) => {
    setVersions(false);
    setTarget(id);
    setMode("edit");
    setViewVersion(undefined);
    setMobilePane("editor");
  };
  const versionView = (v: Version) => (
    <div className="ci-version" key={v.id}>
      <strong>{new Date(v.created).toLocaleString()}</strong>
      <small>{v.summary}</small>
      <div className="ci-row">
        <button
          onClick={() => {
            setViewVersion(v);
            setMode("play");
          }}
        >
          {t("try")}
        </button>
        <button
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await act("restore", { versionId: v.id });
              setViewVersion(undefined);
            })
          }
        >
          {t("restore")}
        </button>
      </div>
      {draft && (
        <details>
          <summary>{t("details")}</summary>
          <pre>{changeText(changes(v.data, draft).join("\n"), en) || "—"}</pre>
        </details>
      )}
    </div>
  );
  return (
    <div
      ref={appRoot}
      className={`ci-app ${light ? "ci-light" : ""} ${page === "studio" ? "ci-in-studio" : ""}`}
    >
      <style>{styles}</style>
      {!light && (
        <iframe
          title={t("world")}
          className={`ci-world ${page !== "home" ? "ci-muted" : ""}`}
          ref={frame}
          src="/world/?embed=1"
          onError={() => setWorldState("failed")}
          allow="autoplay"
        />
      )}
      <header className="ci-header">
        <button className="ci-brand" onClick={() => void go("home")}>
          <img
            className="ci-logo"
            src="/agent-isles/brand/creation-island.svg"
            alt=""
          />
          {t("brand")}
          <small>CREATION ISLAND</small>
        </button>
        <nav>
          {(["home", "inspiration", "library"] as const).map((p) => (
            <button
              className={page === p ? "active" : ""}
              key={p}
              onClick={() => void go(p)}
            >
              {t(p)}
            </button>
          ))}
        </nav>
        <div className="ci-row">
          <button onClick={() => setLight(!light)}>
            {t(light ? "world" : "light")}
          </button>
          <button onClick={() => props.localeState.setLocale(en ? "zh" : "en")}>
            {en ? "中文" : "EN"}
          </button>
          <button onClick={() => setSettings(true)}>{t("settings")}</button>
        </div>
      </header>
      {error && (
        <div className="ci-alert" role="alert">
          {error}
          <button onClick={() => setError("")}>×</button>
          {dirty && (
            <button onClick={() => void run(flush)}>{t("retry")}</button>
          )}
        </div>
      )}
      {notice && (
        <div className="ci-notice" role="status">
          {notice}
          <button onClick={() => setNotice("")}>×</button>
        </div>
      )}
      {page === "home" && (
        <main className="ci-home">
          <section className="ci-hero">
            <span className="ci-eyebrow">{t("homeEyebrow")}</span>
            <h1>{t("tagline")}</h1>
            <p>{t("subtitle")}</p>
            <div className="ci-row">
              <button
                className="primary"
                onClick={() => void go("inspiration")}
              >
                {t("start")} ↗
              </button>
              {state.works.some(
                (w) =>
                  w.id === localStorage.getItem("creation-last") && !w.deleted,
              ) && (
                <button
                  onClick={() =>
                    void open(
                      state.works.find(
                        (w) => w.id === localStorage.getItem("creation-last"),
                      )!,
                    )
                  }
                >
                  {t("continue")}
                </button>
              )}
            </div>
            {!light && worldState !== "ready" && (
              <small>
                {t(worldState === "failed" ? "worldFailed" : "loading")}
              </small>
            )}
          </section>
          <section className="ci-recent">
            <div className="ci-section-heading">
              <div>
                <span className="ci-eyebrow">
                  {t(recent.length ? "recentHint" : "sampleLabel")}
                </span>
                <h2>{t(recent.length ? "recentWorks" : "startSmall")}</h2>
              </div>
              <button
                onClick={() =>
                  void go(recent.length ? "library" : "inspiration")
                }
              >
                {t(recent.length ? "viewAll" : "inspiration")} ↗
              </button>
            </div>
            <div className="ci-grid">
              {recent.length
                ? recent.map((w) => (
                    <button
                      className="ci-recent-work"
                      key={w.id}
                      onClick={() => void open(w)}
                    >
                      {cover(w.draft)}
                      <span>{t("continue")} ↗</span>
                    </button>
                  ))
                : kinds.map((kind) => (
                    <button
                      className="ci-recent-work"
                      key={kind}
                      onClick={() => {
                        setPreviewWork(undefined);
                        setPreview(sample(kind, en));
                      }}
                    >
                      {cover(sample(kind, en))}
                      <span>{t("try")} ↗</span>
                    </button>
                  ))}
            </div>
          </section>
          <section className="ci-showcase">
            <h2>
              {t("showcase")} <small>01 — 06</small>
            </h2>
            <div className="ci-shelf">
              {state.showcase.map((s, i) => {
                const w = state.works.find((w) => w.id === s?.workId),
                  v = w?.versions.find((v) => v.id === s?.versionId);
                return (
                  <button
                    key={i}
                    className="ci-exhibit"
                    onClick={() =>
                      v
                        ? (setPreviewWork(w?.id), setPreview(v.data))
                        : void go("inspiration")
                    }
                  >
                    {v ? (
                      cover(v.data)
                    ) : (
                      <div className="ci-empty-symbol">＋</div>
                    )}
                    <span>{v?.data.title ?? t("emptySlot")}</span>
                    <small>{String(i + 1).padStart(2, "0")}</small>
                  </button>
                );
              })}
            </div>
          </section>
        </main>
      )}
      {page === "inspiration" && (
        <main className="ci-page">
          <span className="ci-eyebrow">{t("inspirationEyebrow")}</span>
          <h1>{t("inspiration")}</h1>
          <p>{t("briefHint")}</p>
          <div className="ci-toolbar">
            <input
              aria-label={t("idea")}
              placeholder={t("idea")}
              value={idea}
              maxLength={2000}
              onChange={(e) => {
                setIdea(e.target.value);
                setRecommendation(undefined);
              }}
            />
            <button
              disabled={!idea.trim()}
              onClick={() =>
                setRecommendation(
                  /视频|网站|应用|商城|3d|video|website|commerce/i.test(idea)
                    ? "choose"
                    : /生日|祝福|贺卡|birthday|card|greeting/i.test(idea)
                      ? "card"
                      : /故事|剧情|story|adventure/i.test(idea)
                        ? "story"
                        : /问答|知识|题|quiz|trivia/i.test(idea)
                          ? "quiz"
                          : "choose",
                )
              }
            >
              {t("recommend")}
            </button>
          </div>
          {recommendation && (
            <article className="ci-panel">
              <p>
                {t(recommendation === "choose" ? "boundaryHint" : "chooseHint")}
              </p>
              <div className="ci-row">
                {(recommendation === "choose" ? kinds : [recommendation]).map(
                  (kind) => (
                    <button
                      key={kind}
                      onClick={() =>
                        void run(async () => {
                          await flush();
                          load(await command<Work>({ op: "create", kind, en }));
                          setRequest(idea);
                          setPartnerOpen(true);
                          setMobilePane("partner");
                          await refresh();
                        })
                      }
                    >
                      {t(kind)} ↗
                    </button>
                  ),
                )}
              </div>
            </article>
          )}
          <div className="ci-grid">
            {kinds.map((kind) => {
              const d = sample(kind, en);
              return (
                <article key={kind}>
                  {cover(d)}
                  <h2>{t(kind)}</h2>
                  <p>{t(`${kind}Hint`)}</p>
                  <div className="ci-row">
                    <button
                      onClick={() => (setPreviewWork(undefined), setPreview(d))}
                    >
                      {t("try")}
                    </button>
                    <button
                      className="primary"
                      disabled={busy}
                      onClick={() => void create(kind)}
                    >
                      {t("make")} ↗
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </main>
      )}
      {page === "library" && (
        <main className="ci-page">
          <h1>{t(trash ? "trash" : "library")}</h1>
          <div className="ci-toolbar">
            <input
              aria-label={t("search")}
              placeholder={t("search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              aria-label={t("allTypes")}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">{t("allTypes")}</option>
              {kinds.map((k) => (
                <option key={k} value={k}>
                  {t(k)}
                </option>
              ))}
            </select>
            <button onClick={() => setTrash(!trash)}>
              {t(trash ? "library" : "trash")}
            </button>
            <label className="ci-file">
              {t("import")}
              <input
                type="file"
                accept=".json,.isle.json"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  void run(async () => {
                    if (file.size > 2 * 1024 * 1024)
                      throw new Error("tooLarge");
                    load(
                      await command<Work>({
                        op: "import",
                        pack: JSON.parse(await file.text()),
                      }),
                    );
                    await refresh();
                  });
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          <div className="ci-grid">
            {state.works
              .filter(
                (w) =>
                  w.deleted === trash &&
                  (filter === "all" || w.draft.kind === filter) &&
                  w.draft.title.toLowerCase().includes(search.toLowerCase()),
              )
              .map((w) => (
                <article key={w.id}>
                  {cover(w.draft)}
                  <h2>{w.draft.title}</h2>
                  <small>
                    {new Date(w.updated).toLocaleString()} ·{" "}
                    {w.versions.length
                      ? `${w.versions.length} ${t("versions")}`
                      : t("draftLabel")}
                  </small>
                  <div className="ci-row">
                    {!trash && (
                      <button className="primary" onClick={() => void open(w)}>
                        {t("edit")}
                      </button>
                    )}
                    {(trash
                      ? ["restoreTrash", "destroy"]
                      : ["copy", "trash"]
                    ).map((op) => (
                      <button
                        key={op}
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            if (
                              op === "destroy" &&
                              !confirm(t("confirmDestroy"))
                            )
                              return;
                            await command({
                              op,
                              id: w.id,
                              expectedRevision: w.revision,
                            });
                            await refresh();
                          })
                        }
                      >
                        {t(op as "copy" | "trash" | "restoreTrash" | "destroy")}
                      </button>
                    ))}
                  </div>
                  {!trash && w.versions.length > 0 && (
                    <label className="ci-field">
                      {t("show")}
                      <select
                        value=""
                        onChange={(e) =>
                          void run(async () => {
                            await command({
                              op: "showcase",
                              id: w.id,
                              versionId: w.versions.at(-1)!.id,
                              slot: Number(e.target.value),
                              expectedRevision: state.showcaseRevision,
                            });
                            await refresh();
                          })
                        }
                      >
                        <option value="">—</option>
                        {state.showcase.map((s, i) => (
                          <option key={i} value={i}>
                            {t("slot")} {i + 1}
                            {s
                              ? " · " +
                                state.works.find((w) => w.id === s.workId)
                                  ?.draft.title
                              : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </article>
              ))}
          </div>
          {!state.works.some(
            (w) =>
              w.deleted === trash &&
              (filter === "all" || w.draft.kind === filter) &&
              w.draft.title.toLowerCase().includes(search.toLowerCase()),
          ) && (
            <p className="ci-empty">
              {t(search || filter !== "all" ? "noResults" : "empty")}
            </p>
          )}
        </main>
      )}
      {page === "studio" && draft && (
        <main className="ci-studio">
          <div className="ci-studio-bar">
            <div>
              <strong>{draft.title || t("title")}</strong>
              <small aria-live="polite">
                {t(saving ? "saving" : dirty ? "pendingSave" : "saved")}
              </small>
            </div>
            <div className="ci-row">
              <button
                onClick={() => {
                  setVersions(!versions);
                  setMode("edit");
                  setTarget("all");
                  setMobilePane("editor");
                }}
              >
                {t("versions")}
              </button>
              <button
                disabled={busy || !!issues(draft).length}
                onClick={() =>
                  void run(async () => {
                    await act("save", { summary: t("newVersion") });
                    setNotice(t("versionSaved"));
                  })
                }
              >
                {t("save")}
              </button>
              <button
                className="primary"
                disabled={busy}
                onClick={() => void run(() => download("html"))}
              >
                {t("export")} ↗
              </button>
              <details className="ci-more">
                <summary>{t("more")}</summary>
                <div>
                  <button
                    disabled={busy}
                    onClick={() => void run(() => download("json"))}
                  >
                    {t("backup")}
                  </button>
                </div>
              </details>
            </div>
          </div>
          <nav className="ci-mobile-switch" aria-label={t("editor")}>
            {(["outline", "editor", "partner"] as const).map((pane) => (
              <button
                key={pane}
                aria-pressed={mobilePane === pane}
                onClick={() => {
                  setMobilePane(pane);
                  if (pane === "partner") setPartnerOpen(true);
                }}
              >
                {t(pane)}
              </button>
            ))}
          </nav>
          <div
            className={`ci-columns ci-pane-${mobilePane} ${partnerOpen ? "ci-with-partner" : ""}`}
          >
            <aside className="ci-directory">
              <Outline
                data={draft}
                en={en}
                selected={target}
                onSelect={selectItem}
              />
            </aside>
            <div ref={canvasRoot} className="ci-canvas">
              <div className="ci-canvas-toolbar">
                <div className="ci-segment" aria-label={t("editor")}>
                  <button
                    aria-pressed={mode === "edit"}
                    onClick={() => {
                      setMode("edit");
                      setViewVersion(undefined);
                    }}
                  >
                    {t("editMode")}
                  </button>
                  <button
                    aria-pressed={mode === "play"}
                    onClick={() => setMode("play")}
                  >
                    {t("playMode")}
                  </button>
                  {job?.status === "ready" && job.candidate && (
                    <button
                      aria-pressed={mode === "review"}
                      onClick={() => setMode("review")}
                    >
                      {t("reviewMode")}
                    </button>
                  )}
                </div>
                <button
                  className="ci-ai-toggle"
                  aria-pressed={partnerOpen}
                  onClick={() => {
                    setPartnerOpen(!partnerOpen);
                    setMobilePane(partnerOpen ? "editor" : "partner");
                  }}
                >
                  ✧ {t("partner")}
                </button>
              </div>
              <section className="ci-content" hidden={mode !== "edit"}>
                <h2>
                  {target === "all"
                    ? t("workSettings")
                    : targets.find((x) => x.id === target)?.label}{" "}
                  <small>{t(draft.kind)}</small>
                </h2>
                {versions && (
                  <div className="ci-versions">
                    {!work?.versions.length && <p>{t("noVersion")}</p>}
                    {work?.versions.slice().reverse().map(versionView)}
                  </div>
                )}
                {issues(draft).length > 0 && (
                  <details className="ci-validation">
                    <summary>{t("invalid")}</summary>
                    <ul>
                      {issues(draft).map((x, i) => (
                        <li key={i}>{x}</li>
                      ))}
                    </ul>
                  </details>
                )}
                <Editor
                  data={draft}
                  en={en}
                  selected={target}
                  onChange={mutate}
                  onSelect={selectItem}
                />
              </section>
              <section className="ci-play" hidden={mode !== "play"}>
                <div className="ci-row">
                  <h2>
                    {viewVersion
                      ? `${t("versions")} · ${new Date(viewVersion.created).toLocaleString()}`
                      : job?.status === "ready" && job.candidate
                        ? t("candidate")
                        : t("preview")}
                  </h2>
                  <button onClick={() => setNarrow(!narrow)}>
                    {t(narrow ? "wide" : "narrow")}
                  </button>
                  <button
                    onClick={() => {
                      setRestart(restart + 1);
                      setViewVersion(undefined);
                    }}
                  >
                    {t("reset")}
                  </button>
                </div>
                {issues(draft).length > 0 && (
                  <details className="ci-validation">
                    <summary>{t("invalid")}</summary>
                    <ul>
                      {issues(draft).map((x, i) => (
                        <li key={i}>{x}</li>
                      ))}
                    </ul>
                  </details>
                )}
                {playable && (
                  <iframe
                    className={narrow ? "narrow" : ""}
                    key={restart}
                    title={t("preview")}
                    sandbox="allow-scripts"
                    srcDoc={render(playable, en)}
                  />
                )}
              </section>{" "}
              {mode === "review" &&
                job?.status === "ready" &&
                job.candidate && (
                  <section className="ci-review">
                    <span className="ci-eyebrow">{t("candidate")}</span>
                    <h2>{t("reviewIntro")}</h2>
                    {reviewStale && (
                      <p className="ci-validation">{t("reviewStale")}</p>
                    )}
                    <div className="ci-review-actions">
                      <button
                        className="primary"
                        disabled={busy || reviewStale}
                        onClick={() =>
                          void run(() => act("adopt", { jobId: job.id }))
                        }
                      >
                        {t("adopt")}
                      </button>
                      <button
                        disabled={busy}
                        onClick={() =>
                          void run(() => act("discard", { jobId: job.id }))
                        }
                      >
                        {t("discard")}
                      </button>
                      <button
                        onClick={() => {
                          setViewVersion(undefined);
                          setMode("play");
                        }}
                      >
                        {t("try")} ↗
                      </button>
                    </div>
                    <p>{t("reviewHint")}</p>
                    {!reviewStale && (
                      <ChangeReview
                        before={draft}
                        after={job.candidate}
                        en={en}
                      />
                    )}
                  </section>
                )}
            </div>
            <aside className="ci-partner" hidden={!partnerOpen}>
              <img src="/agent-isles/brand/q-portrait.png" alt="" />
              <h2>{t("partner")}</h2>
              <button
                className="ci-partner-close"
                onClick={() => {
                  setPartnerOpen(false);
                  setMobilePane("editor");
                }}
                aria-label={t("hidePartner")}
              >
                ×
              </button>
              <small className="ci-cost">{t("modelCost")}</small>
              <details className="ci-history">
                <summary>{t("conversation")}</summary>
                <div className="ci-conversation">
                  {work?.history.map((h, i) => (
                    <p key={i} className={h.role}>
                      {h.role === "assistant" &&
                      /^(title|theme|kind|content\.)/.test(h.text)
                        ? changeText(h.text, en)
                        : h.text}
                    </p>
                  ))}
                </div>
              </details>
              <label className="ci-field">
                {t("scope")}
                <select
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                >
                  <option value="all">{t("all")}</option>
                  {targets.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.label}
                    </option>
                  ))}
                </select>
                <small>{t("scopeHint")}</small>
              </label>
              <textarea
                aria-label={t("brief")}
                placeholder={t("ask")}
                maxLength={6000}
                value={request}
                onChange={(e) => setRequest(e.target.value)}
              />
              <button
                className="primary"
                disabled={busy || !!activeJob || !request.trim()}
                onClick={() =>
                  void run(async () => {
                    const settings = await props.models.load();
                    if (
                      !settings.routable ||
                      !settings.providers.find(
                        (p) => p.id === settings.selection.provider,
                      )?.credential.configured
                    ) {
                      setSettings(true);
                      setNotice(t("configure"));
                      return;
                    }
                    await act("generate", { request, target });
                  })
                }
              >
                {t("generate")}
              </button>
              {job && (
                <div className="ci-job" aria-live="polite">
                  <strong>{t(job.status)}</strong>
                  {job.error && <p>{errorText(job.error, en)}</p>}
                  {job.question && <p>{job.question}</p>}
                  {activeJob && (
                    <button
                      onClick={() =>
                        void run(() => act("cancel", { jobId: job.id }))
                      }
                    >
                      {t("cancel")}
                    </button>
                  )}
                  {job.status === "ready" && job.candidate && (
                    <button
                      onClick={() => {
                        setMode("review");
                        setMobilePane("editor");
                      }}
                    >
                      {t("reviewMode")} ↗
                    </button>
                  )}
                </div>
              )}
            </aside>
          </div>
        </main>
      )}
      {preview && (
        <div
          className="ci-modal"
          role="dialog"
          aria-modal="true"
          aria-label={t("try")}
        >
          <section>
            <button
              className="ci-close"
              onClick={() => setPreview(undefined)}
              aria-label={t("close")}
            >
              ×
            </button>
            <iframe
              title={t("try")}
              sandbox="allow-scripts"
              srcDoc={render(preview, en)}
            />
            <div className="ci-row">
              {previewWork && (
                <button
                  className="primary"
                  onClick={() =>
                    void run(async () => {
                      await flush();
                      const latest = await refresh();
                      const work = latest.works.find(
                        (w) => w.id === previewWork && !w.deleted,
                      );
                      if (!work) throw new Error("notFound");
                      load(work);
                      setPreview(undefined);
                    })
                  }
                >
                  {t("edit")}
                </button>
              )}
              <button
                className="primary"
                onClick={() =>
                  void run(async () => {
                    await flush();
                    load(
                      await command<Work>({
                        op: "import",
                        pack: {
                          format: "creation-island",
                          version: 2,
                          rendererVersion: 1,
                          data: preview,
                        },
                      }),
                    );
                    setPreview(undefined);
                    await refresh();
                  })
                }
              >
                {t("make")}
              </button>
              <button onClick={() => setPreview(undefined)}>
                {t("close")}
              </button>
            </div>
          </section>
        </div>
      )}
      {exportChoice && (
        <div
          className="ci-modal"
          role="dialog"
          aria-modal="true"
          aria-label={t("exportChoice")}
        >
          <section className="ci-export-choice">
            <span className="ci-eyebrow">{t("export")}</span>
            <h2>{t("exportChoice")}</h2>
            <p>{t("exportChoiceHint")}</p>
            <div className="ci-export-options">
              <button
                className="primary"
                disabled={busy || !!(draft && issues(draft).length)}
                onClick={() => void run(() => download(exportChoice, "save"))}
              >
                {t("saveThenExport")}
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  void run(() => download(exportChoice, "previous"))
                }
              >
                {t("exportPrevious")}
                <small>
                  {work?.versions.at(-1) &&
                    new Date(work.versions.at(-1)!.created).toLocaleString()}
                </small>
              </button>
              <button
                disabled={busy}
                onClick={() => setExportChoice(undefined)}
              >
                {t("returnEditing")}
              </button>
            </div>
          </section>
        </div>
      )}
      {settings && (
        <div
          className="ci-modal ci-settings"
          role="dialog"
          aria-modal="true"
          aria-label={t("settings")}
        >
          <ModelSettings
            actions={props.models}
            close={() => setSettings(false)}
            t={props.t}
          />
        </div>
      )}
      {welcome && (
        <div
          className="ci-modal"
          role="dialog"
          aria-modal="true"
          aria-label={t("brand")}
        >
          <section className="ci-welcome">
            <img
              className="ci-welcome-logo"
              src="/agent-isles/brand/creation-island.svg"
              alt=""
            />
            <span className="ci-eyebrow">{t("welcomeEyebrow")}</span>
            <h1>{t("tagline")}</h1>
            <p>{t("subtitle")}</p>
            <p>{t("modelCost")}</p>
            <button
              className="primary"
              onClick={() => {
                localStorage.setItem("creation-welcome", "yes");
                setWelcome(false);
                setPage("inspiration");
              }}
            >
              {t("try")} ↗
            </button>
            <button
              onClick={() => {
                localStorage.setItem("creation-welcome", "yes");
                setWelcome(false);
              }}
            >
              {t("world")}
            </button>
          </section>
        </div>
      )}
      {receipt && (
        <div className="ci-receipt" role="status">
          <strong>{t("downloaded")}</strong>
          <span>{receipt.name}</span>
          <small>
            {t("exportedVersion")} · {receipt.version}
          </small>
          <div className="ci-row">
            <button
              onClick={() =>
                void run(() =>
                  api({ op: "reveal", exportId: receipt.exportId }),
                )
              }
            >
              {t("reveal")}
            </button>
            {receipt.html && (
              <a href={receipt.url} target="_blank" rel="noreferrer">
                {t("openFile")}
              </a>
            )}
            <a href={receipt.url} download={receipt.name}>
              {t("download")}
            </a>
            <button
              aria-label={t("close")}
              onClick={() => setReceipt(undefined)}
            >
              ×
            </button>
          </div>
          <small>{t("fileLocation")}</small>
        </div>
      )}
    </div>
  );
}
