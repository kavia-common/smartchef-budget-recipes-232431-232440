import React, { useEffect, useMemo, useState } from "react";
import { searchRecipes } from "../api/client";
import { isExperimentsEnabled, isFeatureEnabled } from "../config/flags";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";
import { useAppState } from "../state/AppStateContext";
import { RecipeCard } from "../components/RecipeCard";
import "../App.css";

const DIETS = [
  { value: "", label: "Any diet" },
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
  { value: "gluten free", label: "Gluten-free" },
  { value: "ketogenic", label: "Keto" }
];

/**
 * PUBLIC_INTERFACE
 * Main recipe discovery page.
 */
export function SearchPage() {
  const { state } = useAppState();
  const voiceEnabled = isFeatureEnabled("voice") || isExperimentsEnabled();

  const [ingredients, setIngredients] = useState("chicken, rice, onion");
  const [diet, setDiet] = useState("");
  const [maxBudgetUsd, setMaxBudgetUsd] = useState("");
  const [maxReadyMinutes, setMaxReadyMinutes] = useState("");

  const [loading, setLoading] = useState(false);
  const [recipes, setRecipes] = useState([]);
  const [providerUsed, setProviderUsed] = useState("");
  const [warnings, setWarnings] = useState([]);
  const [error, setError] = useState("");

  const speech = useSpeechRecognition();

  const canVoice = voiceEnabled && speech.supported;

  useEffect(() => {
    if (!canVoice) return;
    if (!speech.transcript) return;
    // Append transcript to ingredients input as comma-separated terms.
    setIngredients((prev) => {
      const base = prev.trim();
      const add = speech.transcript.trim();
      if (!add) return prev;
      if (!base) return add;
      return `${base}, ${add}`.replace(/\s+/g, " ");
    });
    // reset transcript after applying
    speech.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speech.transcript, canVoice]);

  const parsedBudget = useMemo(() => {
    const n = Number(maxBudgetUsd);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  }, [maxBudgetUsd]);

  const parsedMinutes = useMemo(() => {
    const n = Number(maxReadyMinutes);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  }, [maxReadyMinutes]);

  const onSearch = async (e) => {
    e?.preventDefault?.();
    setLoading(true);
    setError("");
    setWarnings([]);
    try {
      const res = await searchRecipes({
        ingredients,
        maxBudgetUsd: parsedBudget,
        diet,
        maxReadyMinutes: parsedMinutes
      });
      setRecipes(res.recipes || []);
      setProviderUsed(res.providerUsed || "");
      setWarnings(res.warnings || []);
    } catch (err) {
      setError(err?.message || "Search failed");
      setRecipes([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <h1 className="pageTitle">SmartChef</h1>
      <p className="pageSubtitle">Find budget-friendly recipes using what you already have.</p>

      <section className="card" aria-label="Search controls">
        <div className="cardHeader">
          <strong>Ingredients + filters</strong>
          <span className="small">Currency: <b>{state.currency}</b>. Budget filters use USD internally.</span>
        </div>

        <div className="cardBody">
          <form onSubmit={onSearch}>
            <div className="field">
              <label htmlFor="ingredients">Ingredients (comma-separated)</label>
              <textarea
                id="ingredients"
                className="textarea"
                value={ingredients}
                onChange={(e) => setIngredients(e.target.value)}
                placeholder="e.g., eggs, tomato, pasta"
              />
              {canVoice ? (
                <div className="row" style={{ marginTop: 10 }}>
                  <button
                    type="button"
                    className="btn btnGhost"
                    onClick={speech.listening ? speech.stop : speech.start}
                    aria-pressed={speech.listening}
                  >
                    {speech.listening ? "Stop voice" : "Add by voice"}
                  </button>
                  <span className="helper">
                    Uses your browser’s Web Speech API. {speech.error ? `Error: ${speech.error}` : ""}
                  </span>
                </div>
              ) : (
                <div className="helper">
                  Voice input is optional. Enable with <code>REACT_APP_FEATURE_FLAGS=voice</code> (and a supported browser).
                </div>
              )}
            </div>

            <div className="divider" />

            <div className="row">
              <div className="field">
                <label htmlFor="budget">Max budget (USD)</label>
                <input
                  id="budget"
                  className="input"
                  inputMode="decimal"
                  value={maxBudgetUsd}
                  onChange={(e) => setMaxBudgetUsd(e.target.value)}
                  placeholder="e.g., 10"
                  aria-describedby="budget-help"
                />
                <span id="budget-help" className="small">
                  If provider supports price filters, we apply it; otherwise we show estimates when available.
                </span>
              </div>

              <div className="field">
                <label htmlFor="diet">Dietary preference</label>
                <select id="diet" className="select" value={diet} onChange={(e) => setDiet(e.target.value)}>
                  {DIETS.map((d) => (
                    <option key={d.value || "any"} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="time">Max cook time (minutes)</label>
                <input
                  id="time"
                  className="input"
                  inputMode="numeric"
                  value={maxReadyMinutes}
                  onChange={(e) => setMaxReadyMinutes(e.target.value)}
                  placeholder="e.g., 30"
                />
              </div>
            </div>

            <div className="row" style={{ marginTop: 14 }}>
              <button type="submit" className="btn btnPrimary" disabled={loading}>
                {loading ? "Searching…" : "Search recipes"}
              </button>
              <button
                type="button"
                className="btn btnGhost"
                onClick={() => {
                  setDiet("");
                  setMaxBudgetUsd("");
                  setMaxReadyMinutes("");
                }}
              >
                Reset filters
              </button>
            </div>

            {providerUsed ? <p className="helper">Provider used: <b>{providerUsed}</b></p> : null}
            {warnings?.length ? (
              <div className="notice" role="status" aria-live="polite">
                {warnings.map((w, idx) => (
                  <div key={`${w}-${idx}`}>{w}</div>
                ))}
              </div>
            ) : null}
            {error ? (
              <div className="notice" role="alert">
                {error}
              </div>
            ) : null}
          </form>
        </div>
      </section>

      <div style={{ height: 14 }} />

      <section aria-label="Search results">
        {recipes?.length ? (
          <div className="grid">
            {recipes.map((r) => (
              <RecipeCard key={`${r.source}:${r.id}`} recipe={r} />
            ))}
          </div>
        ) : (
          <p className="helper">No recipes yet—run a search to get started.</p>
        )}
      </section>
    </div>
  );
}
