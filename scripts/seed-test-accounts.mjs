// Crée les 5 comptes de test via Admin API (path officiel gotrue).
// Usage :
//   SUPABASE_SERVICE_ROLE_KEY=eyJ... node scripts/seed-test-accounts.mjs
// Récupérer la key : `supabase projects api-keys --project-ref vhkjvnpxcqlmpokrgymx`.

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://vhkjvnpxcqlmpokrgymx.supabase.co';
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_ROLE) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY env var.');
  console.error('  → supabase projects api-keys --project-ref vhkjvnpxcqlmpokrgymx');
  process.exit(1);
}

// Note : on évite les TLDs .test/.invalid/.example (RFC 2606, rejetés par
// gotrue avec une erreur 500 trompeuse "Database error checking email").
// On évite aussi les domaines sans DNS routable (ex: equishow.fr non configuré)
// qui causent le même symptôme. @equishow.app passe la validation DNS de gotrue.
const accounts = [
  { email: 'sarah.l@equishow.app',   password: 'test123',  prenom: 'Sarah',  nom: 'Lefebvre', role: 'cavalier'     },
  { email: 'cavalier2@equishow.app', password: 'test123',  prenom: 'Sophie', nom: 'Dupont',   role: 'cavalier'     },
  { email: 'emilie.l@equishow.app',  password: 'test123',  prenom: 'Émilie', nom: 'Laurent',  role: 'coach'        },
  { email: 'julien.m@equishow.app',  password: 'test123',  prenom: 'Julien', nom: 'Mercier',  role: 'organisateur' },
  { email: 'admin@equishow.app',     password: 'admin123', prenom: 'Admin',  nom: 'Equishow', role: 'admin'        },
];

const headers = {
  'Authorization': `Bearer ${SERVICE_ROLE}`,
  'apikey': SERVICE_ROLE,
  'Content-Type': 'application/json',
};

const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZoa2p2bnB4Y3FsbXBva3JneW14Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5OTIwNTUsImV4cCI6MjA5MDU2ODA1NX0.dNpjAbnPySgSsh8iSSZAl0XszHxfVPRCj0d0pLFcbXI';

async function signInToGetId(acc) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: acc.email, password: acc.password }),
  });
  const body = await r.json();
  if (!r.ok) throw new Error(`signin ${acc.email}: ${r.status} ${JSON.stringify(body)}`);
  return body.user;
}

async function createAuthUser(acc) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      email: acc.email,
      password: acc.password,
      email_confirm: true,
      user_metadata: { prenom: acc.prenom, nom: acc.nom, role: acc.role },
    }),
  });
  const body = await r.json();
  if (r.status === 422 && body.error_code === 'email_exists') {
    // User existe déjà : on récupère son id via sign-in (admin ListUsers bug 500).
    return await signInToGetId(acc);
  }
  if (!r.ok) throw new Error(`auth create ${acc.email}: ${r.status} ${JSON.stringify(body)}`);
  return body;
}

async function upsertPublicUser(userId, acc) {
  // PostgREST upsert : on prefer resolution=merge-duplicates
  const r = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({
      id: userId,
      email: acc.email,
      prenom: acc.prenom,
      nom: acc.nom,
      pseudo: `${acc.prenom}${acc.nom[0]}`,
      role: acc.role,
      plan: 'Gratuit',
      initiales: (acc.prenom[0] + acc.nom[0]).toUpperCase(),
    }),
  });
  const body = await r.text();
  if (!r.ok) throw new Error(`public.users upsert ${acc.email}: ${r.status} ${body}`);
  return body;
}

for (const acc of accounts) {
  try {
    const created = await createAuthUser(acc);
    await upsertPublicUser(created.id, acc);
    console.log(`✓ ${acc.email.padEnd(35)} role=${acc.role.padEnd(13)} id=${created.id}`);
  } catch (e) {
    console.error(`✗ ${acc.email}: ${e.message}`);
  }
}
