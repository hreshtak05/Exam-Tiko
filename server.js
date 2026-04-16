require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const db      = require('./db');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── OpenAI (optional) ────────────────────────────────────────────────────────
let openai = null;
if (process.env.OPENAI_API_KEY) {
  const { default: OpenAI } = require('openai');
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function findSimilarCases(case_type, description) {
  // 1. Exact type match first
  let rows = db.prepare(`
    SELECT * FROM cases
    WHERE case_type = ?
    ORDER BY created_at DESC
    LIMIT 6
  `).all(case_type);

  // 2. Keyword fallback if too few
  if (rows.length < 3 && description) {
    const keyword = description.split(/\s+/)[0];
    const extra = db.prepare(`
      SELECT * FROM cases
      WHERE case_type != ? AND (description LIKE ? OR additional_data LIKE ?)
      ORDER BY created_at DESC
      LIMIT ${4 - rows.length}
    `).all(case_type, `%${keyword}%`, `%${keyword}%`);
    rows = [...rows, ...extra];
  }

  return rows;
}

function mockDecision(case_type, description, additional_data, similar) {
  if (similar.length === 0) {
    return {
      decision: 'Անհրաժեշտ է լրացուցիչ ուսումնասիրություն',
      explanation: 'Նախկին նմանատիպ դեպքեր չեն հայտնաբերվել։ Խնդրում ենք ձեռքով վերանայել՝ հիմնվելով Հոդված 6 սկզբունքների վրա։',
      legal_basis: ['Հոդված 6', 'Հոդված 8'],
      consistency_score: 50,
    };
  }
  // Use most common decision among similar
  const freq = {};
  similar.forEach(c => { freq[c.decision] = (freq[c.decision] || 0) + 1; });
  const best = Object.entries(freq).sort((a, b) => b[1] - a[1])[0];
  const avgScore = Math.round(similar.reduce((s, c) => s + (c.consistency_score || 80), 0) / similar.length);

  return {
    decision: best[0],
    explanation: `Հոդված 7-ի հիման վրա հայտնաբերվել է ${similar.length} նմանատիպ դեպք։ Նախկին որոշման հիման վրա առաջարկվում է նույն ելքը՝ ապահովելով կամայականության բացակայություն։`,
    legal_basis: ['Հոդված 7', 'Հոդված 8'],
    consistency_score: Math.min(avgScore + 5, 99),
  };
}

const SYSTEM_PROMPT = `Դու վարչական որոշումների աջակցության համակարգ ես։ Քո նպատակն է առաջարկել արդար, համաչափ և օրենքներին համապատասխան որոշումներ։

Դու պետք է պարտադիր հետևես հետևյալ սկզբունքներին՝

1. Նույնատիպ դեպքերի համար առաջարկիր նույն որոշումը (Հոդված 7)
2. Մի տուր տարբեր որոշում առանց հիմնավորված տարբերության
3. Որոշումը պետք է լինի համաչափ՝ ոչ չափազանց խիստ, ոչ չափազանց մեղմ (Հոդված 8)
4. Հաշվի առ մարդու իրավունքները և հավասարությունը (Հոդված 6)
5. Օգտագործիր նախորդ դեպքերը որպես հիմնական հիմք
6. Եթե կան մի քանի տարբերակներ, ընտրիր ամենահիմնավորվածը

Պատասխանը տուր ԲԱՑԱՌԱՊԵՍ JSON ֆորմատով (առանց markdown)՝
{
  "decision": "կոնկրետ որոշումը (կարճ, հստակ)",
  "explanation": "բացատրություն 2-3 նախադասությամբ",
  "legal_basis": ["Հոդված 6", "Հոդված 7", "Հոդված 8"],
  "consistency_score": 0-100
}`;

// ─── Routes ───────────────────────────────────────────────────────────────────

// AUTH
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  if (username === 'admin' && password === 'admin123') {
    return res.json({ success: true, user: { name: 'Ադմինիստրատոր', role: 'Ղեկավար' } });
  }
  res.status(401).json({ error: 'Սխալ մուտքանուն կամ գաղտնաբառ' });
});

