import { normalizeEdamamHit, normalizeSpoonacularDetails, normalizeSpoonacularListItem } from "./normalize";

/**
 * Decide whether to call third-party APIs directly (dev) or via backend proxy when configured.
 * - If REACT_APP_BACKEND_URL is set, requests go to `${BACKEND_URL}/api/...`
 * - Else direct provider calls are attempted when keys exist.
 */
function getBackendBase() {
  const backend = (process.env.REACT_APP_BACKEND_URL || "").trim();
  return backend ? backend.replace(/\/+$/, "") : "";
}

function hasSpoonacularKey() {
  return Boolean((process.env.REACT_APP_SPOONACULAR_API_KEY || "").trim());
}

function hasEdamamKeys() {
  return Boolean((process.env.REACT_APP_EDAMAM_APP_ID || "").trim() && (process.env.REACT_APP_EDAMAM_APP_KEY || "").trim());
}

function buildQuery(params) {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    usp.set(k, String(v));
  });
  return usp.toString();
}

async function fetchJson(url, init) {
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const message = text ? `${res.status} ${res.statusText}: ${text}` : `${res.status} ${res.statusText}`;
    throw new Error(message);
  }
  return res.json();
}

/**
 * PUBLIC_INTERFACE
 * Search recipes across available providers.
 * @param {object} args search parameters
 * @param {string} args.ingredients comma-separated ingredients text
 * @param {number} args.maxBudgetUsd optional budget in USD
 * @param {string} args.diet optional diet filter
 * @param {number} args.maxReadyMinutes optional time filter
 * @returns {Promise<{recipes:any[], providerUsed:string, warnings:string[]}>}
 */
export async function searchRecipes({ ingredients, maxBudgetUsd, diet, maxReadyMinutes }) {
  const backendBase = getBackendBase();
  const warnings = [];

  // Prefer backend proxy when present (supports hiding keys server-side).
  if (backendBase) {
    const qs = buildQuery({ ingredients, maxBudgetUsd, diet, maxReadyMinutes });
    const data = await fetchJson(`${backendBase}/api/recipes/search?${qs}`);
    // Expect backend to already normalize; still defensively normalize if shape resembles providers.
    const recipes = Array.isArray(data?.recipes)
      ? data.recipes
      : Array.isArray(data?.results)
        ? data.results.map(normalizeSpoonacularListItem)
        : [];
    return { recipes, providerUsed: data?.provider || "backend", warnings: data?.warnings || warnings };
  }

  // Direct calls: try Spoonacular, then Edamam, else mock.
  if (hasSpoonacularKey()) {
    try {
      const apiKey = process.env.REACT_APP_SPOONACULAR_API_KEY.trim();
      const qs = buildQuery({
        apiKey,
        addRecipeInformation: "true",
        number: 12,
        query: ingredients,
        diet: diet || undefined,
        maxReadyTime: maxReadyMinutes || undefined,
        maxPrice: maxBudgetUsd || undefined
      });
      const data = await fetchJson(`https://api.spoonacular.com/recipes/complexSearch?${qs}`);
      const recipes = Array.isArray(data?.results) ? data.results.map(normalizeSpoonacularListItem) : [];
      if (!recipes.length) warnings.push("No results from Spoonacular for those filters.");
      return { recipes, providerUsed: "spoonacular", warnings };
    } catch (e) {
      warnings.push("Spoonacular request failed; trying fallback provider.");
    }
  } else {
    warnings.push("Spoonacular key not configured; skipping Spoonacular.");
  }

  if (hasEdamamKeys()) {
    const app_id = process.env.REACT_APP_EDAMAM_APP_ID.trim();
    const app_key = process.env.REACT_APP_EDAMAM_APP_KEY.trim();
    const qs = buildQuery({
      type: "public",
      app_id,
      app_key,
      q: ingredients,
      diet: diet || undefined
    });
    const data = await fetchJson(`https://api.edamam.com/api/recipes/v2?${qs}`);
    const recipes = Array.isArray(data?.hits) ? data.hits.map(normalizeEdamamHit) : [];
    if (!recipes.length) warnings.push("No results from Edamam for those filters.");
    return { recipes, providerUsed: "edamam", warnings };
  } else {
    warnings.push("Edamam keys not configured; skipping Edamam.");
  }

  // Mock fallback (no secrets)
  const mock = [
    {
      id: "mock-1",
      title: "Budget Veggie Stir-fry",
      imageUrl: "",
      source: "mock",
      servings: 2,
      readyInMinutes: 20,
      diets: ["vegetarian"],
      pricePerServingUsd: 2.15,
      summary: "A fast, flexible stir-fry using whatever vegetables you have.",
      ingredients: [
        { name: "Mixed vegetables", amount: "2 cups" },
        { name: "Soy sauce", amount: "2 tbsp" },
        { name: "Rice", amount: "1 cup cooked" }
      ],
      instructions: "Stir-fry veggies, add soy sauce, serve over rice."
    }
  ];

  warnings.push("No provider keys available. Showing a sample recipe instead.");
  return { recipes: mock, providerUsed: "mock", warnings };
}

/**
 * PUBLIC_INTERFACE
 * Fetch recipe details for a specific provider/id when possible.
 * If details aren't available (e.g., Edamam without a details call), returns the passed-in recipe as-is.
 * @param {object} args arguments
 * @param {string} args.provider provider name
 * @param {string} args.id recipe id
 * @returns {Promise<any>} recipe
 */
export async function getRecipeDetails({ provider, id }) {
  const backendBase = getBackendBase();
  if (backendBase) {
    const qs = buildQuery({ provider, id });
    const data = await fetchJson(`${backendBase}/api/recipes/details?${qs}`);
    return data?.recipe || data;
  }

  if (provider === "spoonacular" && hasSpoonacularKey()) {
    const apiKey = process.env.REACT_APP_SPOONACULAR_API_KEY.trim();
    const data = await fetchJson(`https://api.spoonacular.com/recipes/${encodeURIComponent(id)}/information?${buildQuery({ apiKey })}`);
    return normalizeSpoonacularDetails(data);
  }

  // For Edamam, the details are usually present on the search hit already.
  return null;
}
