/**
 * Normalize recipe objects from various providers into a consistent shape.
 *
 * NormalizedRecipe:
 * {
 *   id: string,
 *   title: string,
 *   imageUrl?: string,
 *   source: "spoonacular"|"edamam"|"mock",
 *   servings?: number,
 *   readyInMinutes?: number,
 *   pricePerServingUsd?: number,
 *   diets?: string[],
 *   summary?: string,
 *   ingredients?: Array<{ name: string, amount?: string }>,
 *   instructions?: string
 * }
 */

/**
 * PUBLIC_INTERFACE
 * Normalize Spoonacular "complexSearch" result.
 * @param {any} item spoonacular list item
 * @returns {any} normalized recipe
 */
export function normalizeSpoonacularListItem(item) {
  const id = item?.id != null ? String(item.id) : `spoon-${Math.random().toString(16).slice(2)}`;
  return {
    id,
    title: item?.title || "Untitled recipe",
    imageUrl: item?.image,
    source: "spoonacular",
    readyInMinutes: item?.readyInMinutes,
    servings: item?.servings,
    diets: Array.isArray(item?.diets) ? item.diets : [],
    pricePerServingUsd: typeof item?.pricePerServing === "number" ? item.pricePerServing / 100 : undefined
  };
}

/**
 * PUBLIC_INTERFACE
 * Normalize Spoonacular recipe details endpoint result.
 * @param {any} item spoonacular recipe details
 * @returns {any} normalized recipe
 */
export function normalizeSpoonacularDetails(item) {
  const base = normalizeSpoonacularListItem(item);
  return {
    ...base,
    summary: item?.summary,
    instructions: item?.instructions,
    ingredients: Array.isArray(item?.extendedIngredients)
      ? item.extendedIngredients.map((ing) => ({
          name: ing?.name || ing?.original || "ingredient",
          amount: ing?.original || undefined
        }))
      : []
  };
}

/**
 * PUBLIC_INTERFACE
 * Normalize Edamam hit.
 * @param {any} hit Edamam hit object
 * @returns {any} normalized recipe
 */
export function normalizeEdamamHit(hit) {
  const recipe = hit?.recipe || {};
  const uri = recipe?.uri || `edamam-${Math.random().toString(16).slice(2)}`;
  return {
    id: String(uri),
    title: recipe?.label || "Untitled recipe",
    imageUrl: recipe?.image,
    source: "edamam",
    servings: recipe?.yield,
    readyInMinutes: undefined,
    diets: Array.isArray(recipe?.dietLabels) ? recipe.dietLabels : [],
    summary: recipe?.source ? `Source: ${recipe.source}` : undefined,
    ingredients: Array.isArray(recipe?.ingredientLines)
      ? recipe.ingredientLines.map((line) => ({ name: line, amount: line }))
      : [],
    instructions: undefined
  };
}
