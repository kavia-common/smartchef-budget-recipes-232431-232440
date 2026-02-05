import React from "react";
import { Link } from "react-router-dom";
import { useAppState } from "../state/AppStateContext";
import { RecipeCard } from "../components/RecipeCard";
import "../App.css";

/**
 * PUBLIC_INTERFACE
 * Favorites page.
 */
export function FavoritesPage() {
  const { state } = useAppState();

  return (
    <div className="container">
      <h1 className="pageTitle">Favorites</h1>
      <p className="pageSubtitle">Your saved recipes (stored locally on this device).</p>

      {state.favorites?.length ? (
        <div className="grid">
          {state.favorites.map((r) => (
            <RecipeCard key={`${r.source}:${r.id}`} recipe={r} />
          ))}
        </div>
      ) : (
        <div className="card">
          <div className="cardBody">
            <p className="helper">No favorites yet. Save recipes from Search.</p>
            <Link className="btn btnPrimary" to="/">Go to search</Link>
          </div>
        </div>
      )}
    </div>
  );
}
