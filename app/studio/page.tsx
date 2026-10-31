"use client";
/* Full document navigation avoids duplicate React context in the Worker preview. */
/* eslint-disable @next/next/no-html-link-for-pages */

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Atom,
  Check,
  Clock3,
  Download,
  ImageIcon,
  Layers,
  LoaderCircle,
  Sparkles,
  Square,
  WandSparkles,
} from "lucide-react";
import type { VisualStyle } from "@/lib/types";
import "./studio.css";

type Illustration = {
  id: string;
  imageUrl: string;
  question: string;
  style: VisualStyle;
  createdAt: string;
  source: "ideogram";
  note?: string;
};
const STORAGE = "explainit.illustration-studio.v1";
const STYLES: { id: VisualStyle; label: string; description: string }[] = [
  {
    id: "scientific",
    label: "Scientific illustration",
    description: "Clear cutaways and technical detail.",
  },
  {
    id: "isometric",
    label: "Isometric 3D",
    description: "A fresh perspective on how things fit.",
  },
  {
    id: "blueprint",
    label: "Engineering blueprint",
    description: "Precise lines and a technical sensibility.",
  },
  {
    id: "textbook",
    label: "Textbook illustration",
    description: "An approachable, familiar visual style.",
  },
  {
    id: "sketch",
    label: "Hand-drawn sketch",
    description: "Ideas expressed through expressive linework.",
  },
  {
    id: "futuristic",
    label: "Futuristic visualization",
    description: "Luminous detail with a forward-looking feel.",
  },
];
const EXAMPLE = "/demo/engine-ideogram.png";
function safeImage(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\")
  );
}
function isIllustration(value: unknown): value is Illustration {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    safeImage(item.imageUrl) &&
    typeof item.question === "string" &&
    typeof item.createdAt === "string" &&
    item.source === "ideogram" &&
    STYLES.some((style) => style.id === item.style)
  );
}
function message(value: unknown) {
  if (value && typeof value === "object") {
    const data = value as { error?: unknown; message?: unknown };
    if (typeof data.error === "string") return data.error;
    if (typeof data.message === "string") return data.message;
    if (
      data.error &&
      typeof data.error === "object" &&
      "message" in data.error &&
      typeof data.error.message === "string"
    )
      return data.error.message;
  }
  return "Your illustration could not be created. Please try again.";
}

