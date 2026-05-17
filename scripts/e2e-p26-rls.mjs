// E2E RLS test for P26 community posts.
// SignIn each test account, then for each (user, table) try SELECT/INSERT/DELETE.
// Report a matrix of expected vs actual.
//
// Usage: node scripts/e2e-p26-rls.mjs

const SUPABASE_URL = 'https://vhkjvnpxcqlmpokrgymx.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZoa2p2bnB4Y3FsbXBva3JneW14Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5OTIwNTUsImV4cCI6MjA5MDU2ODA1NX0.dNpjAbnPySgSsh8iSSZAl0XszHxfVPRCj0d0pLFcbXI';

const ACCOUNTS = [
  { role: 'cavalier',     email: 'sarah.l@equishow.app',   password: 'test123'  },
  { role: 'coach',        email: 'emilie.l@equishow.app',  password: 'test123'  },
  { role: 'organisateur', email: 'julien.m@equishow.app',  password: 'test123'  },
  { role: 'admin',        email: 'admin@equishow.app',     password: 'admin123' },
];

const TABLES = ['posts_community', 'posts_coach', 'posts_organisateur'];

// Expected matrix: SELECT (can read), INSERT (can write), CROSS_DELETE (always blocked except own)
// For SELECT: 'allow' = should return rows (>=0 with no error), 'block' = returns 0 rows (RLS hides)
// For INSERT: 'allow' = 201, 'block' = 403 / RLS violation
const EXPECTED = {
  cavalier:     { posts_community: { select: 'allow', insert: 'allow' }, posts_coach: { select: 'block', insert: 'block' }, posts_organisateur: { select: 'block', insert: 'block' } },
  coach:        { posts_community: { select: 'allow', insert: 'allow' }, posts_coach: { select: 'allow', insert: 'allow' }, posts_organisateur: { select: 'block', insert: 'block' } },
  organisateur: { posts_community: { select: 'allow', insert: 'allow' }, posts_coach: { select: 'block', insert: 'block' }, posts_organisateur: { select: 'allow', insert: 'allow' } },
  admin:        { posts_community: { select: 'allow', insert: 'allow' }, posts_coach: { select: 'allow', insert: 'allow' }, posts_organisateur: { select: 'allow', insert: 'allow' } },
};

async function signIn(acc) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: acc.email, password: acc.password }),
  });
  const body = await r.json();
  if (!r.ok) throw new Error(`signin ${acc.email}: ${r.status} ${JSON.stringify(body)}`);
  return { id: body.user.id, jwt: body.access_token };
}

