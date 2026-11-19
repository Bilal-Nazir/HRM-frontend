"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

const leadershipQuotes = [
  {
    quote:
      "Consult them in affairs. Then, when you have decided, put your trust in Allah.",
    source: "Qur’an 3:159",
  },
  {
    quote:
      "Allah commands you to return trusts to their rightful owners and, when you judge between people, to judge with fairness.",
    source: "Qur’an 4:58",
  },
  {
    quote: "Cooperate with one another in goodness and righteousness.",
    source: "Qur’an 5:2",
  },
  { quote: "Indeed, Allah loves those who act justly.", source: "Qur’an 5:42" },
  {
    quote:
      "Allah does not change the condition of a people until they change what is within themselves.",
    source: "Qur’an 13:11",
  },
  { quote: "Speak kindly to people.", source: "Qur’an 2:83" },
  { quote: "My success comes only through Allah.", source: "Qur’an 11:88" },
];

export default function DashboardQuote({
  compact = false,
  audience = "employee",
}: {
  compact?: boolean;
  audience?: "admin" | "employee";
}) {
  const [quoteIndex, setQuoteIndex] = useState(audience === "admin" ? 0 : 1);
  useEffect(() => {
    setQuoteIndex(
      Math.floor(Date.now() / (2 * 60 * 60 * 1000)) % leadershipQuotes.length,
    );
    const timer = window.setInterval(
      () => setQuoteIndex((index) => (index + 1) % leadershipQuotes.length),
      2 * 60 * 60 * 1000,
    );
    return () => window.clearInterval(timer);
  }, []);
  const quote = leadershipQuotes[quoteIndex];
  const refresh = (
    <button
      type="button"
      className={compact ? "welcome-quote-refresh" : "engagement-refresh"}
      onClick={() =>
        setQuoteIndex((index) => (index + 1) % leadershipQuotes.length)
      }
      aria-label="Show another Quranic quote"
    >
      <RefreshCw size={compact ? 14 : 17} />
    </button>
  );
  return compact ? (
    <blockquote className="welcome-quote" aria-label="Quranic quote">
      <p>
        {quote.quote} <cite>{quote.source}</cite>
      </p>
      {refresh}
    </blockquote>
  ) : (
    <article className="engagement-quote">
      <div className="engagement-copy">
        <span>Leadership quote</span>
        <strong>{quote.quote}</strong>
        <small>{quote.source}</small>
      </div>
      {refresh}
    </article>
  );
}
