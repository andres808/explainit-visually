"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Atom,
  BookOpen,
  BrainCircuit,
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Compass,
  Cpu,
  Download,
  Eye,
  EyeOff,
  FlaskConical,
  GitBranch,
  HeartPulse,
  Layers,
  Library,
  LoaderCircle,
  Maximize2,
  MessageCircle,
  Minus,
  MousePointer2,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  Sparkles,
  Square,
  WandSparkles,
  X,
  Zap,
} from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import type {
  Component,
  Difficulty,
  Hotspot,
  LearningNode,
  TutorAnswer,
  VisualStyle,
} from "@/lib/types";

const STYLES: { id: VisualStyle; label: string }[] = [
  { id: "scientific", label: "Scientific Diagram" },
  { id: "isometric", label: "Isometric 3D" },
  { id: "blueprint", label: "Engineering Blueprint" },
  { id: "textbook", label: "Textbook Illustration" },
  { id: "sketch", label: "Hand-Drawn Sketch" },
  { id: "futuristic", label: "Futuristic Visualization" },
];
const EXAMPLES = [
  {
    icon: Cpu,
    title: "The engine",
    question: "How does a four-stroke combustion engine work?",
    tag: "ENGINEERING",
    color: "teal",
  },
  {
    icon: HeartPulse,
    title: "The human heart",
    question: "How does the human heart pump blood?",
    tag: "BIOLOGY",
    color: "rose",
  },
  {
    icon: BrainCircuit,
    title: "Neural networks",
    question: "How does a neural network learn?",
    tag: "TECHNOLOGY",
    color: "violet",
  },
  {
    icon: Camera,
    title: "Inside a camera",
    question: "How does a camera capture light?",
    tag: "PHYSICS",
    color: "amber",
  },
];
type Action = {
  route: string;
  body: Record<string, unknown>;
  replace?: boolean;
};
type Billing = {
  configured?: boolean;
  active?: boolean;
  testMode?: boolean;
  price?: { amount: number; currency: string };
  [key: string]: unknown;
};
const STORE = "explainit.visual-journey.v1";
function Mark() {
  return (
    <span className="brand-mark">
      <Atom size={23} strokeWidth={1.8} />
    </span>
  );
}
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    box.current?.focus();
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const items = box.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]),a[href],input,select,[tabindex="0"]',
        );
        if (!items?.length) return;
        const first = items[0],
          last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handle);
    return () => {
      document.removeEventListener("keydown", handle);
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        ref={box}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="modal"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="modal-heading">
          <h2>{title}</h2>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </motion.div>
    </div>
  );
}

