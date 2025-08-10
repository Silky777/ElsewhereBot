export function normalize(s) {
  return String(s ?? "").toLowerCase().normalize("NFKD").replace(/\p{Diacritic}/gu, "");
}

export function levenshtein(a, b) {
  a = normalize(a); b = normalize(b);
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

export function fuzzySuggest(query, items, getText = x => String(x), limit = 5) {
  const q = normalize(query);
  const scored = items.map(item => {
    const text = getText(item);
    const t = normalize(text);
    let score = 0;
    if (t === q) score = 100;
    else if (t.startsWith(q)) score = 90;
    else if (t.includes(q)) score = 80;
    const dist = levenshtein(q, t);
    const ratio = 1 - dist / Math.max(q.length, t.length, 1);
    score = Math.max(score, Math.round(ratio * 70));
    return { item, score, text };
  }).filter(x => x.score > 20)
    .sort((a, b) => b.score - a.score || a.text.localeCompare(b.text));
  return scored.slice(0, limit).map(x => x.item);
}