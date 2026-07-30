export function getItemProductionRecipes(item) {
  return item.recipes.filter((recipe) => !recipe.isDisable() && recipe.isReal() && recipe.isNetProducer(item))
}

export function setRecipeEnabled(spec, recipe, enabled) {
  if (enabled) {
    spec.setEnable(recipe)
  } else {
    spec.setDisable(recipe)
  }
}
