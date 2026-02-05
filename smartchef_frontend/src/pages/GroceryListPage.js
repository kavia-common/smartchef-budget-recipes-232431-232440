import React, { useMemo, useRef, useState } from "react";
import { useAppState } from "../state/AppStateContext";
import "../App.css";

function normalizeText(raw) {
  return String(raw || "").replace(/\s+/g, " ").trim();
}

function keyFor(raw) {
  return normalizeText(raw).toLowerCase();
}

/**
 * PUBLIC_INTERFACE
 * Grocery list builder page.
 */
export function GroceryListPage() {
  const { state, actions } = useAppState();
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");

  // Lightweight UX feedback for "duplicate prevented" or "updated existing".
  const [statusMsg, setStatusMsg] = useState("");
  const itemInputRef = useRef(null);

  const stats = useMemo(() => {
    const items = Array.isArray(state.groceryItems) ? state.groceryItems : [];
    const total = items.length;
    const checked = items.filter((i) => i.checked).length;
    return { total, checked };
  }, [state.groceryItems]);

  const hasDuplicateInList = useMemo(() => {
    const k = keyFor(name);
    if (!k) return false;
    return (state.groceryItems || []).some((i) => keyFor(i.name) === k);
  }, [name, state.groceryItems]);

  const clearStatusSoon = () => {
    window.setTimeout(() => setStatusMsg(""), 1600);
  };

  const onAdd = (e) => {
    e.preventDefault();

    const normName = normalizeText(name);
    const normQty = normalizeText(qty);

    if (!normName) return;

    const already = (state.groceryItems || []).some((i) => keyFor(i.name) === keyFor(normName));

    actions.addGroceryItem(normName, normQty);

    // Keep keyboard flow friendly: clear inputs and focus back to item.
    setName("");
    setQty("");

    if (already) {
      setStatusMsg("Item already on your list — moved to top / updated quantity.");
      clearStatusSoon();
    } else {
      setStatusMsg("Added to grocery list.");
      clearStatusSoon();
    }

    try {
      itemInputRef.current?.focus?.();
    } catch {
      // ignore
    }
  };

  const onNameKeyDown = (e) => {
    // Enter-to-add from the item field.
    if (e.key === "Enter") {
      e.preventDefault();
      onAdd(e);
    }
  };

  const onQtyKeyDown = (e) => {
    // Enter-to-add from quantity too (common UX).
    if (e.key === "Enter") {
      e.preventDefault();
      onAdd(e);
    }
  };

  const onClearChecked = () => {
    if (!stats.checked) return;
    actions.clearChecked();
    setStatusMsg("Cleared checked items.");
    clearStatusSoon();
  };

  const onRemove = (id) => {
    actions.removeGroceryItem(id);
    setStatusMsg("Removed item.");
    clearStatusSoon();
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
          <form onSubmit={onAdd} aria-describedby="grocery-form-help">
            <div className="row">
              <div className="field">
                <label htmlFor="item">Item</label>
                <input
                  ref={itemInputRef}
                  id="item"
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={onNameKeyDown}
                  placeholder="e.g., Tomatoes"
                  autoComplete="off"
                  aria-describedby="grocery-form-help"
                />
              </div>
              <div className="field">
                <label htmlFor="qty">Quantity (optional)</label>
                <input
                  id="qty"
                  className="input"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  onKeyDown={onQtyKeyDown}
                  placeholder="e.g., 2 lbs"
                  autoComplete="off"
                />
              </div>
            </div>

            <p id="grocery-form-help" className="helper" style={{ marginTop: 10 }}>
              Tip: Press <b>Enter</b> to add quickly. Duplicates are prevented (case/spacing-insensitive).
            </p>

            {hasDuplicateInList ? (
              <div className="noticeInfo" role="note" aria-label="Duplicate item note">
                This item is already on your list. Adding again will move it to the top (and update quantity if provided).
              </div>
            ) : null}

            <div className="row" style={{ marginTop: 14 }}>
              <button type="submit" className="btn btnPrimary" disabled={!normalizeText(name)}>
                Add to list
              </button>
              <button
                type="button"
                className="btn btnGhost"
                onClick={onClearChecked}
                disabled={!stats.checked}
                aria-disabled={!stats.checked}
              >
                Clear checked
              </button>
            </div>

            {/* Accessible live region for lightweight feedback */}
            <div className="sr-only" aria-live="polite">
              {statusMsg}
            </div>
          </form>
        </div>
      </section>

      <div style={{ height: 14 }} />

      <section aria-label="Grocery items">
        {state.groceryItems?.length ? (
          <div className="card">
            <div className="cardBody">
              <ul className="list" aria-label="Grocery list items">
                {state.groceryItems.map((i) => (
                  <li key={i.id} className="listRow">
                    <input
                      id={`g-check-${i.id}`}
                      type="checkbox"
                      checked={i.checked}
                      onChange={() => actions.toggleGroceryChecked(i.id)}
                      aria-label={`Mark ${i.name} as ${i.checked ? "not purchased" : "purchased"}`}
                    />

                    <label htmlFor={`g-check-${i.id}`} className="listMain">
                      <div
                        className="listTitle"
                        style={{ textDecoration: i.checked ? "line-through" : "none" }}
                      >
                        {i.name}
                      </div>
                      {i.qty ? <div className="small">{i.qty}</div> : null}
                    </label>

                    <button
                      className="btn btnGhost"
                      type="button"
                      onClick={() => onRemove(i.id)}
                      aria-label={`Remove ${i.name} from list`}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className="card" aria-label="Empty grocery list">
            <div className="cardBody">
              <p className="helper" style={{ marginTop: 0 }}>
                Your grocery list is empty—add items manually or from a recipe’s ingredient list.
              </p>
              <div className="noticeInfo" role="note" aria-label="How to add items from recipes">
                Tip: Open any recipe and use <b>Add to grocery list</b> to import its ingredients.
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
