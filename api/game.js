// EIN backend: one Vercel serverless function. Storage = Upstash Redis (REST).
const crypto = require('crypto');
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOK = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const ADMIN = process.env.ADMIN_SECRET;
const rd = async (...c) => {
  const r = await fetch(URL_, { method: 'POST', headers: { Authorization: 'Bearer ' + TOK }, body: JSON.stringify(c) });
  const j = await r.json(); if (j.error) throw new Error(j.error); return j.result;
};
const get = async k => { const v = await rd('GET', k); return v ? JSON.parse(v) : null; };
const put = (k, v) => rd('SET', k, JSON.stringify(v));
const savep = p => put('p:' + p.id, p);

const KW = { love: 'love kiss heart rose', fire: 'fire flame dragon sun blaze', water: 'water ocean ice sea tide', dark: 'dark shadow night skull reaper', nature: 'leaf forest tree flower king', star: 'star moon cosmic galaxy light' };
const TY = Object.keys(KW), BOTS = ['Rusty', 'Mochi', 'Grim', 'Vex'];
const PRE = ['Crimson', 'Eternal', 'Silent', 'Velvet', 'Shattering', 'Radiant', 'Hollow', 'Burning', 'Midnight', 'Fatal', 'Rusty', 'Sleepy'];
const NO = ['Embrace', 'Pulse', 'Storm', 'Whisper', 'Fang', 'Echo', 'Bloom', 'Requiem', 'Kiss', 'Verdict', 'Slap', 'Nap'];
function H(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function R(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

function gen(title, img, desc, sc, seed) {
  const r = R(H(title + desc + seed)), p = a => a[~~(r() * a.length)], lw = (title + ' ' + desc).toLowerCase();
  const t = TY.find(k => KW[k].split(' ').some(w => lw.includes(w))) || p(TY), b = desc ? sc : 0;
  const s = !desc ? (r() < .2 ? 2 : 1) : sc < 20 ? 1 : sc < 40 ? 2 : sc < 60 ? 3 : sc < 80 ? 4 : 5;
  const n = () => ~~(28 + b * .55 + r() * 14);
  return { id: crypto.randomBytes(4).toString('hex'), title, img, t, s, sc: b, hp: 60 + ~~(b * 1.6) + ~~(r() * 15), atk: n(), def: n(), spd: n(),
    m: [0, 1].map(i => ({ n: p(PRE) + ' ' + p(NO), d: ~~((i ? 1.7 : 1) * (24 + b * .6 + r() * 8)) })), desc: desc || 'Nobody wrote anything about this one.' };
}
async function judge(d) {
  if (!d) return 0;
  try {
    if (process.env.ANTHROPIC_API_KEY) {
      const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST',
        headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 10, messages: [{ role: 'user', content: 'Rate 0-100 how funny or epic this trading card description is (take the better of the two; spam or gibberish under 15). Reply with the number only.\n' + JSON.stringify(d) }] }) });
      const n = parseInt((await r.json()).content[0].text); if (n >= 0) return Math.min(100, n);
    }
  } catch (e) {}
  const w = d.split(/\s+/), u = new Set(w.map(x => x.toLowerCase())).size;
  return Math.min(70, Math.round(Math.min(w.length, 20) * 2 + u * 1.2 + (/!|lol|haha|dragon|ultimate|destroy|infinite|legend/i.test(d) ? 12 : 0)));
}
const adv = (a, b) => { const i = TY.indexOf(a.t), j = TY.indexOf(b.t); return j === (i + 1) % 6 ? 1.3 : i === (j + 1) % 6 ? .77 : 1; };
function sim(a, b) {
  let ha = a.hp, hb = b.hp, r = [], t = 0; const fa = a.spd >= b.spd;
  while (ha > 0 && hb > 0 && t < 40) {
    for (const w of fa ? [0, 1] : [1, 0]) {
      if (ha <= 0 || hb <= 0) break;
      const x = w ? b : a, y = w ? a : b, m = t % 3 == 2 ? x.m[1] : x.m[0];
      const d = Math.max(5, Math.round(m.d * (x.atk / 60) * (60 / (60 + y.def)) * adv(x, y)));
      if (w) ha -= d; else hb -= d;
      r.push({ w, m: m.n, d, ha: Math.max(0, ha) / a.hp, hb: Math.max(0, hb) / b.hp });
    } t++;
  }
  return { win: hb <= 0 || (ha > 0 && ha / a.hp >= hb / b.hp), r };
}
const num = (x, lo, hi, d) => { x = +x; return isNaN(x) ? d : Math.max(lo, Math.min(hi, Math.round(x))); };
const top = c => c.slice().sort((a, b) => (b.hp + b.atk * 2 + b.def + b.spd) - (a.hp + a.atk * 2 + a.def + a.spd));

