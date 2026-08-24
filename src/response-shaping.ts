/**
 * Shaping a GHL response before it reaches the model.
 *
 * A raw list endpoint can return hundreds of records with dozens of fields each, which is
 * both unreadable and expensive. These are the four levers execute_action exposes —
 * result_filter, result_fields, result_offset/result_limit — plus the truncation that keeps
 * a single oversized record from swamping a reply.
 */

/**
 * Filter array items in a JSON response by keyword.
 * Searches all string-valued fields in each item (case-insensitive).
 */
export function filterResponseData(
  data: unknown,
  filter: string
): { data: unknown; total: number; matched: number } {
  const term = filter.toLowerCase();

  if (Array.isArray(data)) {
    const matched = data.filter((item) => itemMatches(item, term));
    return { data: matched, total: data.length, matched: matched.length };
  }

  if (typeof data === "object" && data !== null) {
    const obj = data as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    let total = 0;
    let matched = 0;
    let foundArray = false;

    for (const [key, val] of Object.entries(obj)) {
      if (Array.isArray(val)) {
        foundArray = true;
        total += val.length;
        const filtered = val.filter((item) => itemMatches(item, term));
        matched += filtered.length;
        result[key] = filtered;
      } else {
        result[key] = val;
      }
    }

    if (foundArray) return { data: result, total, matched };
  }

  return { data, total: 0, matched: 0 };
}

function itemMatches(item: unknown, term: string): boolean {
  return valueMatches(item, term, 0);
}

function valueMatches(value: unknown, term: string, depth: number): boolean {
  if (depth > 6) return false;
  if (typeof value === "string") return value.toLowerCase().includes(term);
  if (Array.isArray(value)) {
    return value.some((entry) => valueMatches(entry, term, depth + 1));
  }
  if (typeof value !== "object" || value === null) return false;
  return Object.values(value as Record<string, unknown>).some((entry) =>
    valueMatches(entry, term, depth + 1)
  );
}

// ── Field projection ──────────────────────────────────────────────

/**
 * Keep only the specified fields in each array item.
 * Handles both top-level arrays and objects with array properties.
 */
export function projectResponseFields(data: unknown, fields: string): unknown {
  const keys = new Set(fields.split(",").map((f) => f.trim()).filter(Boolean));
  if (keys.size === 0) return data;

  const project = (item: unknown): unknown => {
    if (typeof item !== "object" || item === null) return item;
    const obj = item as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const key of keys) {
      if (key in obj) result[key] = obj[key];
    }
    return result;
  };

  if (Array.isArray(data)) return data.map(project);

  if (typeof data === "object" && data !== null) {
    const obj = data as Record<string, unknown>;

    // The record itself, unwrapped: project it directly.
    if ([...keys].some((k) => k in obj)) return project(obj);

    // A wrapper such as {location: {...}} or {contacts: [...]}. This used to project only
    // ARRAY values and pass nested single objects through untouched, so result_fields
    // silently did nothing on single-record reads — which is most GHL reads, since it wraps
    // them as {location}, {contact}, {opportunity} and so on.
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
      if (Array.isArray(val)) result[key] = val.map(project);
      else if (typeof val === "object" && val !== null) result[key] = project(val);
      else result[key] = val;
    }
    return result;
  }

  return data;
}

// ── Count-only mode ───────────────────────────────────────────────

/**
 * Count array items and extract sample field names without returning data.
 */
export function countArrayItems(data: unknown): { total: number; sampleKeys: string[] } {
  if (Array.isArray(data)) {
    const sample = data[0];
    const keys = typeof sample === "object" && sample !== null ? Object.keys(sample as Record<string, unknown>) : [];
    return { total: data.length, sampleKeys: keys };
  }

  if (typeof data === "object" && data !== null) {
    const obj = data as Record<string, unknown>;
    for (const val of Object.values(obj)) {
      if (Array.isArray(val)) {
        const sample = val[0];
        const keys = typeof sample === "object" && sample !== null ? Object.keys(sample as Record<string, unknown>) : [];
        return { total: val.length, sampleKeys: keys };
      }
    }
  }

  return { total: 0, sampleKeys: [] };
}

