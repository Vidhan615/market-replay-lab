import { useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  Clock3,
  ExternalLink,
  GraduationCap,
  Lightbulb,
} from "lucide-react";
import { lessons, resources } from "./lessons";
import type { Session } from "./types";
import type { Mutate } from "./Trading";
import Modal from "./Modal";
import { rupee } from "./format";

export default function Learn({
  session,
  mutate,
}: {
  session: Session;
  mutate: Mutate;
}) {
  const [track, setTrack] = useState("All lessons"),
    [open, setOpen] = useState<string | null>(null),
    [hinglish, setHinglish] = useState(true);
  const lesson = lessons.find((l) => l.id === open),
    completed = lessons.filter((l) =>
      session.completedLessons.includes(l.id),
    ).length,
    answer = lesson ? session.quizAnswers[lesson.id] : undefined;
  const [capital, setCapital] = useState(100000),
    [risk, setRisk] = useState(1),
    [entry, setEntry] = useState(200),
    [stop, setStop] = useState(190),
    [earnings, setEarnings] = useState(500),
    [shares, setShares] = useState(100),
    [stockPrice, setStockPrice] = useState(100);
  const riskCash = (capital * risk) / 100,
    distance = entry - stop,
    qty =
      distance > 0
        ? Math.max(
            0,
            Math.min(
              Math.floor(riskCash / distance),
              Math.floor(capital / entry),
            ),
          )
        : 0,
    eps = shares > 0 ? earnings / shares : 0;
  return (
    <div className="learn-page">
      <div className="learning-banner">
        <div>
          <span className="eyebrow">THE LEARNING ROOM</span>
          <h1>
            Build conviction.
            <br />
            <span>One concept at a time.</span>
          </h1>
          <p>
            Understand the chart. Read the business. Manage the risk.
            <br />
            Then put it into practice in your replay workspace.
          </p>
          <button
            className="primary-button"
            onClick={() =>
              setOpen(
                lessons.find((l) => !session.completedLessons.includes(l.id))
                  ?.id ?? lessons[0].id,
              )
            }
          >
            {completed ? "Continue learning" : "Start with the basics"}
            <ArrowRight size={17} />
          </button>
        </div>
        <div className="learning-orbit">
          <GraduationCap size={52} />
          <strong>
            {completed}
            <span> / {lessons.length}</span>
          </strong>
          <span>lessons completed</span>
          <div className="progress">
            <i style={{ width: `${(completed / lessons.length) * 100}%` }} />
          </div>
        </div>
      </div>
      <div className="page-section-title">
        <div>
          <h2>A practical path to market literacy</h2>
          <p>Short lessons, worked examples and a quick knowledge check.</p>
        </div>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={hinglish}
            onChange={(e) => setHinglish(e.target.checked)}
          />
          Hinglish notes
        </label>
      </div>
      <div className="filter-tabs">
        {["All lessons", "Foundations", "Technical", "Fundamental", "Risk"].map(
          (t) => (
            <button
              className={track === t ? "active" : ""}
              key={t}
              onClick={() => setTrack(t)}
            >
              {t}
            </button>
          ),
        )}
      </div>
      <div className="lesson-grid">
        {lessons
          .filter((l) => track === "All lessons" || l.track === track)
          .map((l, i) => (
            <button
              className="panel lesson-card"
              key={l.id}
              onClick={() => setOpen(l.id)}
            >
              <div>
                <span className={`lesson-track ${l.track.toLowerCase()}`}>
                  {l.track}
                </span>
                {session.completedLessons.includes(l.id) ? (
                  <CheckCircle2 size={19} className="positive" />
                ) : (
                  <span className="lesson-number">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                )}
              </div>
              <h3>{l.title}</h3>
              <p>{l.summary}</p>
              <footer>
                <span>
                  <Clock3 size={13} />
                  {l.minutes} min
                </span>
                <ArrowRight size={18} />
              </footer>
            </button>
          ))}
      </div>
      <div className="page-section-title">
        <div>
          <h2>Make the numbers click</h2>
          <p>Change an assumption and see what it does.</p>
        </div>
        <Lightbulb size={21} className="accent" />
      </div>
      <div className="calculator-grid">
        <section className="panel calculator">
          <h3>Risk-based position sizing</h3>
          <p>Size the position from the amount you can lose.</p>
          <div className="field-row">
            <label>
              Capital (₹)
              <input
                type="number"
                min="0"
                value={capital}
                onChange={(e) =>
                  setCapital(Math.max(0, Number(e.target.value)))
                }
              />
            </label>
            <label>
              Risk budget (%)
              <input
                type="number"
                min="0"
                max="100"
                step=".1"
                value={risk}
                onChange={(e) =>
                  setRisk(Math.min(100, Math.max(0, Number(e.target.value))))
                }
              />
            </label>
          </div>
          <div className="field-row">
            <label>
              Entry (₹)
              <input
                type="number"
                min=".01"
                value={entry}
                onChange={(e) => setEntry(Math.max(0, Number(e.target.value)))}
              />
            </label>
            <label>
              Stop-loss (₹)
              <input
                type="number"
                min=".01"
                value={stop}
                onChange={(e) => setStop(Math.max(0, Number(e.target.value)))}
              />
            </label>
          </div>
          <div className="calculator-result">
            <span>
              {distance > 0 && entry > 0
                ? "Maximum whole shares"
                : "Set entry above stop"}
            </span>
            <strong>{Number.isFinite(qty) ? qty : 0}</strong>
          </div>
          <small>
            {rupee(riskCash)} risk budget ÷ {rupee(Math.max(0, distance))} per
            share, capped by available capital. Excludes costs and gaps.
          </small>
        </section>
        <section className="panel calculator">
          <h3>Price, earnings & expectations</h3>
          <p>A lower P/E is not automatically better value.</p>
          <div className="field-row">
            <label>
              Net profit (₹ crore)
              <input
                type="number"
                min="0"
                value={earnings}
                onChange={(e) =>
                  setEarnings(Math.max(0, Number(e.target.value)))
                }
              />
            </label>
            <label>
              Shares (crore)
              <input
                type="number"
                min=".01"
                value={shares}
                onChange={(e) => setShares(Math.max(0, Number(e.target.value)))}
              />
            </label>
          </div>
          <label>
            Share price (₹)
            <input
              type="number"
              min=".01"
              value={stockPrice}
              onChange={(e) =>
                setStockPrice(Math.max(0, Number(e.target.value)))
              }
            />
          </label>
          <div className="valuation-results">
            <div>
              <span>Earnings per share</span>
              <strong>{rupee(eps)}</strong>
            </div>
            <div>
              <span>P/E multiple</span>
              <strong>
                {eps > 0 ? `${(stockPrice / eps).toFixed(1)}×` : "N/A"}
              </strong>
            </div>
          </div>
          <small>
            For positive earnings: EPS = profit ÷ shares; P/E = price ÷ EPS.
            Compare growth, durability, debt and peers.
          </small>
        </section>
      </div>
      <section className="panel resources">
        <BookOpen size={24} />
        <div>
          <h3>Keep learning from primary sources</h3>
          <p>Investor education from SEBI, NSE and Investor.gov.</p>
          <div>
            {resources.map((r) => (
              <a
                key={r.url}
                href={r.url}
                title={r.detail}
                target="_blank"
                rel="noreferrer"
              >
                {r.name} · {r.detail}
                <ExternalLink size={13} />
              </a>
            ))}
          </div>
        </div>
      </section>
      {lesson && (
        <Modal wide title={lesson.title} onClose={() => setOpen(null)}>
          <div className="lesson-meta">
            <span className="badge">{lesson.track}</span>
            <span>
              <Clock3 size={14} />
              {lesson.minutes} min read
            </span>
            {session.completedLessons.includes(lesson.id) && (
              <span className="positive">
                <CheckCircle2 size={15} />
                Completed
              </span>
            )}
          </div>
          <p className="lesson-summary">{lesson.summary}</p>
          {lesson.paragraphs.map((p, i) => (
            <p className="lesson-paragraph" key={i}>
              {p}
            </p>
          ))}
          {hinglish && (
            <div className="hinglish-note">
              <b>Seedhi baat</b>
              <p>{lesson.hinglish}</p>
            </div>
          )}
          <div className="exercise">
            <Lightbulb size={20} />
            <div>
              <b>Try it in replay</b>
              <p>{lesson.exercise}</p>
            </div>
          </div>
          <div className="quiz">
            <span className="eyebrow">CHECK YOUR UNDERSTANDING</span>
            <h3>{lesson.question}</h3>
            {lesson.options.map((option, i) => (
              <button
                className={`quiz-option ${answer === i ? "chosen" : ""} ${answer !== undefined && i === lesson.correct ? "correct" : ""}`}
                key={option}
                onClick={() =>
                  mutate((s) => ({
                    ...s,
                    quizAnswers: { ...s.quizAnswers, [lesson.id]: i },
                    completedLessons:
                      i === lesson.correct
                        ? [...new Set([...s.completedLessons, lesson.id])]
                        : s.completedLessons,
                  }))
                }
              >
                <span>{String.fromCharCode(65 + i)}</span>
                {option}
                {answer === i && i === lesson.correct && <Check size={17} />}
              </button>
            ))}
            {answer !== undefined && (
              <div
                className={`quiz-feedback ${answer === lesson.correct ? "correct" : ""}`}
              >
                <b>
                  {answer === lesson.correct
                    ? "You’ve got it. Lesson complete."
                    : "Let’s think it through."}
                </b>
                <p>{lesson.explanation}</p>
              </div>
            )}
          </div>
          <button
            className="primary-button"
            onClick={() => {
              const i = lessons.findIndex((l) => l.id === lesson.id);
              setOpen(i < lessons.length - 1 ? lessons[i + 1].id : null);
            }}
          >
            Next lesson
            <ArrowRight size={16} />
          </button>
        </Modal>
      )}
    </div>
  );
}
