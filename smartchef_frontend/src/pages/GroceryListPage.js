import React, { useEffect, useMemo, useRef, useState } from "react";
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

  // Lightweight UX feedback for "added/duplicate/removed/cleared".
  const [statusMsg, setStatusMsg] = useState("");
  const [inlineMsg, setInlineMsg] = useState("");
  const statusTimerRef = useRef(null);

  const itemInputRef = useRef(null);

  const items = Array.isArray(state.groceryItems) ? state.groceryItems : [];

  const stats = useMemo(() => {
    const total = items.length;
    const checked = items.filter((i) => i.checked).length;
    return { total, checked };
  }, [items]);

  const proposedKey = useMemo(() => keyFor(name), [name]);

  const duplicateItem = useMemo(() => {
    if (!proposedKey) return null;
    return items.find((i) => keyFor(i.name) === proposedKey) || null;
  }, [items, proposedKey]);

  const setStatus = (msg) => {
    setStatusMsg(msg || "");
    if (statusTimerRef.current) window.clearTimeout(statusTimerRef.current);
    statusTimerRef.current = window.setTimeout(() => setStatusMsg(""), 1600);
  };

  useEffect(() => {
    return () => {
      if (statusTimerRef.current) window.clearTimeout(statusTimerRef.current);
    };
  }, []);

  const resetInline = () => setInlineMsg("");

  const focusItemInput = () => {
    try {
      itemInputRef.current?.focus?.();
    } catch {
      // ignore
    }
  };

  const onAdd = (e) => {
    e?.preventDefault?.();

    const normName = normalizeText(name);
    const normQty = normalizeText(qty);

    if (!normName) {
      setInlineMsg("Enter an item name to add it.");
      setStatus("");
      focusItemInput();
      return;
    }

    // Explicitly prevent duplicate adds; AppState also prevents duplicates as a safety net.
    const existing = items.find((i) => keyFor(i.name) === keyFor(normName));
    if (existing) {
      const updatedQty = normQty || existing.qty;
      actions.addGroceryItem(normName, normQty);

      setName("");
      setQty("");
      resetInline();

      setStatus(
        updatedQty && updatedQty !== existing.qty
          ? `Updated “${existing.name}” quantity and moved it to the top.`
          : `“${existing.name}” is already on your list (moved to the top).`
      );
      focusItemInput();
      return;
    }

    actions.addGroceryItem(normName, normQty);

    setName("");
    setQty("");
    resetInline();
    setStatus("Added to grocery list.");
    focusItemInput();
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
    setStatus("Cleared checked items.");
  };

  const onClearAll = () => {
    if (!stats.total) return;
    const ok = window.confirm("Clear your entire grocery list on this device?");
    if (!ok) return;
    actions.clearAllGroceryItems();
    setStatus("Cleared entire grocery list.");
    focusItemInput();
  };

  const onRemove = (id) => {
    actions.removeGroceryItem(id);
    setStatus("Removed item.");
  };

  return (
    <div className="container">
      <div className="resultsHeader" style={{ marginBottom: 10 }}>
        <div>
          <h1 className="pageTitle">Grocery list</h1>
          <p className="pageSubtitle" style={{ marginBottom: 0 }}>
            Build a shopping list, check items off, and clear what you’ve purchased.
          </p>
        </div>

        <div className="resultsHeaderMeta" aria-label="Grocery list actions">
          <span className="badge" aria-label="Grocery item count">
            {stats.total} items
          </span>
          <span className="badge" aria-label="Checked item count">
            {stats.checked} checked
          </span>

          <button
            type="button"
            className="btn btnGhost"
            onClick={onClearChecked}
            disabled={!stats.checked}
            aria-disabled={!stats.checked}
            title={!stats.checked ? "No checked items to clear" : "Remove checked items from your list"}
          >
            Clear checked
          </button>

          <button
            type="button"
            className="btn btnGhost"
            onClick={onClearAll}
            disabled={!stats.total}
            aria-disabled={!stats.total}
            aria-label="Clear all grocery items"
            title={!stats.total ? "Your list is already empty" : "Remove everything from your grocery list"}
          >
            Clear all
          </button>
        </div>
      </div>

      <section className="card" aria-label="Add grocery item">
        <div className="cardHeader">
          <strong>Add item</strong>
          <span className="small">Stored locally in your browser.</span>
        </div>
        <div className="cardBody">
          <form onSubmit={onAdd} aria-describedby="grocery-form-help grocery-inline-message">
            <div className="row">
              <div className="field">
                <label htmlFor="item">Item</label>
                <input
                  ref={itemInputRef}
                  id="item"
                  className="input"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (inlineMsg) resetInline();
                  }}
                  onKeyDown={onNameKeyDown}
                  placeholder="e.g., Tomatoes"
                  autoComplete="off"
                  aria-describedby="grocery-form-help grocery-inline-message"
                  aria-invalid={Boolean(inlineMsg)}
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
              Tip: Press <b>Enter</b> to add quickly. Names are trimmed and spacing is normalized. Duplicates are prevented
              (case/spacing-insensitive).
            </p>

            {inlineMsg ? (
              <div
                id="grocery-inline-message"
                className="notice"
                role="alert"
                aria-label="Grocery form message"
                style={{ marginTop: 10 }}
              >
                {inlineMsg}
              </div>
            ) : (
              <div id="grocery-inline-message" className="sr-only" aria-hidden="true" />
            )}

            {duplicateItem ? (
              <div className="noticeInfo" role="note" aria-label="Duplicate item note">
                “{duplicateItem.name}” is already on your list. Adding again will move it to the top (and update quantity
                if provided).
              </div>
            ) : null}

            <div className="row" style={{ marginTop: 14 }}>
              <button
                type="submit"
                className="btn btnPrimary"
                disabled={!normalizeText(name)}
                aria-disabled={!normalizeText(name)}
                aria-label="Add item to grocery list"
              >
                Add to list
              </button>
            </div>

            {/* Accessible live region for lightweight feedback (non-critical) */}
            <div className="sr-only" aria-live="polite" aria-atomic="true">
              {statusMsg}
            </div>
          </form>
        </div>
      </section>

      <div style={{ height: 14 }} />

      <section aria-label="Grocery items">
        {items.length ? (
          <div className="card">
            <div className="cardBody">
              <ul className="list" aria-label="Grocery list items">
                {items.map((i) => (
                  <li key={i.id} className="listRow">
                    <input
                      id={`g-check-${i.id}`}
                      type="checkbox"
                      checked={Boolean(i.checked)}
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
                      title="Remove item"
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
