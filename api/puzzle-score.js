export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const name = normalizeName(body.name);
    const difficulty = normalizeDifficulty(body.difficulty);
    const timeSeconds = clampInt(body.timeSeconds, 1, 3600);
    const livesLeft = clampInt(body.livesLeft, 0, 10);
    const errors = clampInt(body.errors, 0, 999);

    if (!name) {
      return res.status(400).json({ ok: false, error: 'invalid_name' });
    }

    const score = computeScore({ difficulty, timeSeconds, livesLeft, errors });
    const weekKey = getISOWeekKey(new Date());

    const leaderboardKey = `ws:puzzle:lb:${weekKey}`;
    const metaKey = `ws:puzzle:lb:${weekKey}:meta`;

    const currentBest = await redis(['ZSCORE', leaderboardKey, name]);
    const currentBestNum = Number(currentBest?.result ?? 0);

    if (!Number.isFinite(currentBestNum) || score > currentBestNum) {
      await redis(['ZADD', leaderboardKey, score, name]);
      await redis(['HSET', metaKey, name, JSON.stringify({
        difficulty,
        timeSeconds,
        livesLeft,
        errors,
        score,
        updatedAt: new Date().toISOString()
      })]);
    }

    const rankData = await redis(['ZREVRANK', leaderboardKey, name]);
    const rank = Number(rankData?.result ?? -1) + 1;

    return res.status(200).json({
      ok: true,
      weekKey,
      score: Math.max(score, currentBestNum || 0),
      rank
    });
  } catch (error) {
    console.error('puzzle-score error', error);
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
}

function clampInt(value, min, max) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function normalizeName(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N}\s._-]/gu, '')
    .slice(0, 18);
}

function normalizeDifficulty(value) {
  return ['3x3', '4x4', '5x5'].includes(value) ? value : '3x3';
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

  if (!url || !token) {
    throw new Error('Missing Upstash env vars');
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(command)
  });

  if (!response.ok) {
    throw new Error(`Redis HTTP ${response.status}`);
  }

  return await response.json();
}
