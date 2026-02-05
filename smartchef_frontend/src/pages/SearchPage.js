import React, { useEffect, useMemo, useRef, useState } from "react";
import { searchRecipes } from "../api/client";
import { isFeatureEnabled } from "../config/flags";
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

function isBlank(s) {
  return !String(s || "").trim();
}

function parsePositiveNumberOrNull(raw) {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function isValidDietValue(value) {
  return DIETS.some((d) => d.value === value);
}

function makeFieldErrors({ ingredients, diet, maxBudgetUsd, maxReadyMinutes }) {
  const errs = {};

  if (isBlank(ingredients)) {
    errs.ingredients = "Add at least one ingredient to search.";
  }

  if (!isValidDietValue(diet || "")) {
    errs.diet = "Selected diet filter is not recognized.";
  }

  const budget = parsePositiveNumberOrNull(maxBudgetUsd);
  if (String(maxBudgetUsd || "").trim() && budget === null) {
    errs.maxBudgetUsd = "Budget must be a positive number.";
  }

  const minutes = parsePositiveNumberOrNull(maxReadyMinutes);
  if (String(maxReadyMinutes || "").trim() && minutes === null) {
    errs.maxReadyMinutes = "Cook time must be a positive number.";
  }

  return errs;
}

function firstErrorMessage(fieldErrors) {
  const keys = ["ingredients", "maxBudgetUsd", "diet", "maxReadyMinutes"];
  for (const k of keys) {
    if (fieldErrors?.[k]) return fieldErrors[k];
  }
  return "";
}

function RecipeSkeletonGrid({ count = 6 }) {
  return (
    <div className="grid" aria-label="Loading recipes">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={`sk-${idx}`} className="skeleton" aria-hidden="true" />
      ))}
    </div>
  );
}

/**
 * PUBLIC_INTERFACE
 * Main recipe discovery page.
 */
