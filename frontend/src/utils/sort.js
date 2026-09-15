// frontend/src/utils/sort.js
export function sortItems(items, key, getters) {
  const [field, dir] = key.split(":");
  const mul = dir === "asc" ? 1 : -1;
  const get = getters[field];
  return [...items].sort((a, b) => {
    const av = get(a), bv = get(b);
    if (av < bv) return -1 * mul;
    if (av > bv) return 1 * mul;
    return 0;
  });
}