module.exports = async (req, res) => {
  try {
    if (!URL_ || !TOK) return res.status(500).json({ err: 'Database not connected (see setup steps).' });
    const q = req.body || {}, a = q.a, code = String(q.code || '').trim();
    if (code.length < 3) return res.json({ err: 'Code is too short.' });
    const id = crypto.createHash('sha256').update('ein:' + code).digest('hex').slice(0, 24), isAdmin = !!ADMIN && code === ADMIN;
    let P = await get('p:' + id);
    if (a === 'login') {
      if (!P) {
        const name = String(q.name || '').trim().slice(0, 16);
        if (!name) return res.json({ need: true });
        P = { id, name, coins: 100, cards: [], w: 0, l: 0 }; await savep(P); await rd('SADD', 'players', id);
      }
      return res.json({ p: P, admin: isAdmin });
    }
    if (!P) return res.json({ err: 'Unknown player.' });
    if (a === 'me') return res.json({ p: P });
    if (a === 'forge') {
      if (P.cards.length >= 8) return res.json({ err: 'Vault is full (8). Delete a card first.' });
      const title = String(q.title || '').trim().slice(0, 22); if (!title) return res.json({ err: 'Give it a title.' });
      const desc = String(q.desc || '').trim().slice(0, 140), img = String(q.img || '').slice(0, 90000);
      const c = gen(title, img, desc, await judge(desc), id); P.cards.unshift(c); await savep(P); return res.json({ p: P, card: c });
    }
    if (a === 'del') { P.cards = P.cards.filter(c => c.id !== q.cid); await savep(P); return res.json({ p: P }); }
    if (a === 'arena') {
      const ids = (await rd('SMEMBERS', 'players')).filter(x => x !== id).slice(0, 30);
      const all = (await Promise.all(ids.map(x => get('p:' + x)))).filter(x => x && x.cards.length);
      const pl = all.map(o => ({ pid: o.id, name: o.name, w: o.w, l: o.l, cards: top(o.cards).slice(0, 2) }));
      const bots = BOTS.map((n, i) => ({ pid: 'bot:' + i, name: n + ' (bot)', w: 0, l: 0, cards: [botCard(i)] }));
      return res.json({ players: pl, bots });
    }
    if (a === 'fight') {
      const mc = P.cards.find(c => c.id === q.cid); let O = null, oc, on;
      if (String(q.pid).startsWith('bot:')) { const n = +String(q.pid).slice(4); on = BOTS[n] + ' (bot)'; oc = botCard(n); }
      else { if (q.pid === id) return res.json({ err: "You can't fight yourself." }); O = await get('p:' + q.pid); oc = O && O.cards.find(c => c.id === q.oid); on = O && O.name; }
      if (!mc || !oc) return res.json({ err: 'That card is gone. Refresh the arena.' });
      const { win, r } = sim(mc, oc), gain = win ? (O ? 25 : 15) : 5;
      P.coins += gain; win ? P.w++ : P.l++; await savep(P);
      if (O) { O.coins += win ? 0 : 10; win ? O.l++ : O.w++; await savep(O); }
      return res.json({ win, r, gain, coins: P.coins, w: P.w, l: P.l, on });
    }
    if (a === 'shop') {
      const cs = (await rd('SMEMBERS', 'ac')), rows = (await Promise.all(cs.map(c => get('a:' + c)))).filter(x => x && x.price > 0 && !x.claimed);
      return res.json({ items: rows.map(x => ({ sid: x.sid, card: x.card, price: x.price })) });
    }
    if (a === 'buy' || a === 'redeem') {
      if (P.cards.length >= 8) return res.json({ err: 'Vault is full (8). Delete a card first.' });
      let rec;
      if (a === 'redeem') rec = await get('a:' + String(q.ac || '').trim().toUpperCase());
      else { const cs = await rd('SMEMBERS', 'ac'); rec = (await Promise.all(cs.map(c => get('a:' + c)))).find(x => x && x.sid === q.sid && x.price > 0); if (rec && P.coins < rec.price) return res.json({ err: 'Not enough coins.' }); }
      if (!rec) return res.json({ err: 'No card found for that.' });
      if (rec.claimed) return res.json({ err: 'That card was already claimed.' });
      rec.claimed = id; await put('a:' + rec.code, rec);
      if (a === 'buy') P.coins -= rec.price;
      P.cards.unshift({ ...rec.card, id: crypto.randomBytes(4).toString('hex') }); await savep(P); return res.json({ p: P, card: rec.card });
    }
    if (!isAdmin) return res.json({ err: 'Nope.' });
    if (a === 'admin_create') {
      const c = gen(String(q.title || 'Admin Card').slice(0, 22), String(q.img || '').slice(0, 90000), String(q.desc || '').slice(0, 140), 100, 'adm' + Date.now());
      Object.assign(c, { t: TY.includes(q.t) ? q.t : c.t, s: num(q.s, 1, 5, 5), hp: num(q.hp, 1, 999, 300), atk: num(q.atk, 1, 300, 120), def: num(q.def, 1, 300, 100), spd: num(q.spd, 1, 300, 100) });
      c.m[0].d = num(q.d1, 1, 999, 90); c.m[1].d = num(q.d2, 1, 999, 160);
      const k = 'EIN-' + crypto.randomBytes(3).toString('hex').toUpperCase();
      await put('a:' + k, { code: k, sid: crypto.randomBytes(4).toString('hex'), card: c, price: num(q.price, 0, 99999, 0), claimed: null }); await rd('SADD', 'ac', k);
      return res.json({ code: k });
    }
    if (a === 'admin_list') { const cs = await rd('SMEMBERS', 'ac'); return res.json({ list: (await Promise.all(cs.map(c => get('a:' + c)))).filter(Boolean).map(x => ({ code: x.code, title: x.card.title, price: x.price, claimed: !!x.claimed })) }); }
    res.json({ err: 'Unknown action.' });
  } catch (e) { res.status(500).json({ err: 'Server error: ' + e.message }); }
};
function botCard(n) { const c = gen(BOTS[n] + "'s pet", '', 'bot', 20 + n * 18, 'bot' + n); c.id = 'bot' + n; c.desc = 'A training bot. Not very bright.'; return c; }
