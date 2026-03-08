export default async function handler(req, res) {
  try {
    const name = normalizeName(req.query?.name || '');
    const weekKey = getISOWeekKey(new Date());
    const leaderboardKey = `ws:puzzle:lb:${weekKey}`;
    const metaKey = `ws:puzzle:lb:${weekKey}:meta`;

    const topData = await redis(['ZREVRANGE', leaderboardKey, 0, 9, 'WITHSCORES']);
    const raw = Array.isArray(topData?.result) ? topData.result : [];

    const names = [];
    const scores = [];
    for (let i = 0; i < raw.length; i += 2) {
      names.push(raw[i]);
      scores.push(Number(raw[i + 1] || 0));
    }

    const top = [];
    for (let i = 0; i < names.length; i++) {
      const player = names[i];
      const metaData = await redis(['HGET', metaKey, player]);
      let meta = {};
      try { meta = JSON.parse(metaData?.result || '{}'); } catch {}
      top.push({
        name: player,
        score: scores[i],
        difficulty: meta.difficulty || '-',
        timeSeconds: Number(meta.timeSeconds || 0),
        livesLeft: Number(meta.livesLeft || 0),
        errors: Number(meta.errors || 0)
      });
    }

    let myRank = 0;
    let myBest = 0;
    if (name) {
      const rankData = await redis(['ZREVRANK', leaderboardKey, name]);
      const bestData = await redis(['ZSCORE', leaderboardKey, name]);
      myRank = Number(rankData?.result ?? -1) + 1;
      myBest = Number(bestData?.result ?? 0);
      if (myRank < 0) myRank = 0;
    }

    return res.status(200).json({
      ok: true,
      weekKey,
      myRank,
      myBest,
      top
    });
  } catch (error) {
    console.error('puzzle-leaderboard error', error);
    return res.status(500).json({
      ok: false,
      error: 'internal_error',
      top: []
    });
  }
}

function normalizeName(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N}\s._-]/gu, '')
    .slice(0, 18);
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