// STATS
app.get('/api/stats', (req, res) => {
  const total   = db.prepare('SELECT COUNT(*) as n FROM cases').get().n;
  const today   = db.prepare("SELECT COUNT(*) as n FROM cases WHERE date(created_at)=date('now')").get().n;
  const byType  = db.prepare('SELECT case_type, COUNT(*) as n FROM cases GROUP BY case_type ORDER BY n DESC').all();
  const avgScore = db.prepare('SELECT AVG(consistency_score) as avg FROM cases').get().avg || 0;
  res.json({ total, today, byType, avgScore: Math.round(avgScore) });
});

// CASES LIST
app.get('/api/cases', (req, res) => {
  const { type, search } = req.query;
  let sql = 'SELECT * FROM cases WHERE 1=1';
  const params = [];
  if (type)   { sql += ' AND case_type = ?'; params.push(type); }
  if (search) { sql += ' AND (description LIKE ? OR case_type LIKE ? OR decision LIKE ?)';
                params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  sql += ' ORDER BY created_at DESC';
  res.json(db.prepare(sql).all(...params));
});

// SINGLE CASE
app.get('/api/cases/:id', (req, res) => {
  const c = db.prepare('SELECT * FROM cases WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Դեպքը չի գտնվել' });
  res.json(c);
});

// SAVE CASE
app.post('/api/cases', (req, res) => {
  const { case_type, description, additional_data, decision, explanation, legal_basis, consistency_score } = req.body;
  if (!case_type || !description) return res.status(400).json({ error: 'case_type եւ description պարտադիր են' });
  const result = db.prepare(`
    INSERT INTO cases (case_type, description, additional_data, decision, explanation, legal_basis, consistency_score)
    VALUES (?,?,?,?,?,?,?)
  `).run(case_type, description, additional_data || null, decision || null,
         explanation || null, JSON.stringify(legal_basis || []), consistency_score || 0);
  res.json(db.prepare('SELECT * FROM cases WHERE id = ?').get(result.lastInsertRowid));
});

// AI ANALYZE
app.post('/api/analyze', async (req, res) => {
  const { case_type, description, additional_data } = req.body;
  if (!case_type || !description) return res.status(400).json({ error: 'Դաշտերը պարտադիր են' });

  const similar = findSimilarCases(case_type, description);

  const similarContext = similar.length > 0
    ? similar.map((c, i) =>
        `Դեպք #${i + 1}:\n  Տեսակ: ${c.case_type}\n  Նկարագրություն: ${c.description}\n  Լրացուցիչ: ${c.additional_data || '—'}\n  Որոշում: ${c.decision}\n  Հիմնավորում: ${c.explanation}`
      ).join('\n\n')
    : 'Նախկին նմանատիպ դեպքեր չեն հայտնաբերվել';

  const userPrompt = `Նոր դեպք.
  Տեսակ: ${case_type}
  Նկարագրություն: ${description}
  Լրացուցիչ տվյալներ: ${additional_data || '—'}

Նախկին նմանատիպ դեպքեր (${similar.length} հատ):
${similarContext}

Ի հիմք ընդ վերոնշյալ, ի՞նչ որոշում կընդունես:`;

  // Try OpenAI
  if (openai) {
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user',   content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 500,
      });
      const raw = completion.choices[0].message.content.trim();
      const result = JSON.parse(raw);
      return res.json({ ...result, similar_cases: similar, ai_powered: true });
    } catch (err) {
      console.error('OpenAI error:', err.message);
    }
  }

  // Fallback — rule-based mock
  const mock = mockDecision(case_type, description, additional_data, similar);
  res.json({ ...mock, similar_cases: similar, ai_powered: false,
             note: openai ? 'AI-ն ժամանակավորապես անհասանելի է, օգտագործվում է ավտոմատ վերլուծություն' : 'Կիրառվում է ավտոմատ վերլուծություն (OPENAI_API_KEY-ը սահմանված չէ)' });
});

// LAWS
app.get('/api/laws', (_req, res) => {
  res.json(db.prepare('SELECT * FROM laws ORDER BY id').all());
});

// Fallback → SPA
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  const key = process.env.OPENAI_API_KEY ? '✓ OpenAI API բանալին կա' : '⚠ OpenAI API բանալի չկա — կաշխատի mock mode-ով';
  console.log(`\nJustitia AI → http://localhost:${PORT}`);
  console.log(key);
});
