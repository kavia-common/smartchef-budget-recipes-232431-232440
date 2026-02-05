import React from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import "./App.css";
import { BottomNav } from "./components/BottomNav";
import { useAppState } from "./state/AppStateContext";
import { FavoritesPage } from "./pages/FavoritesPage";
import { GroceryListPage } from "./pages/GroceryListPage";
import { RecipeDetailPage } from "./pages/RecipeDetailPage";
import { SearchPage } from "./pages/SearchPage";

function usePageMeta() {
  const loc = useLocation();
  const path = loc.pathname;
  const title =
    path.startsWith("/favorites") ? "SmartChef — Favorites" :
    path.startsWith("/grocery") ? "SmartChef — Grocery" :
    path.startsWith("/recipes/") ? "SmartChef — Recipe" :
    "SmartChef — Search";

  React.useEffect(() => {
    document.title = title;
  }, [title]);
}

// PUBLIC_INTERFACE
function App() {
  usePageMeta();
  const { state, actions } = useAppState();

  return (
    <div className="appShell">
      <header className="topBar">
        <div className="topBarInner">
          <div className="brand" aria-label="SmartChef">
            <div className="brandMark" aria-hidden="true">SC</div>
            <div className="brandName">
              <strong>SmartChef</strong>
              <span>budget recipes</span>
            </div>
          </div>

          <div className="topActions">
            <div className="pill" aria-label="Currency toggle">
              <label htmlFor="currency">Currency</label>
              <select
                id="currency"
                value={state.currency}
                onChange={(e) => actions.setCurrency(e.target.value)}
                aria-label="Select currency"
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
          </div>
        </div>
      </header>

      <main className="main" role="main">
        <Routes>
          <Route path="/" element={<SearchPage />} />
          <Route path="/recipes/:provider/:id" element={<RecipeDetailPage />} />
          <Route path="/favorites" element={<FavoritesPage />} />
          <Route path="/grocery" element={<GroceryListPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <BottomNav />
    </div>
  );
}

export default App;
