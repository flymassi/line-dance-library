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

function profileKey(weekKey, playerId) {
  return `ws:puzzle:profile:${weekKey}:${playerId}`;
}

function leaderboardKey(weekKey) {
  return `ws:puzzle:leaderboard:${weekKey}`;
}

function shortPlayerSuffix(playerId) {
  return String(playerId || '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(-2) || 'XX';
}

function normalizeName(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N}\s._-]/gu, '')
    .slice(0, 18) || 'Giocatore';
}

function decorateNames(rows) {
  const counts = new Map();
  rows.forEach(row => {
    const base = normalizeName(row.name);
    counts.set(base, (counts.get(base) || 0) + 1);
  });

  return rows.map(row => {
    const base = normalizeName(row.name);
    const duplicated = (counts.get(base) || 0) > 1;
    return {
      ...row,
      displayName: duplicated ? `${base} · ${shortPlayerSuffix(row.playerId)}` : base
    };
  });
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  try {
    const weekKey = getISOWeekKey(new Date());
    const lbKey = leaderboardKey(weekKey);
    const myPlayerId = String(req.query?.playerId || '').trim();

    const zrangeRes = await redis(["ZREVRANGE", lbKey, 0, 9, "WITHSCORES"]);
    const raw = Array.isArray(zrangeRes?.result) ? zrangeRes.result : [];

    const top = [];
    for (let i = 0; i < raw.length; i += 2) {
      const playerId = String(raw[i] || '');
      const score = Number(raw[i + 1] || 0);
      const profileRes = await redis(["HGETALL", profileKey(weekKey, playerId)]);
      const arr = Array.isArray(profileRes?.result) ? profileRes.result : [];

      const obj = {};
      for (let j = 0; j < arr.length; j += 2) {
        obj[arr[j]] = arr[j + 1];
      }

      top.push({
        playerId,
        name: normalizeName(obj.name || 'Giocatore'),
        score,
        difficulty: obj.difficulty || '-',
        timeSeconds: Number(obj.timeSeconds || 0),
        errors: Number(obj.errors || 0),
        livesLeft: Number(obj.livesLeft || 0)
      });
    }

    const decoratedTop = decorateNames(top);

    let myRank = 0;
    let myBest = 0;
    let myDisplayName = '';

    if (myPlayerId) {
      const rankRes = await redis(["ZREVRANK", lbKey, myPlayerId]);
      myRank = rankRes?.result == null ? 0 : Number(rankRes.result) + 1;

      const scoreRes = await redis(["ZSCORE", lbKey, myPlayerId]);
      myBest = Number(scoreRes?.result || 0);

      const profileRes = await redis(["HGETALL", profileKey(weekKey, myPlayerId)]);
      const arr = Array.isArray(profileRes?.result) ? profileRes.result : [];
      const obj = {};
      for (let j = 0; j < arr.length; j += 2) {
        obj[arr[j]] = arr[j + 1];
      }

      const myName = normalizeName(obj.name || '');
      if (myName) {
        const duplicated = decoratedTop.filter(row => normalizeName(row.name) === myName).length > 1;
        myDisplayName = duplicated ? `${myName} · ${shortPlayerSuffix(myPlayerId)}` : myName;
      }
    }

    res.status(200).json({
      ok: true,
      weekKey,
      myRank,
      myBest,
      myDisplayName,
      top: decoratedTop
    });
  } catch (error) {
    console.error('puzzle-leaderboard error', error);
    res.status(500).json({
      ok: false,
      error: 'Internal error'
    });
  }
}