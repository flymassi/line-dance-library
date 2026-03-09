function getISOWeekKey(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function normalizeName(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N}\s._-]/gu, '')
    .slice(0, 18) || 'Giocatore';
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

function arrayToObject(arr) {
  const obj = {};
  if (!Array.isArray(arr)) return obj;
  for (let i = 0; i < arr.length; i += 2) {
    obj[arr[i]] = arr[i + 1];
  }
  return obj;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  try {
    const weekKey = getISOWeekKey(new Date());
    const lbKey = leaderboardKey(weekKey);
    const me = normalizeName(req.query?.name || '');

    const zrangeRes = await redis(['ZREVRANGE', lbKey, 0, 9, 'WITHSCORES']);
    const raw = Array.isArray(zrangeRes?.result) ? zrangeRes.result : [];

    const top = [];

    for (let i = 0; i < raw.length; i += 2) {
      const name = normalizeName(raw[i] || '');
      const score = Number(raw[i + 1] || 0);

      const profileRes = await redis(['HGETALL', profileKey(weekKey, name)]);
      const profile = arrayToObject(profileRes?.result);

      top.push({
        name,
        year: profile.year || '',
        teacher: profile.teacher || '',
        score,
        difficulty: profile.difficulty || '-',
        timeSeconds: Number(profile.timeSeconds || 0),
        errors: Number(profile.errors || 0),
        livesLeft: Number(profile.livesLeft || 0)
      });
    }

    let myRank = 0;
    let myBest = 0;

    if (me && me !== 'Giocatore') {
      const rankRes = await redis(['ZREVRANK', lbKey, me]);
      myRank = rankRes?.result == null ? 0 : Number(rankRes.result) + 1;

      const scoreRes = await redis(['ZSCORE', lbKey, me]);
      myBest = Number(scoreRes?.result || 0);
    }

    res.status(200).json({
      ok: true,
      weekKey,
      myRank,
      myBest,
      top
    });
  } catch (error) {
    console.error('puzzle-leaderboard error', error);
    res.status(500).json({
      ok: false,
      error: 'Internal error'
    });
  }
}