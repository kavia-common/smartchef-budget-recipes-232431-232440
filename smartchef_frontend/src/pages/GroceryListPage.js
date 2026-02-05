import React, { useMemo, useState } from "react";
import { useAppState } from "../state/AppStateContext";
import "../App.css";

/**
 * PUBLIC_INTERFACE
 * Grocery list builder page.
 */
export function GroceryListPage() {
  const { state, actions } = useAppState();
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");

  const stats = useMemo(() => {
    const total = state.groceryItems.length;
    const checked = state.groceryItems.filter((i) => i.checked).length;
    return { total, checked };
  }, [state.groceryItems]);

  const onAdd = (e) => {
    e.preventDefault();
    actions.addGroceryItem(name, qty);
    setName("");
    setQty("");
  };

  return (
    <div className="container">
      <h1 className="pageTitle">Grocery list</h1>
      <p className="pageSubtitle">Build a shopping list from recipes and check items off as you go.</p>

      <div className="kpiRow" aria-label="Grocery list stats">
        <div className="kpi">
          <strong>Total items</strong>
          <span>{stats.total}</span>
        </div>
        <div className="kpi">
          <strong>Checked</strong>
          <span>{stats.checked}</span>
        </div>
      </div>

      <div style={{ height: 14 }} />

      <section className="card" aria-label="Add grocery item">
        <div className="cardHeader">
          <strong>Add item</strong>
          <span className="small">Stored locally in your browser.</span>
        </div>
        <div className="cardBody">
          <form onSubmit={onAdd}>
            <div className="row">
              <div className="field">
                <label htmlFor="item">Item</label>
                <input
                  id="item"
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Tomatoes"
                />
              </div>
              <div className="field">
                <label htmlFor="qty">Quantity (optional)</label>
                <input
                  id="qty"
                  className="input"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  placeholder="e.g., 2 lbs"
                />
              </div>
            </div>

            <div className="row" style={{ marginTop: 14 }}>
              <button type="submit" className="btn btnPrimary" disabled={!name.trim()}>
                Add to list
              </button>
              <button type="button" className="btn btnGhost" onClick={actions.clearChecked} disabled={!stats.checked}>
                Clear checked
              </button>
            </div>
          </form>
        </div>
      </section>

      <div style={{ height: 14 }} />

      <section aria-label="Grocery items">
        {state.groceryItems?.length ? (
          <div className="card">
            <div className="cardBody">
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {state.groceryItems.map((i) => (
                  <li
                    key={i.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 0",
                      borderBottom: "1px solid var(--border)"
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={i.checked}
                      onChange={() => actions.toggleGroceryChecked(i.id)}
                      aria-label={`Mark ${i.name} as ${i.checked ? "not purchased" : "purchased"}`}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 800, textDecoration: i.checked ? "line-through" : "none" }}>
                        {i.name}
                      </div>
                      {i.qty ? <div className="small">{i.qty}</div> : null}
                    </div>
                    <button className="btn btnGhost" type="button" onClick={() => actions.removeGroceryItem(i.id)}>
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <p className="helper">Your grocery list is empty—add items manually or from a recipe.</p>
        )}
      </section>
    </div>
  );
}