export function SearchPage() {
  const { state } = useAppState();

  // Feature flags are default-off; voice UI should only render when explicitly enabled.
  const voiceEnabled = isFeatureEnabled("voice");

  const [ingredients, setIngredients] = useState("chicken, rice, onion");
  const [diet, setDiet] = useState("");
  const [maxBudgetUsd, setMaxBudgetUsd] = useState("");
  const [maxReadyMinutes, setMaxReadyMinutes] = useState("");

  /**
   * Stable API-client return shape handling:
   * - `recipes`: array (possibly empty)
   * - `warnings`: array of strings
   * - `error`: ApiError|null (client never throws by design)
   */
  const [loading, setLoading] = useState(false);
  const [recipes, setRecipes] = useState([]);
  const [providerUsed, setProviderUsed] = useState("");
  const [warnings, setWarnings] = useState([]);
  const [error, setError] = useState("");

  // Track if user has run at least one search, to distinguish "initial" vs "empty results".
  const [hasSearched, setHasSearched] = useState(false);

  // For inline validation messaging and to drive "reset invalid" behavior.
  const [fieldErrors, setFieldErrors] = useState({});

  const speech = useSpeechRecognition();
  const canVoice = voiceEnabled && speech.supported;

  const ingredientsRef = useRef(null);

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

  const parsedBudget = useMemo(() => parsePositiveNumberOrNull(maxBudgetUsd) ?? undefined, [maxBudgetUsd]);
  const parsedMinutes = useMemo(() => parsePositiveNumberOrNull(maxReadyMinutes) ?? undefined, [maxReadyMinutes]);

  const viewState = useMemo(() => {
    if (loading) return "loading";
    if (error) return "error";
    if (!hasSearched) return "initial";
    if (!recipes?.length) return "empty";
    return "success";
  }, [loading, error, hasSearched, recipes]);

  const runValidation = () => {
    const errs = makeFieldErrors({ ingredients, diet, maxBudgetUsd, maxReadyMinutes });
    setFieldErrors(errs);
    return errs;
  };

  const resetInvalidFilters = (errs) => {
    // Only reset fields that are invalid, to avoid surprising user.
    if (errs?.maxBudgetUsd) setMaxBudgetUsd("");
    if (errs?.maxReadyMinutes) setMaxReadyMinutes("");
    if (errs?.diet) setDiet("");
  };

  const onSearch = async (e) => {
    e?.preventDefault?.();

    const errs = runValidation();
    if (Object.keys(errs).length) {
      // Keep the UI responsive and helpful:
      // - reset only invalid filters
      // - show a single user-friendly error message (plus per-field small hints)
      resetInvalidFilters(errs);
      setError(firstErrorMessage(errs) || "Please fix the highlighted fields.");
      return;
    }

    setHasSearched(true);
    setLoading(true);
    setError("");
    setWarnings([]);

    const trimmedIngredients = String(ingredients || "").trim();

    const res = await searchRecipes({
      ingredients: trimmedIngredients,
      maxBudgetUsd: parsedBudget,
      diet: diet || "",
      maxReadyMinutes: parsedMinutes
    });

    // Ensure consistent rendering with the hardened client return shape.
    const nextRecipes = Array.isArray(res?.recipes) ? res.recipes : [];
    const nextWarnings = Array.isArray(res?.warnings) ? res.warnings : [];
    const nextError = res?.error?.message ? String(res.error.message) : "";

    setRecipes(nextRecipes);
    setProviderUsed(String(res?.providerUsed || ""));
    setWarnings(nextWarnings);

    if (nextError) {
      // If the client reports an error (non-throwing), ensure the page shows error-state UI.
      setError(nextError);
      setRecipes([]);
    }

    setLoading(false);
  };

  const resetFilters = () => {
    setDiet("");
    setMaxBudgetUsd("");
    setMaxReadyMinutes("");
    setFieldErrors((prev) => ({ ...prev, diet: undefined, maxBudgetUsd: undefined, maxReadyMinutes: undefined }));
  };

  const clearResults = () => {
    setHasSearched(false);
    setRecipes([]);
    setProviderUsed("");
    setWarnings([]);
    setError("");
  };

  const clearIngredients = () => {
    setIngredients("");
    setFieldErrors((prev) => ({ ...prev, ingredients: undefined }));
    try {
      ingredientsRef.current?.focus?.();
    } catch {
      // ignore
    }
  };

  const onKeyDownSubmit = (e) => {
    // Support keyboard submit (Enter) in inputs/selects.
    // Textarea keeps newline behavior.
    if (e.key === "Enter") {
      e.preventDefault();
      onSearch(e);
    }
  };

  return (
    <div className="container">
      {/* Live region for async updates: loading / result counts / errors */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {loading ? "Searching recipes." : ""}
        {!loading && hasSearched ? `${recipes.length} recipes found.` : ""}
        {error ? `Error: ${error}` : ""}
      </div>

      <h1 className="pageTitle">SmartChef</h1>
      <p className="pageSubtitle">Find budget-friendly recipes using what you already have.</p>

      <section className="card" aria-label="Search controls">
        <div className="cardHeader">
          <strong>Ingredients + filters</strong>
          <span className="small">
            Currency: <b>{state.currency}</b>. Budget filters use USD internally.
          </span>
        </div>

        <div className="cardBody">
          <form onSubmit={onSearch} aria-describedby="search-status">
            <div className="field">
              <label htmlFor="ingredients">Ingredients (comma-separated)</label>
              <textarea
                ref={ingredientsRef}
                id="ingredients"
                className="textarea"
                value={ingredients}
                onChange={(e) => setIngredients(e.target.value)}
                placeholder="e.g., eggs, tomato, pasta"
                aria-invalid={Boolean(fieldErrors.ingredients)}
                aria-describedby={fieldErrors.ingredients ? "ingredients-help" : undefined}
              />
              {fieldErrors.ingredients ? (
                <span id="ingredients-help" className="small" style={{ color: "var(--color-error)" }}>
                  {fieldErrors.ingredients}
                </span>
              ) : null}

              <div className="row" style={{ marginTop: 10, alignItems: "center" }}>
                <button
                  type="button"
                  className="btn btnGhost"
                  onClick={clearIngredients}
                  disabled={isBlank(ingredients)}
                  aria-label="Clear ingredients input"
                >
                  Clear ingredients
                </button>

                {voiceEnabled ? (
                  canVoice ? (
                    <>
                      <button
                        type="button"
                        className="btn btnGhost"
                        onClick={speech.listening ? speech.stop : speech.start}
                        aria-pressed={speech.listening}
                        aria-label={speech.listening ? "Stop voice input" : "Start voice input"}
                        aria-describedby="voice-help"
                      >
                        {speech.listening ? "Stop voice" : "Add by voice"}
                      </button>
                      <span className="helper" style={{ marginTop: 0 }} id="voice-help">
                        Uses your browser’s Web Speech API.
                        {speech.error
                          ? speech.error === "not-allowed" || speech.error === "service-not-allowed"
                            ? " Microphone permission was denied. Allow microphone access in your browser settings to use voice input."
                            : ` Voice input error: ${speech.error}.`
                          : ""}
                      </span>
                    </>
                  ) : (
                    <span className="helper" style={{ marginTop: 0 }} id="voice-help">
                      Voice input is enabled, but this browser doesn’t support speech recognition. You can still type ingredients normally.
                    </span>
                  )
                ) : (
                  <span className="helper" style={{ marginTop: 0 }} id="voice-help">
                    Voice input is optional and off by default. To enable it, set{" "}
                    <code>REACT_APP_FEATURE_FLAGS=voice</code>.
                  </span>
                )}
              </div>
            </div>

            <div className="divider" />

            <div className="row">
              <div className="field">
                <label htmlFor="budget">Max budget (USD)</label>
                <div className="inputWithAffordance">
                  <input
                    id="budget"
                    className="input"
                    inputMode="decimal"
                    value={maxBudgetUsd}
                    onChange={(e) => setMaxBudgetUsd(e.target.value)}
                    onBlur={() => {
                      const errs = makeFieldErrors({ ingredients, diet, maxBudgetUsd, maxReadyMinutes });
                      setFieldErrors(errs);
                      if (errs.maxBudgetUsd) setMaxBudgetUsd("");
                    }}
                    onKeyDown={onKeyDownSubmit}
                    placeholder="e.g., 10"
                    aria-describedby="budget-help"
                    aria-invalid={Boolean(fieldErrors.maxBudgetUsd)}
                  />
                  <button
                    type="button"
                    className="clearBtn"
                    onClick={() => setMaxBudgetUsd("")}
                    disabled={isBlank(maxBudgetUsd)}
                    aria-label="Clear budget filter"
                  >
                    ×
                  </button>
                </div>
                <span id="budget-help" className="small">
                  If provider supports price filters, we apply it; otherwise we show estimates when available.
                  {fieldErrors.maxBudgetUsd ? (
                    <>
                      {" "}
                      <span style={{ color: "var(--color-error)" }}>{fieldErrors.maxBudgetUsd}</span>
                    </>
                  ) : null}
                </span>
              </div>

              <div className="field">
                <label htmlFor="diet">Dietary preference</label>
                <select
                  id="diet"
                  className="select"
                  value={diet}
                  onChange={(e) => setDiet(e.target.value)}
                  onKeyDown={onKeyDownSubmit}
                  aria-invalid={Boolean(fieldErrors.diet)}
                >
                  {DIETS.map((d) => (
                    <option key={d.value || "any"} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
                {fieldErrors.diet ? (
                  <span className="small" style={{ color: "var(--color-error)" }}>
                    {fieldErrors.diet}
                  </span>
                ) : null}
              </div>

              <div className="field">
                <label htmlFor="time">Max cook time (minutes)</label>
                <div className="inputWithAffordance">
                  <input
                    id="time"
                    className="input"
                    inputMode="numeric"
                    value={maxReadyMinutes}
                    onChange={(e) => setMaxReadyMinutes(e.target.value)}
                    onBlur={() => {
                      const errs = makeFieldErrors({ ingredients, diet, maxBudgetUsd, maxReadyMinutes });
                      setFieldErrors(errs);
                      if (errs.maxReadyMinutes) setMaxReadyMinutes("");
                    }}
                    onKeyDown={onKeyDownSubmit}
                    placeholder="e.g., 30"
                    aria-invalid={Boolean(fieldErrors.maxReadyMinutes)}
                  />
                  <button
                    type="button"
                    className="clearBtn"
                    onClick={() => setMaxReadyMinutes("")}
                    disabled={isBlank(maxReadyMinutes)}
                    aria-label="Clear cook time filter"
                  >
                    ×
                  </button>
                </div>
                {fieldErrors.maxReadyMinutes ? (
                  <span className="small" style={{ color: "var(--color-error)" }}>
                    {fieldErrors.maxReadyMinutes}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="row" style={{ marginTop: 14 }}>
              <button
                type="submit"
                className="btn btnPrimary"
                disabled={loading}
                aria-disabled={loading}
                aria-label={loading ? "Searching recipes" : "Search recipes"}
              >
                {loading ? (
                  <>
                    <span className="spinner" aria-hidden="true" />
                    Searching…
                  </>
                ) : (
                  "Search recipes"
                )}
              </button>

              <button type="button" className="btn btnGhost" onClick={resetFilters} disabled={loading}>
                Reset filters
              </button>

              <button
                type="button"
                className="btn btnGhost"
                onClick={clearResults}
                disabled={loading || (!hasSearched && !recipes.length && !warnings.length && !error)}
              >
                Clear results
              </button>
            </div>

            {/* Form status for assistive tech (referenced by aria-describedby on form) */}
            <div id="search-status" className="sr-only" aria-live="polite" aria-atomic="true">
              {loading ? "Searching recipes." : ""}
              {!loading && hasSearched ? `${recipes.length} recipes found.` : ""}
              {providerUsed ? `Provider used: ${providerUsed}.` : ""}
              {warnings?.length ? `Warnings: ${warnings.join(" ")}` : ""}
              {error ? `Error: ${error}` : ""}
            </div>

            {providerUsed ? (
              <p className="helper">
                Provider used: <b>{providerUsed}</b>
              </p>
            ) : null}

            {warnings?.length ? (
              <div className="noticeWarning" role="status" aria-live="polite" aria-label="Search warnings">
                {warnings.map((w, idx) => (
                  <div key={`${w}-${idx}`}>{w}</div>
                ))}
              </div>
            ) : null}

            {error ? (
              <div className="notice" role="alert" aria-label="Search error">
                {error}
              </div>
            ) : null}
          </form>
        </div>
      </section>

      <div style={{ height: "var(--space-3)" }} />

      <section aria-label="Search results">
        <div className="resultsHeader">
          <h2>Results</h2>
          <div className="resultsHeaderMeta" aria-label="Results meta">
            {loading ? (
              <span className="badge">
                <span className="spinner spinnerDark" aria-hidden="true" /> Loading
              </span>
            ) : null}
            {hasSearched && !loading ? <span className="badge">{recipes.length} recipes</span> : null}
          </div>
        </div>

        {viewState === "initial" ? (
          <div className="card">
            <div className="cardBody">
              <p className="helper" style={{ marginTop: 0 }}>
                Start by entering a few ingredients (comma-separated), then tap <b>Search recipes</b>.
              </p>
              <div className="noticeInfo" role="note">
                Tip: On mobile, you can press <b>Enter</b> from any filter field to submit.
              </div>
            </div>
          </div>
        ) : null}

        {viewState === "loading" ? <RecipeSkeletonGrid count={6} /> : null}

        {viewState === "error" ? (
          <div className="card">
            <div className="cardBody">
              <p className="helper" style={{ marginTop: 0 }}>
                We couldn’t complete that search. Try adjusting filters or searching again.
              </p>
              <div className="row" style={{ marginTop: 10 }}>
                <button className="btn btnPrimary" type="button" onClick={onSearch} disabled={loading}>
                  Retry search
                </button>
                <button className="btn btnGhost" type="button" onClick={clearResults} disabled={loading}>
                  Clear
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {viewState === "empty" ? (
          <div className="card">
            <div className="cardBody">
              <p className="helper" style={{ marginTop: 0 }}>
                No recipes matched those filters. Try removing a filter or broadening your ingredients.
              </p>
              <div className="row" style={{ marginTop: 10 }}>
                <button className="btn btnGhost" type="button" onClick={resetFilters}>
                  Reset filters
                </button>
                <button
                  className="btn btnPrimary"
                  type="button"
                  onClick={() => {
                    try {
                      ingredientsRef.current?.focus?.();
                    } catch {
                      // ignore
                    }
                  }}
                >
                  Edit ingredients
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {viewState === "success" ? (
          <div className="grid">
            {recipes.map((r) => (
              <RecipeCard key={`${r.source}:${r.id}`} recipe={r} />
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
