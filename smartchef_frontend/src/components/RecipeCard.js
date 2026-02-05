import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useAppState } from "../state/AppStateContext";
import { convertFromUsd, formatMoney } from "../utils/currency";
import "../App.css";

/**
 * PUBLIC_INTERFACE
 * Recipe card UI for list/grid results.
 */
export function RecipeCard({ recipe }) {
  const { state, actions } = useAppState();
  const isFav = useMemo(() => state.favorites.some((r) => r.id === recipe.id), [state.favorites, recipe.id]);

  const price = recipe?.pricePerServingUsd != null ? convertFromUsd(recipe.pricePerServingUsd, state.currency) : null;
  const priceLabel = price != null ? formatMoney(price, state.currency) : null;

  const title = String(recipe?.title || "Recipe");
  const source = String(recipe?.source || "recipe");
  const detailsHref = `/recipes/${encodeURIComponent(source)}/${encodeURIComponent(String(recipe?.id || ""))}`;

  return (
    <article className="card recipeCard" aria-label={title}>
      <div className="recipeThumb">
        {recipe.imageUrl ? (
          <img alt={`${title} recipe photo`} src={recipe.imageUrl} loading="lazy" />
        ) : (
          <span className="small">No image</span>
        )}
      </div>
      <div className="recipeMeta">
        <h3 className="recipeName">{title}</h3>
        <div className="badges" aria-label="Recipe info">
          {recipe.source ? <span className="badge badgePrimary">{recipe.source}</span> : null}
          {recipe.readyInMinutes ? <span className="badge">{recipe.readyInMinutes} min</span> : null}
          {recipe.servings ? <span className="badge">{recipe.servings} servings</span> : null}
          {priceLabel ? <span className="badge badgeAmber">~{priceLabel}/serv</span> : null}
        </div>
      </div>
      <div className="cardActions" aria-label="Recipe actions">
        <Link
          className="btn btnGhost"
          to={detailsHref}
          aria-label={`Open details for ${title}`}
        >
          Details
        </Link>
        <button
          className="btn btnSecondary"
          onClick={() => actions.toggleFavorite(recipe)}
          aria-pressed={isFav}
          aria-label={isFav ? `Remove ${title} from favorites` : `Add ${title} to favorites`}
        >
          {isFav ? "Unfavorite" : "Favorite"}
        </button>
      </div>
    </article>
  );
}
