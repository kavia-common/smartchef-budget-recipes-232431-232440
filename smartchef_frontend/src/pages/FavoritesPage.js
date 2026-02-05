import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAppState } from "../state/AppStateContext";
import { RecipeCard } from "../components/RecipeCard";
import "../App.css";

const SORTS = [
  { value: "recent", label: "Recently added" },
  { value: "title_asc", label: "Title (A–Z)" }
];

function safeTitle(r) {
  return String(r?.title || "").trim();
}

function sortFavorites(favorites, sortMode) {
  const list = Array.isArray(favorites) ? [...favorites] : [];

  // "recent" = preserve stored order (state puts newest first)
  if (sortMode === "recent") return list;

  if (sortMode === "title_asc") {
    return list.sort((a, b) => {
      const at = safeTitle(a).toLowerCase();
      const bt = safeTitle(b).toLowerCase();
      if (at < bt) return -1;
      if (at > bt) return 1;
      // Stable-ish fallback: keep deterministic ordering for equal titles.
      const aid = `${a?.source || ""}:${a?.id || ""}`;
      const bid = `${b?.source || ""}:${b?.id || ""}`;
      return aid.localeCompare(bid);
    });
  }

  return list;
}

/**
 * PUBLIC_INTERFACE
 * Favorites page.
 */
export function FavoritesPage() {
  const { state, actions } = useAppState();
  const [sortMode, setSortMode] = useState("recent");

  const count = Array.isArray(state.favorites) ? state.favorites.length : 0;

  const sortedFavorites = useMemo(() => {
    return sortFavorites(state.favorites, sortMode);
  }, [state.favorites, sortMode]);

  const onClearAll = () => {
    if (!count) return;

    // Simple confirmation to prevent accidental data loss.
    // Favorites are local-only, so this is the only guardrail.
    const ok = window.confirm("Clear all favorites from this device?");
    if (!ok) return;
    actions.clearFavorites();
  };

  return (
    <div className="container">
      <div className="resultsHeader" style={{ marginBottom: 10 }}>
        <div>
          <h1 className="pageTitle">Favorites</h1>
          <p className="pageSubtitle" style={{ marginBottom: 0 }}>
            Your saved recipes (stored locally on this device).
          </p>
        </div>

        <div className="resultsHeaderMeta" aria-label="Favorites actions">
          <span className="badge" aria-label="Favorite count">
            {count} saved
          </span>

          <div className="pill" aria-label="Sort favorites">
            <label htmlFor="fav-sort">Sort</label>
            <select
              id="fav-sort"
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value)}
              aria-label="Sort favorites"
              disabled={count < 2}
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="btn btnGhost"
            onClick={onClearAll}
            disabled={!count}
            aria-disabled={!count}
            aria-label="Clear all favorites"
            title={!count ? "No favorites to clear" : "Remove all favorites stored on this device"}
          >
            Clear all
          </button>
        </div>
      </div>

      {count ? (
        <div className="grid" aria-label="Favorite recipes">
          {sortedFavorites.map((r) => (
            <RecipeCard key={`${r.source}:${r.id}`} recipe={r} />
          ))}
        </div>
      ) : (
        <div className="card" aria-label="No favorites yet">
          <div className="cardBody">
            <p className="helper" style={{ marginTop: 0 }}>
              No favorites yet.
            </p>

            <div className="noticeInfo" role="note" aria-label="How favorites work">
              <div style={{ fontWeight: 800, marginBottom: 6 }}>How to add favorites</div>
              <div>1) Go to Search and run a recipe search.</div>
              <div>2) Tap <b>Favorite</b> on any recipe card.</div>
              <div style={{ marginTop: 8 }}>
                Favorites are saved in your browser on this device (not synced).
              </div>
            </div>

            <div className="row" style={{ marginTop: 14 }}>
              <Link className="btn btnPrimary" to="/">
                Go to search
              </Link>
              <Link className="btn btnGhost" to="/grocery">
                Open grocery list
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
