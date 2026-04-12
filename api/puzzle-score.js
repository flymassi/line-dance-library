function normalizeDifficulty(value) {
  return ['3x3', '4x4', '5x5'].includes(value) ? value : '3x3';
}

function normalizeName(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N}\s._-]/gu, '')
    .slice(0, 18) || 'Giocatore';
}

function normalizeText(value, max = 28) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N}\s._'/-]/gu, '')
    .slice(0, max);
}

function computeScore({ difficulty, timeSeconds, livesLeft, errors }) {
  const base = { '3x3': 180, '4x4': 360, '5x5': 620 }[difficulty] || 180;
  return Math.max(1, base + (livesLeft * 45) - (errors * 25) - (timeSeconds * 2));
}

function getISOWeekKey(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

async function redis(command) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('Missing Upstash env vars');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(command)
  });

  if (!response.ok) throw new Error(`Redis HTTP ${response.status}`);
  return await response.json();
}

function leaderboardKey(weekKey) {
  return `ws:puzzle:leaderboard:${weekKey}`;
}

function profileKey(weekKey, name) {
  return `ws:puzzle:profile:${weekKey}:${name.toLowerCase()}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const weekKey = getISOWeekKey(new Date());
    const name = normalizeName(req.body?.name);
    const year = normalizeText(req.body?.year, 12);
    const teacher = normalizeText(req.body?.teacher, 28);
    const difficulty = normalizeDifficulty(req.body?.difficulty);
    const timeSeconds = Math.max(0, Math.min(7200, Number(req.body?.timeSeconds || 0)));
    const livesLeft = Math.max(0, Math.min(10, Number(req.body?.livesLeft || 0)));
    const errors = Math.max(0, Math.min(100, Number(req.body?.errors || 0)));
    const score = computeScore({ difficulty, timeSeconds, livesLeft, errors });

    const lbKey = leaderboardKey(weekKey);
    const pfKey = profileKey(weekKey, name);
    const previousRes = await redis(['ZSCORE', lbKey, name]);
    const previousScore = Number(previousRes?.result || 0);

    if (score >= previousScore) {
      await redis(['ZADD', lbKey, score, name]);
      await redis(['HSET', pfKey, 'year', year, 'teacher', teacher, 'difficulty', difficulty, 'timeSeconds', timeSeconds, 'errors', errors, 'livesLeft', livesLeft]);
    }

    const rankRes = await redis(['ZREVRANK', lbKey, name]);
    const rank = rankRes?.result == null ? 0 : Number(rankRes.result) + 1;

    return res.status(200).json({ ok: true, weekKey, score: Math.max(score, previousScore), rank });
  } catch (error) {
    console.error('puzzle-score error', error);
    return res.status(500).json({ ok: false, error: 'Internal error' });
  }
}