export default function IllustrationStudio() {
  const [question, setQuestion] = useState("");
  const [style, setStyle] = useState<VisualStyle>("scientific");
  const [result, setResult] = useState<Illustration | null>(null);
  const [history, setHistory] = useState<Illustration[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [imageError, setImageError] = useState(false);
  const sessionId = useRef("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    sessionId.current = crypto.randomUUID();
    const timer = window.setTimeout(() => {
      try {
        const saved: unknown = JSON.parse(
          localStorage.getItem(STORAGE) || "[]",
        );
        if (Array.isArray(saved)) {
          const valid = saved.filter(isIllustration).slice(0, 12);
          setHistory(valid);
          if (valid.length) setResult(valid[0]);
        }
      } catch {
        /* A damaged local history starts an empty studio. */
      }
      setHydrated(true);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE, JSON.stringify(history));
    } catch {
      /* Image files remain on the server if local history is full. */
    }
  }, [history, hydrated]);
  useEffect(() => {
    if (!busy) return;
    const timer = window.setInterval(
      () => setElapsed((value) => value + 1),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [busy]);

  async function generate() {
    if (!question.trim() || controller.current) return;
    const requestController = new AbortController();
    controller.current = requestController;
    setBusy(true);
    setElapsed(0);
    setError("");
    setStatus("");
    try {
      const response = await fetch("/api/illustrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: question.trim(),
          style,
          difficulty: "beginner",
          sessionId: sessionId.current || crypto.randomUUID(),
        }),
        signal: requestController.signal,
      });
      const data: unknown = await response.json();
      if (!response.ok) throw new Error(message(data));
      if (!isIllustration(data))
        throw new Error(
          "The illustration service returned an incomplete response. Please try again.",
        );
      setResult(data);
      setImageError(false);
      setHistory((previous) =>
        [data, ...previous.filter((item) => item.id !== data.id)].slice(0, 12),
      );
      setStatus("Your illustration is ready.");
    } catch (caught) {
      if (requestController.signal.aborted) setStatus("Generation canceled.");
      else
        setError(
          caught instanceof Error
            ? caught.message
            : "Your illustration could not be created. Please try again.",
        );
    } finally {
      if (controller.current === requestController) {
        controller.current = null;
        setBusy(false);
      }
    }
  }
  function openIllustration(item: Illustration) {
    setResult(item);
    setQuestion(item.question);
    setStyle(item.style);
    setImageError(false);
    setError("");
    setStatus("");
  }
  const selectedStyle = STYLES.find((item) => item.id === style)!;
  const imageUrl = result?.imageUrl || EXAMPLE;
  return (
    <div className="studio-page">
      <header className="site-header studio-header">
        <a href="/" className="brand" aria-label="ExplainIt Visually home">
          <span className="brand-mark">
            <Atom size={23} strokeWidth={1.8} />
          </span>
          <span>
            ExplainIt<span className="brand-light"> Visually</span>
            <span className="beta">LAB</span>
          </span>
        </a>
        <span className="studio-header-label">
          <ImageIcon size={14} /> ILLUSTRATION STUDIO
        </span>
        <a href="/" className="studio-back-link">
          <ArrowLeft size={14} /> Back to learning
        </a>
      </header>
      <main className="studio-main">
        <div className="studio-intro">
          <div className="studio-eyebrow">
            <span /> IDEAS, BROUGHT INTO FOCUS
          </div>
          <h1>
            A question.
            <br className="studio-mobile-break" /> One clear <em>picture.</em>
          </h1>
          <p>
            Give your curiosity a visual starting point. Create an illustration
            <br className="studio-desktop-break" /> directly with Ideogram, in a
            style that speaks to you.
          </p>
        </div>
        <div className="studio-grid">
          <section
            className="studio-compose"
            aria-label="Create an illustration"
          >
            <div className="studio-section-label">
              <span>01 / THE IDEA</span>
              <WandSparkles size={16} />
            </div>
            <h2>What would you like to see?</h2>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void generate();
              }}
            >
              <label htmlFor="studio-question" className="studio-input-label">
                Your question or visual idea
              </label>
              <textarea
                id="studio-question"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="How does a combustion engine turn fuel into motion?"
                maxLength={1000}
                rows={5}
                required
                disabled={busy}
              />
              <div className="studio-input-meta">
                <span>Be curious. Be specific.</span>
                <span>{question.length} / 1,000</span>
              </div>
              <label
                htmlFor="studio-style"
                className="studio-input-label studio-style-label"
              >
                <Layers size={14} /> Visual style
              </label>
              <select
                id="studio-style"
                value={style}
                onChange={(event) =>
                  setStyle(event.target.value as VisualStyle)
                }
                disabled={busy}
              >
                {STYLES.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
              <p className="studio-style-description">
                {selectedStyle.description}
              </p>
              <button
                className="studio-generate"
                disabled={busy || !question.trim()}
                type="submit"
              >
                {busy ? (
                  <LoaderCircle className="spin" size={17} />
                ) : (
                  <Sparkles size={17} />
                )}{" "}
                {busy ? "Creating your illustration…" : "Generate illustration"}
                <ArrowRight size={17} />
              </button>
              <p className="studio-charge-note">
                Uses your connected Ideogram API. Each generation may incur
                provider charges.
              </p>
            </form>
            {error && (
              <div className="studio-error" role="alert">
                <strong>We couldn’t create that illustration.</strong>
                <p>{error}</p>
                <button
                  disabled={busy || !question.trim()}
                  onClick={() => void generate()}
                >
                  Try again <ArrowRight size={13} />
                </button>
              </div>
            )}
            {status && !busy && (
              <p className="studio-status" role="status">
                <Check size={14} />
                {status}
              </p>
            )}
            <div className="studio-scope">
              <ImageIcon size={18} />
              <div>
                <strong>Illustration only</strong>
                <p>
                  No tutor or verified explanation. AI-generated images can
                  contain inaccuracies, including incorrect scientific details.
                </p>
                <a href="/">
                  Explore interactive learning <ArrowRight size={12} />
                </a>
              </div>
            </div>
          </section>
          <section className="studio-result" aria-label="Illustration preview">
            <div className="studio-preview-heading">
              <span>
                <span className="studio-live-dot" />
                {result ? "YOUR ILLUSTRATION" : "FROM THE STUDIO"}
              </span>
              <span>IDEOGRAM 4.5</span>
            </div>
            <div className={`studio-artwork ${busy ? "studio-working" : ""}`}>
              {!imageError ? (
                <Image
                  src={imageUrl}
                  alt={
                    result?.question ||
                    "Example generated with Ideogram 4.5: a stylized cutaway of a combustion engine"
                  }
                  width={1024}
                  height={1024}
                  unoptimized
                  priority
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="studio-image-error">
                  <ImageIcon size={35} />
                  <h3>The saved image couldn’t load.</h3>
                  <p>
                    You can open the original file using the download link
                    below.
                  </p>
                </div>
              )}
              {busy && (
                <div
                  className="studio-progress"
                  role="status"
                  aria-live="polite"
                >
                  <div className="studio-progress-orbit">
                    <Sparkles size={28} />
                  </div>
                  <h3>
                    {elapsed < 12
                      ? "Bringing your idea into view"
                      : "Good details take a moment"}
                  </h3>
                  <p>Ideogram is creating your illustration.</p>
                  <span className="studio-elapsed">
                    <Clock3 size={12} />
                    {elapsed}s elapsed
                  </span>
                  <button onClick={() => controller.current?.abort()}>
                    <Square size={11} /> Cancel generation
                  </button>
                </div>
              )}
            </div>
            <div className="studio-result-caption">
              <div>
                <span className="studio-result-tag">
                  {result
                    ? STYLES.find((item) => item.id === result.style)?.label
                    : "EXAMPLE · GENERATED WITH IDEOGRAM 4.5"}
                </span>
                <h2>
                  {result?.question || "A look inside the combustion engine"}
                </h2>
                <p>
                  {result?.note ||
                    "A real, pre-generated illustration. Its scientific depiction has not been independently verified."}
                </p>
              </div>
              <a
                href={imageUrl}
                download={
                  result
                    ? `explainit-${result.id}.png`
                    : "explainit-engine-example.png"
                }
                aria-label="Download illustration"
                className="studio-download"
              >
                <Download size={17} />
                <span>Download</span>
              </a>
            </div>
          </section>
        </div>
        {history.length > 0 && (
          <section className="studio-history">
            <div className="studio-history-heading">
              <div>
                <span className="studio-eyebrow">A TRAIL OF CURIOSITY</span>
                <h2>Your recent illustrations</h2>
              </div>
              <button
                disabled={busy}
                onClick={() => {
                  setHistory([]);
                  setStatus("Local illustration history cleared.");
                }}
              >
                Clear history
              </button>
            </div>
            <div className="studio-history-grid">
              {history.map((item) => (
                <button
                  key={item.id}
                  className={
                    result?.id === item.id ? "studio-history-selected" : ""
                  }
                  onClick={() => openIllustration(item)}
                  disabled={busy}
                >
                  <Image
                    src={item.imageUrl}
                    alt={item.question}
                    width={280}
                    height={280}
                    unoptimized
                  />
                  <div>
                    <span>
                      {STYLES.find((entry) => entry.id === item.style)?.label}
                    </span>
                    <h3>{item.question}</h3>
                  </div>
                </button>
              ))}
            </div>
            <p className="studio-history-note">
              The latest 12 illustrations are remembered in this browser.
            </p>
          </section>
        )}
        <footer className="studio-footer">
          <span>
            <Atom size={15} /> Made for the beautifully curious.
          </span>
          <span>Illustration only · no tutor or verified explanation</span>
        </footer>
      </main>
    </div>
  );
}
