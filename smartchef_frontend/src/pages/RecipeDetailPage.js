import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getRecipeDetails } from "../api/client";
import { useAppState } from "../state/AppStateContext";
import "../App.css";

/**
 * PUBLIC_INTERFACE
 * Recipe detail page.
 */
export function RecipeDetailPage() {
  const { provider, id } = useParams();
  const { state, actions } = useAppState();

  const [loading, setLoading] = useState(true);
  const [recipe, setRecipe] = useState(null);
  const [error, setError] = useState("");

  const isFav = useMemo(() => state.favorites.some((r) => r.id === id), [state.favorites, id]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setError("");
      try {
        // Try to find in favorites first (often contains ingredients already)
        const found = state.favorites.find((r) => r.id === id);
        if (found) {
          setRecipe(found);
          setLoading(false);
          return;
        }

        const details = await getRecipeDetails({ provider, id });
        if (!cancelled) {
          setRecipe(details || null);
        }
      } catch (e) {
        if (!cancelled) setError(e?.message || "Failed to load recipe details");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [provider, id, state.favorites]);

  const addAllIngredients = () => {
    const list = Array.isArray(recipe?.ingredients) ? recipe.ingredients : [];
    list.forEach((i) => actions.addGroceryItem(i.amount || i.name, ""));
  };

  if (loading) {
    return (
      <div className="container">
        <p className="helper">Loading recipe…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container">
        <div className="notice" role="alert">{error}</div>
        <div style={{ height: 10 }} />
        <Link className="btn btnGhost" to="/">Back</Link>
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className="container">
        <p className="helper">No details available for this recipe.</p>
        <Link className="btn btnGhost" to="/">Back</Link>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <Link className="btn btnGhost" to="/">← Back</Link>
        <button className="btn btnSecondary" onClick={() => actions.toggleFavorite(recipe)} aria-pressed={isFav}>
          {isFav ? "Unfavorite" : "Favorite"}
        </button>
      </div>

      <div style={{ height: 12 }} />

      <section className="card" aria-label="Recipe details">
        <div className="recipeThumb">
          {recipe.imageUrl ? <img alt="" src={recipe.imageUrl} /> : <span className="small">No image</span>}
        </div>

        <div className="cardBody">
          <h1 className="pageTitle" style={{ marginBottom: 6 }}>{recipe.title}</h1>

          <div className="badges">
            {recipe.source ? <span className="badge badgePrimary">{recipe.source}</span> : null}
            {recipe.readyInMinutes ? <span className="badge">{recipe.readyInMinutes} min</span> : null}
            {recipe.servings ? <span className="badge">{recipe.servings} servings</span> : null}
          </div>

          {recipe.summary ? (
            <>
              <div className="divider" />
              <p className="pageSubtitle" style={{ marginBottom: 0 }}>{stripHtml(recipe.summary)}</p>
            </>
          ) : null}

          <div className="divider" />

          <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
            <strong>Ingredients</strong>
            <button className="btn btnPrimary" onClick={addAllIngredients} disabled={!recipe.ingredients?.length}>
              Add to grocery list
            </button>
          </div>

          {recipe.ingredients?.length ? (
            <ul>
              {recipe.ingredients.map((i, idx) => (
                <li key={`${i.name}-${idx}`}>{i.amount || i.name}</li>
              ))}
            </ul>
          ) : (
            <p className="helper">No ingredient list available from this provider.</p>
          )}

          {recipe.instructions ? (
            <>
              <div className="divider" />
              <strong>Instructions</strong>
              <p className="pageSubtitle" style={{ marginTop: 10 }}>{stripHtml(recipe.instructions)}</p>
            </>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function stripHtml(s) {
  if (!s) return "";
  return String(s).replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}
