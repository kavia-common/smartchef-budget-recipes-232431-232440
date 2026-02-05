import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams, Link } from "react-router-dom";
import { getRecipeDetails } from "../api/client";
import { useAppState } from "../state/AppStateContext";
import "../App.css";

/**
 * PUBLIC_INTERFACE
 * Recipe detail page.
 *
 * UX goals:
 * - Prefer cached data from Favorites (immediate render) before fetching.
 * - Gracefully handle missing details per provider (clear empty/disabled states).
 * - Stable consumption of API client shape: { recipe, warnings, error } (non-throwing).
 * - Reliable actions: favorite toggle, add-to-grocery, and back navigation.
 */
export function RecipeDetailPage() {
  const { provider, id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const { state, actions } = useAppState();

  const [loading, setLoading] = useState(true); // "details fetch" loading state
  const [recipe, setRecipe] = useState(null);

  // Stable API client UX surfaces:
  const [warnings, setWarnings] = useState([]);
  const [error, setError] = useState("");

  // Local UX states for actions
  const [addedToGrocery, setAddedToGrocery] = useState(false);

  const fetchAbortRef = useRef(null);

  const cachedFavorite = useMemo(() => {
    // Prefer exact match by both id and provider to avoid collisions across providers.
    const favs = Array.isArray(state.favorites) ? state.favorites : [];
    return favs.find((r) => String(r?.id) === String(id) && String(r?.source) === String(provider)) || null;
  }, [state.favorites, id, provider]);

  const isFav = useMemo(() => {
    return Boolean(cachedFavorite);
  }, [cachedFavorite]);

  const effectiveRecipe = recipe || cachedFavorite;

  // Determine which sections/actions are available
  const ingredients = useMemo(() => {
    const list = effectiveRecipe?.ingredients;
    return Array.isArray(list) ? list : [];
  }, [effectiveRecipe]);

  const canAddToGrocery = ingredients.length > 0;

  const addAllIngredients = () => {
    if (!canAddToGrocery) return;

    // Add each ingredient line as a grocery item. Use amount when present.
    ingredients.forEach((i) => {
      const label = String(i?.amount || i?.name || "").trim();
      if (!label) return;
      actions.addGroceryItem(label, "");
    });

    // Provide immediate feedback and prevent accidental double-taps.
    setAddedToGrocery(true);
    // Reset after a short time; keeps UX light without requiring a toast system.
    window.setTimeout(() => setAddedToGrocery(false), 1600);
  };

  const onBack = () => {
    // Prefer going back in history when navigated from within app,
    // otherwise fall back to Search.
    // location.key is "default" for initial entries; in that case "back" might exit app context.
    const safeToGoBack = location?.key && location.key !== "default";
    if (safeToGoBack) navigate(-1);
    else navigate("/", { replace: true });
  };

  useEffect(() => {
    // Reset UI when route changes
    setWarnings([]);
    setError("");
    setAddedToGrocery(false);

    // Always prefer showing cached favorite immediately, but still attempt to fetch
    // to enrich missing fields (e.g., ingredients/instructions) when possible.
    if (cachedFavorite) {
      setRecipe(cachedFavorite);
      setLoading(false);
    } else {
      setRecipe(null);
      setLoading(true);
    }

    // Cancel any in-flight request
    try {
      fetchAbortRef.current?.abort?.();
    } catch {
      // ignore
    }

    const controller = new AbortController();
    fetchAbortRef.current = controller;

    let didSettle = false;

    async function run() {
      // If we already have cached favorite and it looks "complete enough", we can skip fetching.
      // But "complete enough" varies by provider; keep it simple and fetch once to try enrich.
      const res = await getRecipeDetails({ provider, id }, { signal: controller.signal });

      if (controller.signal.aborted) return;

      didSettle = true;

      const nextWarnings = Array.isArray(res?.warnings) ? res.warnings : [];
      setWarnings(nextWarnings);

      if (res?.error) {
        // If we have cached data, keep rendering it and show a warning (not a hard error screen).
        // If we have nothing, show an error state.
        const msg = String(res.error.message || "Failed to load recipe details");
        if (cachedFavorite) {
          setError("");
          setWarnings((prev) => [
            ...prev,
            msg
          ]);
          return;
        }

        setError(msg);
        setRecipe(null);
        setLoading(false);
        return;
      }

      if (res?.recipe) {
        setRecipe(res.recipe);
      } else {
        // No details available: keep cached (if any) else null (empty state)
        if (!cachedFavorite) setRecipe(null);
      }

      setLoading(false);
    }

    run().catch((e) => {
      if (controller.signal.aborted) return;

      const msg = String(e?.message || "Failed to load recipe details");
      if (cachedFavorite) {
        setError("");
        setWarnings((prev) => [...prev, msg]);
        setLoading(false);
        return;
      }

      setError(msg);
      setRecipe(null);
      setLoading(false);
    });

    return () => {
      try {
        controller.abort();
      } catch {
        // ignore
      }
      if (!didSettle) {
        // no-op; maintained for readability
      }
    };
  }, [provider, id, cachedFavorite, location.key]);

  const title = effectiveRecipe?.title || "Recipe";
  const showHardError = Boolean(error) && !effectiveRecipe;

  if (loading && !effectiveRecipe) {
    return (
      <div className="container">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <button type="button" className="btn btnGhost" onClick={onBack}>
            ← Back
          </button>
          <button type="button" className="btn btnSecondary" disabled aria-disabled="true">
            Favorite
          </button>
        </div>

        <div style={{ height: 12 }} />
        <div className="card">
          <div className="cardBody">
            <p className="helper" style={{ marginTop: 0 }}>Loading recipe…</p>
          </div>
        </div>
      </div>
    );
  }

  if (showHardError) {
    return (
      <div className="container">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <button type="button" className="btn btnGhost" onClick={onBack}>
            ← Back
          </button>
          <button type="button" className="btn btnPrimary" onClick={() => navigate(0)}>
            Retry
          </button>
        </div>

        <div style={{ height: 10 }} />
        <div className="notice" role="alert" aria-label="Recipe details error">
          {error}
        </div>

        <div style={{ height: 10 }} />
        <Link className="btn btnGhost" to="/">
          Go to search
        </Link>
      </div>
    );
  }

  if (!effectiveRecipe) {
    return (
      <div className="container">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <button type="button" className="btn btnGhost" onClick={onBack}>
            ← Back
          </button>
          <button type="button" className="btn btnPrimary" onClick={() => navigate("/")}>
            Search recipes
          </button>
        </div>

        <div style={{ height: 12 }} />
        <div className="card" aria-label="Recipe details unavailable">
          <div className="cardBody">
            <p className="helper" style={{ marginTop: 0 }}>
              No details are available for this recipe.
            </p>
            <p className="small">
              Some providers don’t expose a full detail endpoint. If you favorite a recipe from Search, we’ll cache what we have.
            </p>
          </div>
        </div>

        {warnings?.length ? (
          <div className="noticeWarning" role="status" aria-live="polite" aria-label="Recipe warnings">
            {warnings.map((w, idx) => (
              <div key={`${w}-${idx}`}>{w}</div>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="container">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <button type="button" className="btn btnGhost" onClick={onBack}>
          ← Back
        </button>

        <button
          type="button"
          className="btn btnSecondary"
          onClick={() => actions.toggleFavorite(effectiveRecipe)}
          aria-pressed={isFav}
        >
          {isFav ? "Unfavorite" : "Favorite"}
        </button>
      </div>

      {warnings?.length ? (
        <>
          <div style={{ height: 12 }} />
          <div className="noticeWarning" role="status" aria-live="polite" aria-label="Recipe warnings">
            {warnings.map((w, idx) => (
              <div key={`${w}-${idx}`}>{w}</div>
            ))}
          </div>
        </>
      ) : null}

      {/* Soft error: show as warning when we still have cached data */}
      {error && effectiveRecipe ? (
        <>
          <div style={{ height: 12 }} />
          <div className="noticeWarning" role="status" aria-live="polite" aria-label="Recipe load issue">
            {error}
          </div>
        </>
      ) : null}

      <div style={{ height: 12 }} />

      <section className="card" aria-label="Recipe details">
        <div className="recipeThumb">
          {effectiveRecipe.imageUrl ? <img alt="" src={effectiveRecipe.imageUrl} /> : <span className="small">No image</span>}
        </div>

        <div className="cardBody">
          <h1 className="pageTitle" style={{ marginBottom: 6 }}>
            {title}
          </h1>

          <div className="badges" aria-label="Recipe meta">
            {effectiveRecipe.source ? <span className="badge badgePrimary">{effectiveRecipe.source}</span> : null}
            {effectiveRecipe.readyInMinutes ? <span className="badge">{effectiveRecipe.readyInMinutes} min</span> : null}
            {effectiveRecipe.servings ? <span className="badge">{effectiveRecipe.servings} servings</span> : null}
            {loading ? (
              <span className="badge" aria-label="Updating details">
                <span className="spinner spinnerDark" aria-hidden="true" /> Updating
              </span>
            ) : null}
          </div>

          {effectiveRecipe.summary ? (
            <>
              <div className="divider" />
              <p className="pageSubtitle" style={{ marginBottom: 0 }}>
                {stripHtml(effectiveRecipe.summary)}
              </p>
            </>
          ) : (
            <>
              <div className="divider" />
              <p className="helper" style={{ marginTop: 0 }}>
                No summary available.
              </p>
            </>
          )}

          <div className="divider" />

          <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
            <strong>Ingredients</strong>

            <button
              type="button"
              className="btn btnPrimary"
              onClick={addAllIngredients}
              disabled={!canAddToGrocery || addedToGrocery}
              aria-disabled={!canAddToGrocery || addedToGrocery}
              aria-label={
                !canAddToGrocery
                  ? "Add to grocery list (disabled because ingredients are unavailable)"
                  : addedToGrocery
                    ? "Ingredients added"
                    : "Add ingredients to grocery list"
              }
              title={!canAddToGrocery ? "This provider did not include ingredients for this recipe." : undefined}
            >
              {addedToGrocery ? "Added" : "Add to grocery list"}
            </button>
          </div>

          {ingredients.length ? (
            <ul>
              {ingredients.map((i, idx) => (
                <li key={`${i?.name || i?.amount || "ingredient"}-${idx}`}>{i?.amount || i?.name}</li>
              ))}
            </ul>
          ) : (
            <p className="helper">No ingredient list available from this provider.</p>
          )}

          <div className="divider" />

          <strong>Instructions</strong>
          {effectiveRecipe.instructions ? (
            <p className="pageSubtitle" style={{ marginTop: 10 }}>
              {stripHtml(effectiveRecipe.instructions)}
            </p>
          ) : (
            <p className="helper">
              Instructions aren’t available for this recipe. If you favorite it from Search, we’ll keep any notes/ingredients provided there.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function stripHtml(s) {
  if (!s) return "";
  return String(s).replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}
