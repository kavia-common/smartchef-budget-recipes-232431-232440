import React from "react";
import { NavLink } from "react-router-dom";
import "../App.css";

function linkClass({ isActive }) {
  return `navLink ${isActive ? "navLinkActive" : ""}`;
}

/**
 * PUBLIC_INTERFACE
 * Bottom navigation for mobile-first routing.
 */
export function BottomNav() {
  return (
    <nav className="bottomNav" aria-label="Primary navigation">
      <div className="bottomNavInner">
        <NavLink
          to="/"
          className={linkClass}
          end
          aria-label="Search recipes"
        >
          <span aria-hidden="true">🔎</span>
          <span>Search</span>
        </NavLink>
        <NavLink
          to="/favorites"
          className={linkClass}
          aria-label="View favorite recipes"
        >
          <span aria-hidden="true">⭐</span>
          <span>Favorites</span>
        </NavLink>
        <NavLink
          to="/grocery"
          className={linkClass}
          aria-label="View grocery list"
        >
          <span aria-hidden="true">🧺</span>
          <span>Grocery</span>
        </NavLink>
      </div>
    </nav>
  );
}