// ── Pagination ────────────────────────────────────────────────────

/**
 * Slice arrays in a response for server-side pagination.
 * Handles both top-level arrays and objects containing arrays (first array only).
 */
export function paginateResponseData(
  data: unknown,
  offset: number,
  limit?: number
): { data: unknown; total: number; showing: number; offset: number } {
  const slice = (arr: unknown[]) => {
    const sliced = limit != null
      ? arr.slice(offset, offset + limit)
      : arr.slice(offset);
    return { sliced, total: arr.length };
  };

  if (Array.isArray(data)) {
    const { sliced, total } = slice(data);
    return { data: sliced, total, showing: sliced.length, offset };
  }

  if (typeof data === "object" && data !== null) {
    const obj = data as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    let paged = false;
    let total = 0;
    let showing = 0;

    for (const [key, val] of Object.entries(obj)) {
      if (Array.isArray(val) && !paged) {
        paged = true;
        const { sliced, total: arrTotal } = slice(val);
        total = arrTotal;
        showing = sliced.length;
        result[key] = sliced;
      } else {
        result[key] = val;
      }
    }

    if (paged) return { data: result, total, showing, offset };
  }

  return { data, total: 0, showing: 0, offset };
}

// ── Smart truncation ──────────────────────────────────────────────

export function truncateString(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + `\n\n... (truncated, ${text.length} chars total)`;
}

/**
 * JSON-stringify with array-aware truncation.
 * Instead of cutting mid-JSON, reduces arrays to fit and reports the count.
 */
export function smartStringify(data: unknown, maxLen: number): string {
  const pretty = JSON.stringify(data, null, 2);
  if (pretty.length <= maxLen) return pretty;

  // Find the first array property and truncate it to fit
  if (typeof data === "object" && data !== null && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;
    for (const [key, val] of Object.entries(obj)) {
      if (Array.isArray(val) && val.length > 1) {
        return truncateArrayProp(obj, key, val, maxLen);
      }
    }
  }

  // Top-level array
  if (Array.isArray(data) && data.length > 1) {
    const firstSize = JSON.stringify(data[0]).length + 20;
    const budget = maxLen - 200;
    let n = Math.min(data.length, Math.max(1, Math.floor(budget / firstSize)));
    for (; n >= 1; n--) {
      const text = JSON.stringify(data.slice(0, n), null, 2);
      const suffix = `\n\n... showing ${n} of ${data.length} items. Use result_offset=${n} to continue, or result_filter/result_limit to refine the page.`;
      if (text.length + suffix.length <= maxLen) return text + suffix;
    }
    return truncateString(JSON.stringify(data.slice(0, 1), null, 2), maxLen);
  }

  // Fallback: hard truncation (pretty already computed above)
  return truncateString(pretty, maxLen);
}

function truncateArrayProp(
  obj: Record<string, unknown>,
  key: string,
  arr: unknown[],
  maxLen: number
): string {
  // Estimate how many items fit based on first item size
  const firstSize = JSON.stringify(arr[0]).length + 20;
  const budget = maxLen - 200; // reserve for wrapper + message
  let n = Math.min(arr.length, Math.max(1, Math.floor(budget / firstSize)));

  // Adjust down until it fits
  for (; n >= 1; n--) {
    const trial = { ...obj, [key]: arr.slice(0, n) };
    const text = JSON.stringify(trial, null, 2);
    const suffix = `\n\n... showing ${n} of ${arr.length} items in "${key}". Use result_offset=${n} to continue, or result_filter/result_limit to refine the page.`;
    if (text.length + suffix.length <= maxLen) {
      return text + suffix;
    }
  }

  // Even 1 item doesn't fit — hard truncate
  const single = { ...obj, [key]: arr.slice(0, 1) };
  const text = JSON.stringify(single, null, 2);
  return truncateString(text, maxLen);
}

// ── Catalog helpers ───────────────────────────────────────────────

/**
 * Pre-compute shared catalog data structures.
 */