function h(jwt) {
  return { apikey: ANON_KEY, Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' };
}

async function trySelect(jwt, table) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=id&limit=1`, { headers: h(jwt) });
  const body = await r.json().catch(() => null);
  return { ok: r.ok, status: r.status, rowCount: Array.isArray(body) ? body.length : null, body };
}

async function tryInsert(jwt, uid, table) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...h(jwt), Prefer: 'return=representation' },
    body: JSON.stringify({ auteur_id: uid, contenu: `[e2e test ${new Date().toISOString()}]` }),
  });
  const body = await r.json().catch(() => null);
  const insertedId = Array.isArray(body) && body[0]?.id;
  return { ok: r.ok, status: r.status, insertedId, body };
}

async function tryDelete(jwt, table, id) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, { method: 'DELETE', headers: h(jwt) });
  return { ok: r.ok, status: r.status };
}

function judge(expected, result) {
  if (expected === 'allow') return result.ok ? 'PASS' : 'FAIL';
  return !result.ok || result.rowCount === 0 ? 'PASS' : 'FAIL';
}

async function main() {
  const sessions = {};
  for (const acc of ACCOUNTS) {
    const s = await signIn(acc);
    sessions[acc.role] = { ...s, email: acc.email };
    console.log(`[ok] signed in ${acc.role} ${acc.email} → ${s.id}`);
  }

  const created = []; // for cleanup
  const results = [];

  for (const acc of ACCOUNTS) {
    const s = sessions[acc.role];
    for (const t of TABLES) {
      const exp = EXPECTED[acc.role][t];
      const sel = await trySelect(s.jwt, t);
      const ins = await tryInsert(s.jwt, s.id, t);
      if (ins.insertedId) created.push({ table: t, id: ins.insertedId, jwt: s.jwt });
      const selVerdict = judge(exp.select, sel);
      const insVerdict = judge(exp.insert, ins);
      results.push({
        role: acc.role, table: t,
        select_exp: exp.select, select_status: sel.status, select_rows: sel.rowCount, select_verdict: selVerdict,
        insert_exp: exp.insert, insert_status: ins.status, insert_verdict: insVerdict,
      });
    }
  }

  // Cross-delete test: cavalier tries to DELETE a post created by admin in posts_community.
  const adminPost = created.find((c) => c.table === 'posts_community' && c.jwt === sessions.admin.jwt);
  let crossDelete = null;
  if (adminPost) {
    const del = await tryDelete(sessions.cavalier.jwt, 'posts_community', adminPost.id);
    // RLS hides the row → DELETE returns 204 with 0 rows. We need to verify row still exists.
    const reSel = await fetch(`${SUPABASE_URL}/rest/v1/posts_community?id=eq.${adminPost.id}&select=id`, { headers: h(sessions.admin.jwt) });
    const reBody = await reSel.json().catch(() => []);
    const stillExists = Array.isArray(reBody) && reBody.length === 1;
    crossDelete = { status: del.status, stillExists, verdict: stillExists ? 'PASS (cavalier could not delete admin post)' : 'FAIL (cavalier deleted admin post!)' };
  }

  // ─── Phase 2: com_posts_* (commentaires) ────────────────────────────────
  // Create one parent post per scope (admin owns them) so commenters have a target.
  const parentPosts = {};
  for (const t of TABLES) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${t}`, {
      method: 'POST',
      headers: { ...h(sessions.admin.jwt), Prefer: 'return=representation' },
      body: JSON.stringify({ auteur_id: sessions.admin.id, contenu: `[e2e parent ${t}]` }),
    });
    const body = await r.json();
    parentPosts[t] = body[0].id;
    created.push({ table: t, id: body[0].id, jwt: sessions.admin.jwt });
  }

  const COM_TABLES = ['com_posts_community', 'com_posts_coach', 'com_posts_organisateur'];
  const COM_PARENT = { com_posts_community: 'posts_community', com_posts_coach: 'posts_coach', com_posts_organisateur: 'posts_organisateur' };

  async function tryInsertComment(jwt, uid, table, postId) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: { ...h(jwt), Prefer: 'return=representation' },
      body: JSON.stringify({ post_id: postId, auteur_id: uid, texte: `[e2e comment ${new Date().toISOString()}]` }),
    });
    const body = await r.json().catch(() => null);
    return { ok: r.ok, status: r.status, insertedId: Array.isArray(body) && body[0]?.id, body };
  }

  const comResults = [];
  for (const acc of ACCOUNTS) {
    const s = sessions[acc.role];
    for (const ct of COM_TABLES) {
      const parentTable = COM_PARENT[ct];
      const exp = EXPECTED[acc.role][parentTable]; // same matrix as parent
      const sel = await trySelect(s.jwt, ct);
      const ins = await tryInsertComment(s.jwt, s.id, ct, parentPosts[parentTable]);
      if (ins.insertedId) created.push({ table: ct, id: ins.insertedId, jwt: s.jwt });
      comResults.push({
        role: acc.role, table: ct,
        select_exp: exp.select, select_status: sel.status, select_rows: sel.rowCount, select_verdict: judge(exp.select, sel),
        insert_exp: exp.insert, insert_status: ins.status, insert_verdict: judge(exp.insert, ins),
      });
    }
  }

  console.log('\n──────── Comments matrix ────────');
  for (const r of comResults) {
    console.log(
      `${r.role.padEnd(13)} | ${r.table.padEnd(24)} | SELECT exp=${r.select_exp} status=${r.select_status} rows=${r.select_rows} → ${r.select_verdict} | INSERT exp=${r.insert_exp} status=${r.insert_status} → ${r.insert_verdict}`
    );
  }
  const comFailed = comResults.filter((r) => r.select_verdict === 'FAIL' || r.insert_verdict === 'FAIL');

  // Cleanup: each owner deletes their own post/comment.
  for (const c of created) {
    await tryDelete(c.jwt, c.table, c.id);
  }

  console.log('\n──────── Matrix ────────');
  for (const r of results) {
    console.log(
      `${r.role.padEnd(13)} | ${r.table.padEnd(20)} | SELECT exp=${r.select_exp} status=${r.select_status} rows=${r.select_rows} → ${r.select_verdict} | INSERT exp=${r.insert_exp} status=${r.insert_status} → ${r.insert_verdict}`
    );
  }
  console.log('\n──────── Cross-delete test ────────');
  console.log(crossDelete);

  const failed = results.filter((r) => r.select_verdict === 'FAIL' || r.insert_verdict === 'FAIL');
  const xfail = crossDelete && crossDelete.verdict.startsWith('FAIL');
  const totalFail = failed.length + comFailed.length + (xfail ? 1 : 0);
  console.log(`\n${totalFail === 0 ? '✅ ALL PASS' : `❌ posts_fail=${failed.length} com_fail=${comFailed.length} xdelete=${xfail}`}`);
  process.exit(totalFail === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(2); });
