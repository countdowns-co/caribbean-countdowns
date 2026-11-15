/* Eco grade — single source of the grading scale.
 * 25 boolean criteria (eco-criteria.json, 5 categories × 5) · 4 points each.
 * A ≥ 80 · B ≥ 60 · C ≥ 40 · D ≥ 20 · else F. No eco object (not evaluated yet) → F. */
export function computeEcoGrade(eco: any, criteria: any[]): string {
  if (!eco) return "F";
  let total = 0;
  for (const cat of criteria) {
    for (const c of cat.criteria) {
      if (eco[cat.key]?.[c.key] === true) total += 4;
    }
  }
  return total >= 80 ? "A" : total >= 60 ? "B" : total >= 40 ? "C" : total >= 20 ? "D" : "F";
}