export default function Home() {
  const [view, setView] = useState<"home" | "workspace">("home"),
    [question, setQuestion] = useState(""),
    [difficulty, setDifficulty] = useState<Difficulty>("beginner"),
    [style, setStyle] = useState<VisualStyle>("scientific"),
    [mode, setMode] = useState<"demo" | "live">("demo"),
    [nodes, setNodes] = useState<LearningNode[]>([]),
    [activeId, setActiveId] = useState(""),
    [selectedId, setSelectedId] = useState(""),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [modal, setModal] = useState<
      "library" | "settings" | "pricing" | "compare" | null
    >(null),
    [health, setHealth] = useState<Record<string, unknown>>({}),
    [billing, setBilling] = useState<Billing>({}),
    [billingBusy, setBillingBusy] = useState(false),
    [tutorQuestion, setTutorQuestion] = useState(""),
    [answer, setAnswer] = useState<TutorAnswer | null>(null),
    [tutorBusy, setTutorBusy] = useState(false),
    [answeredQuestion, setAnsweredQuestion] = useState(""),
    [mobilePanel, setMobilePanel] = useState<"journey" | "details" | null>(
      null,
    ),
    [collapsed, setCollapsed] = useState<Set<string>>(new Set()),
    [hydrated, setHydrated] = useState(false),
    [retryAction, setRetryAction] = useState<Action | null>(null);
  const explanationPanel = useRef<HTMLElement>(null);
  useEffect(() => {
    explanationPanel.current?.scrollTo({ top: 0 });
  }, [activeId, selectedId, mobilePanel]);
  const tutorVersion = useRef(0),
    tutorAbort = useRef<AbortController | null>(null);
  const abort = useRef<AbortController | null>(null),
    sessionId = useRef("");
  const active = nodes.find((n) => n.id === activeId),
    selected = active?.components.find((c) => c.id === selectedId),
    parent = nodes.find((n) => n.id === active?.parentId);
  const closeModal = useCallback(() => setModal(null), []);
  useEffect(() => {
    sessionId.current = crypto.randomUUID();
    const hydration = setTimeout(() => {
      try {
        const saved = JSON.parse(localStorage.getItem(STORE) || "null");
        if (Array.isArray(saved?.nodes)) {
          const good = saved.nodes.filter(
            (n: LearningNode) =>
              typeof n?.id === "string" &&
              typeof n.title === "string" &&
              Array.isArray(n.components) &&
              Array.isArray(n.hotspots) &&
              typeof n.imageUrl === "string" &&
              n.imageUrl.startsWith("/") &&
              !n.imageUrl.startsWith("//"),
          );
          setNodes(good);
          setActiveId(
            good.some((n: LearningNode) => n.id === saved.activeId)
              ? saved.activeId
              : good.at(-1)?.id || "",
          );
        }
      } catch {
        /* Invalid browser storage starts a clean journey. */
      }
      setHydrated(true);
    }, 0);
    fetch("/api/health")
      .then((r) => r.json())
      .then((data) => setHealth(data as Record<string, unknown>))
      .catch(() => {});
    fetch("/api/billing/status")
      .then((r) => r.json())
      .then((data) => setBilling(data as Billing))
      .catch(() => {});
    return () => clearTimeout(hydration);
  }, []);
  useEffect(() => {
    if (hydrated)
      try {
        localStorage.setItem(STORE, JSON.stringify({ nodes, activeId }));
      } catch {
        queueMicrotask(() =>
          setNotice(
            "Browser storage is full. Download your journey to keep a copy.",
          ),
        );
      }
  }, [nodes, activeId, hydrated]);
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setProgress((p) => Math.min(p + 1, 2)), 9000);
    return () => clearInterval(t);
  }, [busy]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 5500);
    return () => clearTimeout(t);
  }, [notice]);
  async function request(action: Action) {
    if (busy) return;
    tutorVersion.current++;
    tutorAbort.current?.abort();
    setTutorBusy(false);
    setRetryAction(action);
    const controller = new AbortController();
    abort.current = controller;
    setBusy(true);
    setError("");
    setProgress(0);
    try {
      const r = await fetch(`/api/${action.route}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...action.body,
          mode,
          sessionId: sessionId.current,
        }),
        signal: controller.signal,
      });
      const data = (await r.json()) as {
        node: LearningNode;
        error?: unknown;
        message?: string;
      };
      if (!r.ok) throw new Error(errorMessage(data));
      const node: LearningNode = data.node;
      if (!node?.id)
        throw new Error(
          "The learning service returned an incomplete response.",
        );
      setNodes((list) =>
        action.replace
          ? list.map((n) => (n.id === node.id ? node : n))
          : [...list.filter((n) => n.id !== node.id), node],
      );
      setActiveId(node.id);
      setSelectedId("");
      setAnswer(null);
      setView("workspace");
      setMobilePanel(null);
      setStyle(node.style);
      if (mode === "live" && !node.hotspots.length)
        setNotice(
          "Use Map components to place labels, or configure a vision model for automatic mapping.",
        );
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError"))
        setError(
          e instanceof Error ? e.message : "Could not create this visual.",
        );
    } finally {
      setBusy(false);
      abort.current = null;
    }
  }
  function learn(q = question) {
    if (!q.trim() || busy) return;
    setQuestion(q);
    void request({ route: "learn", body: { question: q, difficulty, style } });
  }
  function navigate(n: LearningNode) {
    tutorVersion.current++;
    tutorAbort.current?.abort();
    setTutorBusy(false);
    setActiveId(n.id);
    setSelectedId("");
    setAnswer(null);
    setStyle(n.style);
    setView("workspace");
    setMobilePanel(null);
    setError("");
  }
  function explore(c: Component) {
    if (!active) return;
    void request({
      route: "explore",
      body: { node: { ...active, difficulty }, componentId: c.id },
    });
  }
  async function ask(q = tutorQuestion, simple = false) {
    if (!q.trim() || !active || tutorBusy) return;
    const version = ++tutorVersion.current;
    const controller = new AbortController();
    tutorAbort.current = controller;
    setRetryAction(null);
    setTutorBusy(true);
    setTutorQuestion(q);
    setError("");
    try {
      const r = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          node: active,
          componentId: selectedId || undefined,
          question: q,
          simple,
          mode,
          sessionId: sessionId.current,
        }),
        signal: controller.signal,
      });
      const data = (await r.json()) as TutorAnswer & {
        error?: unknown;
        message?: string;
      };
      if (!r.ok) throw new Error(errorMessage(data));
      if (version === tutorVersion.current) {
        setAnswer(data);
        setAnsweredQuestion(q);
      }
    } catch (e) {
      if (
        version === tutorVersion.current &&
        !(e instanceof DOMException && e.name === "AbortError")
      )
        setError(e instanceof Error ? e.message : "Tutor unavailable.");
    } finally {
      if (version === tutorVersion.current) setTutorBusy(false);
    }
  }
  function exportJourney() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify({ version: 1, nodes }, null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "explainit-learning-journey.json";
    a.click();
    URL.revokeObjectURL(url);
    setNotice("Learning journey downloaded.");
  }
  async function checkout(portal = false) {
    if (billingBusy) return;
    setBillingBusy(true);
    setRetryAction(null);
    setError("");
    try {
      const r = await fetch(`/api/billing/${portal ? "portal" : "checkout"}`, {
        method: "POST",
      });
      const d = (await r.json()) as {
        url?: unknown;
        error?: unknown;
        message?: string;
      };
      if (!r.ok) throw new Error(errorMessage(d));
      if (typeof d.url !== "string" || !d.url.startsWith("https://"))
        throw new Error("Invalid checkout destination.");
      window.location.assign(d.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t open billing.");
      setBillingBusy(false);
    }
  }
  function updateHotspots(hotspots: Hotspot[]) {
    if (!active) return;
    setNodes((list) =>
      list.map((n) => (n.id === active.id ? { ...n, hotspots } : n)),
    );
    setNotice("Component positions saved.");
  }
  function treeNode(n: LearningNode, level = 0): React.ReactNode {
    const children = nodes.filter((c) => c.parentId === n.id);
    return (
      <div key={n.id}>
        <div
          className={`journey-node ${n.id === activeId ? "active" : ""}`}
          style={{ paddingLeft: 12 + level * 15 }}
        >
          <button
            className="tree-toggle"
            disabled={!children.length}
            aria-label={`${collapsed.has(n.id) ? "Expand" : "Collapse"} ${n.title}`}
            onClick={() =>
              setCollapsed((prev) => {
                const next = new Set(prev);
                if (next.has(n.id)) next.delete(n.id);
                else next.add(n.id);
                return next;
              })
            }
          >
            {children.length ? (
              collapsed.has(n.id) ? (
                <ChevronRight size={13} />
              ) : (
                <ChevronDown size={13} />
              )
            ) : (
              <span className="tree-dot" />
            )}
          </button>
          <button className="tree-label" onClick={() => navigate(n)}>
            <span>{n.title}</span>
            {n.id === activeId && <span className="current-dot" />}
          </button>
        </div>
        {!collapsed.has(n.id) && children.map((c) => treeNode(c, level + 1))}
      </div>
    );
  }
  return (
    <div
      className={`app-shell ${view === "workspace" ? "learning-shell" : ""}`}
    >
      <header className="site-header">
        <button
          className="brand"
          onClick={() => {
            setView("home");
            setError("");
          }}
          aria-label="ExplainIt Visually home"
        >
          <Mark />
          <span>
            ExplainIt<span className="brand-light"> Visually</span>
            <span className="beta">LAB</span>
          </span>
        </button>
        <nav className="main-nav" aria-label="Main navigation">
          <button
            className={view === "home" ? "nav-active" : ""}
            onClick={() => setView("home")}
          >
            Explore
          </button>
          <button
            onClick={() => {
              setView("home");
              setTimeout(
                () =>
                  document
                    .getElementById("how-it-works")
                    ?.scrollIntoView({ behavior: "smooth" }),
                60,
              );
            }}
          >
            How it works
          </button>
          <button onClick={() => setModal("library")}>
            <Library size={14} /> My library
            {nodes.length > 0 && (
              <span className="nav-count">{nodes.length}</span>
            )}
          </button>
        </nav>
        <div className="header-actions">
          <button
            className={`mode-pill ${mode}`}
            onClick={() => setMode(mode === "demo" ? "live" : "demo")}
            title="Switch demo or live generation"
          >
            <span />
            {mode === "demo" ? "Demo mode" : "Live mode"}
            <ChevronDown size={12} />
          </button>
          <button
            className="icon-button settings"
            onClick={() => setModal("settings")}
            aria-label="Integration settings"
          >
            <Settings2 size={17} />
          </button>
          <button className="pro-button" onClick={() => setModal("pricing")}>
            <Zap size={14} />
            {billing.active ? "Your Pro plan" : "Explore Pro"}
          </button>
        </div>
      </header>
      {view === "home" ? (
        <main className="landing">
          <section className="hero">
            <div className="hero-glow" />
            <motion.div
              className="hero-content"
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="eyebrow">
                <span className="status-dot" /> A LITTLE CURIOSITY. A WHOLE NEW
                PERSPECTIVE.
              </div>
              <h1>
                Don’t just learn it.
                <br />
                <span>See it.</span>
              </h1>
              <p className="hero-subtitle">
                Big questions deserve a clearer picture. Turn your curiosity
                into
                <br className="desktop-break" /> interactive visual
                explanations, one discovery at a time.
              </p>
              <form
                className="question-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  learn();
                }}
              >
                <div className="question-input">
                  <Search size={21} />
                  <input
                    aria-label="What are you curious about?"
                    placeholder="What are you curious about?"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    maxLength={1000}
                  />
                  <Button
                    className="visualize-button"
                    disabled={!question.trim() || busy}
                    type="submit"
                  >
                    <Sparkles size={16} /> Visualize it <ArrowRight size={17} />
                  </Button>
                </div>
                <div className="question-options">
                  <span>
                    <span className="tiny-dot" /> Start with a question. Follow
                    your curiosity.
                  </span>
                  <label>
                    Learning level{" "}
                    <select
                      aria-label="Learning level"
                      value={difficulty}
                      onChange={(e) =>
                        setDifficulty(e.target.value as Difficulty)
                      }
                    >
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                    </select>
                  </label>
                </div>
              </form>
              <div className="studio-entry">
                <a href="/studio">
                  <Sparkles size={12} /> Have an Ideogram key? Open the image
                  studio <ArrowRight size={12} />
                </a>
              </div>
              <div className="try-line">
                <span>Try asking</span>
                <button onClick={() => learn(EXAMPLES[0].question)}>
                  How does an engine work? ↗
                </button>
                <button onClick={() => learn(EXAMPLES[2].question)}>
                  How does AI learn? ↗
                </button>
              </div>
            </motion.div>
          </section>
          <section className="featured-section">
            <div className="section-caption">
              <span>
                <span className="tiny-dot" /> CURIOSITY, MADE INTERACTIVE
              </span>
              <span className="quiet">
                A peek inside your next discovery <ArrowDown size={13} />
              </span>
            </div>
            <div className="featured-grid">
              <button
                className="featured-visual"
                onClick={() => learn(EXAMPLES[0].question)}
                aria-label="Explore the engine demo"
              >
                <div className="specimen-top">
                  <span className="specimen-tag">
                    <span /> FEATURED EXPLORATION
                  </span>
                  <span className="specimen-number">
                    FIG. 001 / ENGINEERING
                  </span>
                </div>
                <Image
                  unoptimized
                  width={1200}
                  height={900}
                  src="/demo/engine.svg"
                  alt="Original demo cutaway illustration of a combustion engine"
                  className="hero-engine"
                />
                <div className="hero-hotspot h1">
                  <span /> Spark plug
                </div>
                <div className="hero-hotspot h2">
                  <span /> Piston
                </div>
                <div className="hero-hotspot h3">
                  <span /> Crankshaft
                </div>
                <div className="specimen-bottom">
                  <span>
                    <MousePointer2 size={14} /> Every part has a story. Click to
                    explore.
                  </span>
                  <span className="round-arrow">
                    <ArrowRight size={19} />
                  </span>
                </div>
                <span className="demo-asset-label">
                  CURATED DEMO ILLUSTRATION
                </span>
              </button>
              <div className="featured-description">
                <div className="eyebrow mini">LOOK CLOSER. GO DEEPER.</div>
                <h2>
                  A whole world
                  <br />
                  inside every <span>“why.”</span>
                </h2>
                <p>
                  An engine becomes a piston. A piston becomes a lesson in
                  pressure. Every click takes you somewhere new.
                </p>
                <div className="discovery-path">
                  <span>
                    <Cpu size={14} /> Engine
                  </span>
                  <ChevronRight size={12} />
                  <span className="path-selected">Piston</span>
                  <ChevronRight size={12} />
                  <span>Compression</span>
                </div>
                <button
                  className="text-link"
                  onClick={() => learn(EXAMPLES[0].question)}
                >
                  Take it apart, one idea at a time <ArrowRight size={17} />
                </button>
                <div className="feature-proof">
                  <span>
                    <MousePointer2 size={16} /> Clickable components
                  </span>
                  <span>
                    <GitBranch size={16} /> Branching discoveries
                  </span>
                  <span>
                    <MessageCircle size={16} /> Contextual explanations
                  </span>
                </div>
              </div>
            </div>
          </section>
          <section className="topics-section">
            <div className="section-title">
              <div>
                <span className="eyebrow mini">THERE’S A WORLD TO UNPACK</span>
                <h2>Where will curiosity take you?</h2>
              </div>
              <span className="quiet">
                Choose a starting point <Compass size={16} />
              </span>
            </div>
            <div className="topic-grid">
              {EXAMPLES.map(({ icon: Icon, ...e }, i) => (
                <button
                  className={`topic-card ${e.color}`}
                  key={e.title}
                  onClick={() => learn(e.question)}
                >
                  <div className="topic-card-top">
                    <span className="topic-icon">
                      <Icon size={26} strokeWidth={1.4} />
                    </span>
                    <ArrowRight size={16} />
                  </div>
                  <span className="topic-tag">
                    0{i + 1} / {e.tag}
                  </span>
                  <h3>{e.title}</h3>
                  <p>{e.question}</p>
                </button>
              ))}
            </div>
          </section>
          <section className="how-section" id="how-it-works">
            <span className="eyebrow mini">FROM “I WONDER” TO “I GET IT”</span>
            <div className="how-grid">
              {[
                {
                  icon: Search,
                  title: "Ask anything",
                  text: "Start with a big question or a small curiosity.",
                },
                {
                  icon: Eye,
                  title: "See the idea",
                  text: "Explore a visual explanation, piece by piece.",
                },
                {
                  icon: GitBranch,
                  title: "Follow the details",
                  text: "Zoom into a component and discover what’s inside.",
                },
                {
                  icon: Sparkles,
                  title: "Make it click",
                  text: "Ask follow-ups. Connect the dots. Keep going.",
                },
              ].map(({ icon: Icon, title, text }, i) => (
                <div key={title} className="how-item">
                  <span className="how-number">0{i + 1}</span>
                  <Icon size={21} />
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              ))}
            </div>
          </section>
          <footer className="site-footer">
            <span>
              <Mark /> Made for the beautifully curious.
            </span>
            <span>
              Powered by Ideogram <span className="footer-plus">+</span> your
              curiosity
            </span>
            <button onClick={() => setModal("settings")}>
              Integration status <ArrowRight size={13} />
            </button>
          </footer>
        </main>
      ) : active ? (
        <main className="workspace">
          <div className="workspace-topbar">
            <div className="breadcrumbs">
              <button onClick={() => setView("home")} aria-label="Return home">
                <Compass size={16} />
              </button>
              <ChevronRight size={13} />
              {parent && (
                <>
                  <button onClick={() => navigate(parent)}>
                    {parent.title}
                  </button>
                  <ChevronRight size={13} />
                </>
              )}
              <span>{active.title}</span>
            </div>
            <div className="workspace-selects">
              <label>
                <span>Level</span>
                <select
                  aria-label="Workspace learning level"
                  value={difficulty}
                  onChange={(e) => {
                    setDifficulty(e.target.value as Difficulty);
                    setNotice("This level applies to your next exploration.");
                  }}
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </label>
              <span className="saved-indicator">
                <Check size={13} /> Saved locally
              </span>
            </div>
          </div>
          <div className="mobile-workspace-tabs">
            <button
              onClick={() =>
                setMobilePanel(mobilePanel === "journey" ? null : "journey")
              }
            >
              <GitBranch size={16} /> Journey
            </button>
            <button
              onClick={() =>
                setMobilePanel(mobilePanel === "details" ? null : "details")
              }
            >
              <BookOpen size={16} /> Explanation
            </button>
          </div>
          <div className="workspace-grid">
            <aside
              className={`journey-panel ${mobilePanel === "journey" ? "mobile-open" : ""}`}
            >
              <div className="panel-heading">
                <span>YOUR LEARNING JOURNEY</span>
                <GitBranch size={16} />
              </div>
              <div className="journey-intro">
                <span className="session-label">
                  <span /> EXPLORATION IN PROGRESS
                </span>
                <h3>
                  {nodes.find(
                    (n) => !n.parentId && isAncestor(n.id, active, nodes),
                  )?.title || active.title}
                </h3>
                <p>{nodes.length} discoveries. Endless possibilities.</p>
              </div>
              <div className="journey-tree">
                {nodes
                  .filter(
                    (n) =>
                      !n.parentId || !nodes.some((o) => o.id === n.parentId),
                  )
                  .map((n) => treeNode(n))}
              </div>
              <div className="journey-bottom">
                <div className="depth-card">
                  <span>
                    <Layers size={15} /> Exploration depth{" "}
                    <strong>{active.depth} / 5</strong>
                  </span>
                  <div className="depth-track">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <i
                        key={n}
                        className={n <= active.depth ? "filled" : ""}
                      />
                    ))}
                  </div>
                  <p>Each layer brings a little more clarity.</p>
                </div>
                <button className="sidebar-action" onClick={exportJourney}>
                  <Download size={15} /> Download journey
                </button>
                <button
                  className="sidebar-action"
                  onClick={() => {
                    setView("home");
                    setQuestion("");
                    setError("");
                  }}
                >
                  <Plus size={15} /> Start a new exploration
                </button>
                {parent && (
                  <button
                    className="sidebar-action"
                    onClick={() => navigate(parent)}
                  >
                    <ArrowLeft size={15} /> Back to parent concept
                  </button>
                )}
              </div>
            </aside>
            <section className="visual-panel">
              <div className="visual-title-row">
                <div>
                  <span className="eyebrow mini">
                    {active.category.toUpperCase()}{" "}
                    <span className="dot-separator">/</span>{" "}
                    {active.difficulty.toUpperCase()}
                  </span>
                  <h1>{active.title}</h1>
                </div>
                <span className={`source-badge ${active.source}`}>
                  {active.source === "demo" ? (
                    <FlaskConical size={12} />
                  ) : (
                    <Sparkles size={12} />
                  )}{" "}
                  {active.source === "demo" ? "Curated demo" : "Ideogram 4.5"}
                </span>
              </div>
              <p className="visual-summary">{active.summary}</p>
              <VisualCanvas
                key={
                  active.id + active.imageUrl + JSON.stringify(active.hotspots)
                }
                node={active}
                selectedId={selectedId}
                onSelect={(id) => {
                  setSelectedId(id);
                  setAnswer(null);
                  if (window.innerWidth < 1000) setMobilePanel("details");
                }}
                onSaveHotspots={updateHotspots}
              />
              <div className="visual-toolbar">
                <div className="style-switch">
                  <Layers size={15} />
                  <select
                    aria-label="Visual style"
                    value={style}
                    disabled={busy}
                    onChange={(e) => {
                      const value = e.target.value as VisualStyle;
                      void request({
                        route: "style",
                        body: { node: active, style: value },
                        replace: true,
                      });
                    }}
                  >
                    {STYLES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="canvas-actions">
                  {selected && active.source === "ideogram" && (
                    <button
                      onClick={() =>
                        void request({
                          route: "style",
                          body: {
                            node: active,
                            style: active.style,
                            edit: true,
                            componentId: selected.id,
                          },
                          replace: true,
                        })
                      }
                    >
                      <WandSparkles size={14} /> Emphasize
                    </button>
                  )}
                  {parent && (
                    <button onClick={() => setModal("compare")}>
                      <Layers size={14} /> Compare
                    </button>
                  )}
                  <span className="quiet">
                    {active.hotspots.length} components
                  </span>
                </div>
              </div>
              <div className="canvas-hint">
                <MousePointer2 size={13} />
                <span>
                  Select a glowing point to meet a component. Drag to pan; use +
                  and − to zoom.
                </span>
              </div>
              <div className="concept-chips">
                {active.components.map((c) => (
                  <button
                    key={c.id}
                    className={selectedId === c.id ? "selected" : ""}
                    onClick={() => {
                      setSelectedId(c.id);
                      setAnswer(null);
                      if (window.innerWidth < 1000) setMobilePanel("details");
                    }}
                  >
                    <span />
                    {c.name}
                    <ChevronRight size={12} />
                  </button>
                ))}
              </div>
              <div className="educational-note">
                <CircleHelp size={13} />
                <p>
                  {active.caveats[0] ||
                    "Illustrations simplify complex systems. Generated images and AI explanations may contain inaccuracies."}
                </p>
              </div>
            </section>
            <aside
              ref={explanationPanel}
              className={`explanation-panel ${mobilePanel === "details" ? "mobile-open" : ""}`}
            >
              <div className="panel-heading">
                <span>
                  {selected ? "COMPONENT EXPLORER" : "THE BIG PICTURE"}
                </span>
                <BookOpen size={16} />
                {mobilePanel && (
                  <button
                    className="icon-button mobile-close"
                    onClick={() => setMobilePanel(null)}
                    aria-label="Close explanation"
                  >
                    <X size={17} />
                  </button>
                )}
              </div>
              <div className="explanation-content">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={selectedId || active.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                  >
                    <div className="component-symbol">
                      {selected ? <Cpu size={27} /> : <Atom size={29} />}
                    </div>
                    <span className="eyebrow mini">
                      {selected
                        ? "ONE PIECE OF THE PICTURE"
                        : "LET’S CONNECT THE DOTS"}
                    </span>
                    <h2>{selected?.name || "How it all works"}</h2>
                    <p className="component-description">
                      {selected?.description || active.explanation}
                    </p>
                    {selected ? (
                      <>
                        <div className="function-card">
                          <span>
                            <Zap size={13} /> ITS SUPERPOWER
                          </span>
                          <p>{selected.function}</p>
                        </div>
                        <h4>Look a little closer</h4>
                        <p className="detail-text">{selected.details}</p>
                        <h4>Connected to</h4>
                        <div className="relationships">
                          {active.relationships
                            .filter(
                              (r) =>
                                r.from === selected.id || r.to === selected.id,
                            )
                            .map((r, i) => (
                              <p key={i}>
                                <GitBranch size={12} />
                                {r.description}
                              </p>
                            ))}
                        </div>
                        <Button
                          className="explore-deeper"
                          disabled={busy || active.depth >= 5}
                          onClick={() => explore(selected)}
                        >
                          <Sparkles size={16} /> Explore deeper{" "}
                          <ArrowRight size={16} />
                        </Button>
                        <p className="button-footnote">
                          {active.depth >= 5
                            ? "Maximum exploration depth reached"
                            : "A new perspective, one level deeper"}
                        </p>
                      </>
                    ) : (
                      <>
                        <h4>What you’ll discover</h4>
                        <ul className="learning-objectives">
                          {active.objectives.map((o) => (
                            <li key={o}>
                              <Check size={13} />
                              {o}
                            </li>
                          ))}
                        </ul>
                        <div className="select-hint">
                          <MousePointer2 size={17} />
                          <p>
                            Choose a component in the diagram to explore its
                            part in the story.
                          </p>
                        </div>
                      </>
                    )}
                  </motion.div>
                </AnimatePresence>
                <div className="tutor-section">
                  <div className="tutor-heading">
                    <span>
                      <Sparkles size={16} /> A little more curious?
                    </span>
                    <span className="mini-badge">
                      {active.source === "demo" ? "DEMO" : "AI TUTOR"}
                    </span>
                  </div>
                  {!answer && (
                    <div className="follow-ups">
                      {active.followUps.map((q) => (
                        <button
                          key={q}
                          onClick={() => void ask(q)}
                          disabled={tutorBusy}
                        >
                          {q}
                          <ArrowRight size={12} />
                        </button>
                      ))}
                    </div>
                  )}
                  {answer && (
                    <div className="tutor-answer" aria-live="polite">
                      <span>
                        {answer.demo
                          ? "PREDEFINED DEMO EXPLANATION"
                          : "CONTEXTUAL AI EXPLANATION"}
                      </span>
                      <p>{answer.answer}</p>
                      <div className="answer-actions">
                        <button
                          onClick={() => void ask(answeredQuestion, true)}
                          disabled={tutorBusy}
                        >
                          Explain simply
                        </button>
                        <button
                          onClick={() =>
                            void request({
                              route: "visualize",
                              body: {
                                node: active,
                                question: answeredQuestion,
                              },
                            })
                          }
                          disabled={busy}
                        >
                          <Eye size={12} /> Show me visually
                        </button>
                      </div>
                      {answer.suggestions?.slice(0, 2).map((q) => (
                        <button
                          className="answer-follow"
                          key={q}
                          onClick={() => void ask(q)}
                        >
                          {q}
                          <ChevronRight size={12} />
                        </button>
                      ))}
                    </div>
                  )}
                  <form
                    className="tutor-input"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void ask();
                    }}
                  >
                    <input
                      value={tutorQuestion}
                      onChange={(e) => setTutorQuestion(e.target.value)}
                      placeholder="Ask about this diagram…"
                      aria-label="Ask a follow-up question"
                      maxLength={1000}
                    />
                    <button
                      type="submit"
                      disabled={!tutorQuestion.trim() || tutorBusy}
                      aria-label="Ask tutor"
                    >
                      {tutorBusy ? (
                        <LoaderCircle size={17} className="spin" />
                      ) : (
                        <ArrowRight size={17} />
                      )}
                    </button>
                  </form>
                  {active.source === "demo" && (
                    <p className="demo-tutor-note">
                      Demo answers are predefined. Live mode uses your
                      configured AI provider.
                    </p>
                  )}
                </div>
              </div>
            </aside>
          </div>
        </main>
      ) : (
        <main className="empty-state">
          <BookOpen size={40} />
          <h2>Your next discovery is waiting.</h2>
          <Button onClick={() => setView("home")}>Start exploring</Button>
        </main>
      )}
      <AnimatePresence>
        {busy && (
          <motion.div
            className="generation-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="status"
            aria-live="polite"
          >
            <div className="generation-card">
              <div className="generation-orbit">
                <Atom size={42} />
                <i />
                <i />
              </div>
              <span className="eyebrow mini">CURIOSITY IS TAKING SHAPE</span>
              <h2>
                {mode === "demo"
                  ? "Opening your visual exploration"
                  : "Making the invisible visible"}
              </h2>
              <p>
                {
                  [
                    "Building an educational explanation…",
                    "Creating your illustration with Ideogram…",
                    "Mapping the details for you to explore…",
                  ][mode === "demo" ? 0 : progress]
                }
              </p>
              <div className="progress-steps">
                {[0, 1, 2].map((i) => (
                  <span key={i} className={i <= progress ? "active" : ""} />
                ))}
              </div>
              <button
                className="cancel-generation"
                onClick={() => abort.current?.abort()}
              >
                <Square size={11} /> Cancel
              </button>
              <p className="generation-disclaimer">
                {mode === "demo"
                  ? "Opening a curated demo. No API credits used."
                  : "A detailed illustration can take a minute. Canceling may not stop a provider request already in progress."}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {error && (
        <div className="error-toast" role="alert">
          <CircleHelp size={20} />
          <div>
            <strong>We hit a little roadblock</strong>
            <p>{error}</p>
          </div>
          {retryAction && (
            <button onClick={() => void request(retryAction)}>Retry</button>
          )}
          <button
            className="icon-button"
            onClick={() => setError("")}
            aria-label="Dismiss error"
          >
            <X size={17} />
          </button>
        </div>
      )}
      {notice && (
        <div className="notice-toast" role="status">
          <Check size={17} />
          {notice}
        </div>
      )}
      {modal === "library" && (
        <Modal title="Your discovery library" onClose={closeModal}>
          <p className="modal-intro">
            Saved in this browser. Pick up anywhere.
          </p>
          {!nodes.length ? (
            <div className="library-empty">
              <Library size={32} />
              <p>Your first exploration will appear here.</p>
              <Button
                onClick={() => {
                  setModal(null);
                  learn(EXAMPLES[0].question);
                }}
              >
                Try the engine demo <ArrowRight size={15} />
              </Button>
            </div>
          ) : (
            <>
              <div className="library-grid">
                {nodes.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => {
                      navigate(n);
                      setModal(null);
                    }}
                  >
                    <Image
                      unoptimized
                      width={1200}
                      height={900}
                      src={n.imageUrl}
                      alt=""
                      loading="lazy"
                    />
                    <div>
                      <span>
                        {n.category} · Level {n.depth}
                      </span>
                      <h3>{n.title}</h3>
                      <p>
                        {n.source === "demo"
                          ? "Curated demo"
                          : "Generated with Ideogram"}
                      </p>
                    </div>
                    <ArrowRight size={16} />
                  </button>
                ))}
              </div>
              <div className="modal-footer">
                <button className="text-link" onClick={exportJourney}>
                  <Download size={15} /> Download journey
                </button>
                <button
                  className="danger-link"
                  onClick={() => {
                    setNodes([]);
                    setActiveId("");
                    setModal(null);
                    setView("home");
                    setNotice("Saved journey cleared.");
                  }}
                >
                  Clear saved journey
                </button>
              </div>
            </>
          )}
        </Modal>
      )}
      {modal === "settings" && (
        <Modal title="Your visual learning studio" onClose={closeModal}>
          <p className="modal-intro">
            Demo mode works immediately. Live mode uses server-side credentials
            for new explanations and illustrations.
          </p>
          <div className="integration-list">
            {[
              {
                name: "Ideogram 4.5",
                detail: "Educational illustrations & precise editing",
                key: "ideogram",
              },
              {
                name: "Learning AI",
                detail: "Explanations & contextual questions",
                key: "tutor",
              },
              {
                name: "Vision mapping",
                detail: "Image-grounded component placement",
                key: "vision",
              },
            ].map((i) => (
              <div key={i.name}>
                <span className="integration-icon">
                  <Sparkles size={19} />
                </span>
                <div>
                  <h3>{i.name}</h3>
                  <p>{i.detail}</p>
                </div>
                <span
                  className={
                    integrationFlag(health, i.key)
                      ? "ready-badge"
                      : "missing-badge"
                  }
                >
                  {integrationFlag(health, i.key)
                    ? "Configured"
                    : "Needs setup"}
                </span>
              </div>
            ))}
          </div>
          <p className="settings-note">
            Configure credentials on the server. Without a vision model, use the
            canvas editor to place component labels on generated images.
          </p>
          <div className="mode-options">
            {(["demo", "live"] as const).map((m) => (
              <button
                className={mode === m ? "chosen" : ""}
                key={m}
                onClick={() => setMode(m)}
              >
                {m === "demo" ? <FlaskConical size={20} /> : <Zap size={20} />}
                <strong>
                  {m === "demo" ? "Curated demo" : "Live generation"}
                </strong>
                <span>
                  {m === "demo"
                    ? "Original diagrams. Predefined content."
                    : "New images and explanations through your APIs."}
                </span>
                {mode === m && <Check size={16} />}
              </button>
            ))}
          </div>
          <div className="modal-footer">
            <span className="quiet">Credentials stay on the server.</span>
            <Button onClick={closeModal}>
              Done <Check size={15} />
            </Button>
          </div>
        </Modal>
      )}
      {modal === "pricing" && (
        <Modal title="Keep your curiosity going" onClose={closeModal}>
          <p className="modal-intro">
            {billing.testMode ? "Try a test subscription. No real money will be charged." : "A monthly plan for deeper visual learning."}
          </p>
          <div className="pricing-card">
            <span className="eyebrow mini">
              <Zap size={13} /> EXPLAINIT PRO
            </span>
            <h3>
              {billing.active
                ? "Your subscription is active"
                : billing.price
                  ? `${new Intl.NumberFormat("en", { style: "currency", currency: billing.price.currency.toUpperCase() }).format(billing.price.amount / 100)} / month`
                  : "Monthly membership"}
            </h3>
            <p>
              {billing.testMode ? "Test checkout, subscription status, and cancellation. Live AI generation is reserved for the site owner during testing." : "Explore with live Ideogram illustrations and a contextual AI tutor."}
            </p>
            <ul>
              <li>
                <Check size={16} /> Detailed illustrations in six visual styles
              </li>
              <li>
                <Check size={16} /> Guided exploration up to five levels deep
              </li>
              <li>
                <Check size={16} /> Contextual follow-up questions
              </li>
              <li>
                <Check size={16} /> Manage or cancel through Stripe
              </li>
            </ul>
            <Button
              className="visualize-button"
              onClick={() => void checkout(Boolean(billing.active) || Boolean(billing.canManage) && !["canceled", "incomplete_expired"].includes(String(billing.status)))}
              disabled={!billing.configured || billingBusy}
            >
              {billingBusy ? "Opening Stripe…" : billing.active || Boolean(billing.canManage) && !["canceled", "incomplete_expired"].includes(String(billing.status))
                ? "Manage subscription"
                : billing.configured
                  ? billing.testMode ? "Try test checkout" : "Subscribe with Stripe"
                  : "Stripe setup required"}
              <ArrowRight size={16} />
            </Button>
            <p className="pricing-footnote">
              {billing.testMode && billing.configured ? "Use Stripe test payment details only. This test plan renews monthly until canceled; it does not unlock public AI generation." : billing.configured
                ? "Secure checkout hosted by Stripe. API usage limits apply."
                : "Checkout becomes available when the owner configures a monthly Stripe price, webhook, and billing secrets. The demo is free to explore."}
            </p>
          </div>
        </Modal>
      )}
      {modal === "compare" && active && parent && (
        <Modal
          title="Two perspectives. One connected idea."
          onClose={closeModal}
        >
          <div className="comparison-grid">
            {[parent, active].map((n) => (
              <div key={n.id}>
                <Image
                  unoptimized
                  width={1200}
                  height={900}
                  src={n.imageUrl}
                  alt={n.title}
                />
                <span className="eyebrow mini">LEVEL {n.depth}</span>
                <h3>{n.title}</h3>
                <p>{n.summary}</p>
                <button
                  className="text-link"
                  onClick={() => {
                    navigate(n);
                    setModal(null);
                  }}
                >
                  Explore this view <ArrowRight size={14} />
                </button>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}

function VisualCanvas({
  node,
  selectedId,
  onSelect,
  onSaveHotspots,
}: {
  node: LearningNode;
  selectedId: string;
  onSelect: (id: string) => void;
  onSaveHotspots: (spots: Hotspot[]) => void;
}) {
  const [zoom, setZoom] = useState(1),
    [pan, setPan] = useState({ x: 0, y: 0 }),
    [annotations, setAnnotations] = useState(true),
    [editor, setEditor] = useState(false),
    [mappingId, setMappingId] = useState(""),
    [spots, setSpots] = useState(node.hotspots),
    [ratio, setRatio] = useState(4 / 3),
    [imageError, setImageError] = useState(false);
  const stage = useRef<HTMLDivElement>(null),
    [fit, setFit] = useState({ w: 600, h: 450 });
  const container = useRef<HTMLDivElement>(null),
    surface = useRef<HTMLDivElement>(null),
    drag = useRef<{ x: number; y: number; px: number; py: number } | null>(
      null,
    ),
    moved = useRef(false);

  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    const fitImage = () => {
      const w = Math.min(element.clientWidth, element.clientHeight * ratio);
      setFit({ w, h: w / ratio });
    };
    fitImage();
    const observer = new ResizeObserver(fitImage);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ratio, node.id]);
  function selectSpot(h: Hotspot) {
    onSelect(h.componentId);
    setZoom(1.2);
    setPan({ x: (0.5 - h.x) * 100, y: (0.5 - h.y) * 70 });
  }
  function place(e: React.MouseEvent<HTMLDivElement>) {
    if (!editor || !mappingId || moved.current) return;
    const rect = surface.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    setSpots((list) => [
      ...list.filter((s) => s.componentId !== mappingId),
      { componentId: mappingId, x, y, confidence: 1 },
    ]);
    setMappingId("");
  }
  return (
    <div
      className={`canvas ${node.style} ${editor ? "editing" : ""}`}
      ref={container}
    >
      <div className="canvas-grid" />
      <div className="canvas-top">
        <span>
          <span className="tiny-dot" />
          {editor ? "MANUAL COMPONENT MAPPING" : "INTERACTIVE EXPLORATION"}
        </span>
        <button
          onClick={() => setAnnotations(!annotations)}
          aria-label={annotations ? "Hide annotations" : "Show annotations"}
        >
          {annotations ? <Eye size={15} /> : <EyeOff size={15} />}
        </button>
      </div>
      <div
        className="canvas-stage"
        ref={stage}
        onPointerDown={(e) => {
          if (
            editor ||
            (e.target instanceof Element && e.target.closest("button"))
          )
            return;
          drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
          moved.current = false;
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const dx = e.clientX - drag.current.x,
            dy = e.clientY - drag.current.y;
          if (Math.abs(dx) + Math.abs(dy) > 5) moved.current = true;
          setPan({ x: drag.current.px + dx, y: drag.current.py + dy });
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        <div
          className="canvas-image-wrap"
          ref={surface}
          onClick={place}
          style={{
            width: fit.w,
            height: fit.h,
            aspectRatio: ratio,
            transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`,
          }}
        >
          {!imageError ? (
            <Image
              unoptimized
              width={1200}
              height={900}
              src={node.imageUrl}
              alt={`${node.title}. ${node.summary}`}
              draggable={false}
              onLoad={(e) =>
                setRatio(
                  e.currentTarget.naturalWidth / e.currentTarget.naturalHeight,
                )
              }
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="image-error">
              <CircleHelp size={30} />
              <p>
                This illustration could not load. Generate it again or return to
                another discovery.
              </p>
            </div>
          )}
          {(annotations || editor) &&
            spots.map((h, i) => {
              const c = node.components.find((c) => c.id === h.componentId);
              if (!c) return null;
              return (
                <button
                  key={h.componentId}
                  className={`hotspot ${selectedId === h.componentId ? "selected" : ""} ${h.x > 0.7 ? "align-right" : ""}`}
                  style={{ left: `${h.x * 100}%`, top: `${h.y * 100}%` }}
                  aria-label={`Explore ${c.name}`}
                  aria-pressed={selectedId === h.componentId}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!editor) selectSpot(h);
                  }}
                >
                  <span className="hotspot-point">
                    <span>{i + 1}</span>
                  </span>
                  <span className="hotspot-label">
                    {c.name}
                    <ChevronRight size={11} />
                  </span>
                </button>
              );
            })}
        </div>
      </div>
      <div className="canvas-bottom">
        <div className="zoom-controls">
          <button
            aria-label="Zoom out"
            onClick={() => setZoom((z) => Math.max(0.7, z - 0.2))}
          >
            <Minus size={16} />
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button
            aria-label="Zoom in"
            onClick={() => setZoom((z) => Math.min(3, z + 0.2))}
          >
            <Plus size={16} />
          </button>
          <i />
          <button
            aria-label="Reset canvas view"
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
          >
            <RotateCcw size={15} />
          </button>
        </div>
        <div className="canvas-right-controls">
          <button
            onClick={() => {
              setEditor(!editor);
              setZoom(1);
              setPan({ x: 0, y: 0 });
              moved.current = false;
              setMappingId("");
            }}
            className={editor ? "selected" : ""}
          >
            <MousePointer2 size={13} />
            {editor ? "Close editor" : "Map components"}
          </button>
          <button
            aria-label="Toggle fullscreen"
            onClick={() => {
              if (document.fullscreenElement) void document.exitFullscreen();
              else void container.current?.requestFullscreen();
            }}
          >
            <Maximize2 size={16} />
          </button>
        </div>
      </div>
      {editor && (
        <div className="hotspot-editor">
          <div>
            <strong>Place component labels</strong>
            <span>
              Select a component, then click its location on the illustration.
            </span>
          </div>
          <div className="editor-components">
            {node.components.map((c) => (
              <button
                key={c.id}
                className={mappingId === c.id ? "selected" : ""}
                onClick={() => {
                  setMappingId(c.id);
                  moved.current = false;
                }}
              >
                {spots.some((s) => s.componentId === c.id) && (
                  <Check size={11} />
                )}{" "}
                {c.name}
              </button>
            ))}
          </div>
          <button
            className="save-hotspots"
            onClick={() => {
              onSaveHotspots(spots);
              setEditor(false);
            }}
          >
            <Check size={13} /> Save positions
          </button>
        </div>
      )}
    </div>
  );
}
function isAncestor(
  id: string,
  node: LearningNode,
  list: LearningNode[],
): boolean {
  let current: LearningNode | undefined = node;
  const visited = new Set<string>();
  while (current && !visited.has(current.id)) {
    if (current.id === id) return true;
    visited.add(current.id);
    current = list.find((n) => n.id === current?.parentId);
  }
  return false;
}
function integrationFlag(
  health: Record<string, unknown>,
  key: string,
): boolean {
  const v = health[key];
  if (typeof v === "boolean") return v;
  if (v && typeof v === "object" && "configured" in v)
    return Boolean((v as { configured: unknown }).configured);
  const integrations = health.integrations as
    | Record<string, unknown>
    | undefined;
  const nested = integrations?.[key];
  return typeof nested === "boolean"
    ? nested
    : Boolean(
        nested &&
          typeof nested === "object" &&
          "configured" in nested &&
          (nested as { configured: unknown }).configured,
      );
}
function errorMessage(d: { error?: unknown; message?: string }): string {
  if (typeof d.error === "string") return d.error;
  if (d.error && typeof d.error === "object" && "message" in d.error)
    return String(d.error.message);
  return d.message || "Please try again in a moment.";
}
