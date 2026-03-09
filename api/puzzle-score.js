function normalizeName(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N}\s._-]/gu, '')
    .slice(0, 18) || 'Giocatore';
}

function normalizeYear(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N}\s._/-]/gu, '')
    .slice(0, 12);
}

function normalizeTeacher(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N}\s._'-]/gu, '')
    .slice(0, 28);
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
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(command)
  });

  if (!response.ok) {
    throw new Error(`Redis HTTP ${response.status}`);
  }

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
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  try {
    const body =
      typeof req.body === 'string'
        ? JSON.parse(req.body || '{}')
        : (req.body || {});

    const name = normalizeName(body.name || '');
    const year = normalizeYear(body.year || '');
    const teacher = normalizeTeacher(body.teacher || '');
    const difficulty = normalizeDifficulty(body.difficulty);
    const timeSeconds = Math.max(1, Number(body.timeSeconds) || 1);
    const livesLeft = Math.max(0, Number(body.livesLeft) || 0);
    const errors = Math.max(0, Number(body.errors) || 0);

    const weekKey = getISOWeekKey(new Date());
    const lbKey = leaderboardKey(weekKey);
    const pfKey = profileKey(weekKey, name);

    const score = computeScore({
      difficulty,
      timeSeconds,
      livesLeft,
      errors
    });

    const prevScoreRes = await redis(['ZSCORE', lbKey, name]);
    const prevScore = Number(prevScoreRes?.result || 0);

    if (score >= prevScore) {
      await redis(['ZADD', lbKey, score, name]);

      await redis([
        'HSET',
        pfKey,
        'name', name,
        'year', year,
        'teacher', teacher,
        'score', String(score),
        'difficulty', difficulty,
        'timeSeconds', String(timeSeconds),
        'livesLeft', String(livesLeft),
        'errors', String(errors),
        'updatedAt', String(Date.now())
      ]);
    }

    const rankRes = await redis(['ZREVRANK', lbKey, name]);
    const rank = rankRes?.result == null ? 0 : Number(rankRes.result) + 1;

    let passedPlayer = '';
    try {
      if (rank > 1) {
        const aheadRes = await redis(['ZREVRANGE', lbKey, rank - 2, rank - 2]);
        const aheadName = Array.isArray(aheadRes?.result) ? aheadRes.result[0] : '';
        if (aheadName && aheadName !== name) passedPlayer = aheadName;
      }
    } catch {}

    res.status(200).json({
      ok: true,
      weekKey,
      score: Math.max(score, prevScore),
      rank,
      name,
      year,
      teacher,
      passedPlayer
    });
  } catch (error) {
    console.error('puzzle-score error', error);
    res.status(500).json({
      ok: false,
      error: 'Internal error'
    });
  }
}