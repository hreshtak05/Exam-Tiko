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
function mockDecision(similar) {
  if (similar.length === 0) {
    return {
      decision: 'Անհրաժեշտ է լրացուցիչ ուսումնասիրություն',
      explanation: 'Նախկին նմանատիպ դեպքեր չեն հայտնաբերվել։ Խնդրում ենք ձեռքով վերանայել՝ հիմնվելով Հոդված 6 սկզբունքների վրա։',
      legal_basis: ['Հոդված 6', 'Հոդված 8'],
      consistency_score: 50,
    };
  }
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
3. Որոշումը պետք է լինի համաչափ (Հոդված 8)
4. Հաշվի առ մարդու իրավունքները և հավասարությունը (Հոդված 6)
5. Օգտագործիր նախորդ դեպքերը որպես հիմնական հիմք

Պատասխանը տուր ԲԱՑԱՌԱՊԵՍ JSON ֆորմատով (առանց markdown)՝
{"decision":"կոնկրետ որոշումը","explanation":"բացատրություն 2-3 նախադասությամբ","legal_basis":["Հոդված 6"],"consistency_score":0}`;

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get('/api/stats', (_req, res) => res.json(db.getStats()));

app.get('/api/cases', (req, res) => {
  res.json(db.getCases({ type: req.query.type, search: req.query.search }));
});

app.get('/api/cases/:id', (req, res) => {
  const c = db.getCaseById(req.params.id);
  if (!c) return res.status(404).json({ error: 'Դեպքը չի գտնվել' });
  res.json(c);
});

app.post('/api/cases', (req, res) => {
  const { case_type, description } = req.body;
  if (!case_type || !description) return res.status(400).json({ error: 'case_type եւ description պարտադիր են' });
  res.json(db.createCase(req.body));
});

app.post('/api/analyze', async (req, res) => {
  const { case_type, description, additional_data } = req.body;
  if (!case_type || !description) return res.status(400).json({ error: 'Դաշտերը պարտադիր են' });

  const similar = db.getSimilarCases(case_type, description);

  const similarContext = similar.length
    ? similar.map((c, i) =>
        `Դեպք #${i+1}: ${c.case_type} | ${c.description} | ${c.additional_data||'—'} → ${c.decision}`
      ).join('\n')
    : 'Նախկին դեպքեր չկան';

  if (openai) {
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Նոր դեպք:\nՏեսակ: ${case_type}\nՆկարագրություն: ${description}\nԼրացուցիչ: ${additional_data||'—'}\n\nՆախկին դեպքեր (${similar.length}):\n${similarContext}` },
        ],
        temperature: 0.2,
        max_tokens: 400,
      });
      const result = JSON.parse(completion.choices[0].message.content.trim());
      return res.json({ ...result, similar_cases: similar, ai_powered: true });
    } catch (err) {
      console.error('OpenAI error:', err.message);
    }
  }

  const mock = mockDecision(similar);
  res.json({
    ...mock, similar_cases: similar, ai_powered: false,
    note: openai ? 'AI-ն ժամանակավորապես անհասանելի է' : 'Կիրառվում է ավտոմատ վերլուծություն (OPENAI_API_KEY սահմանված չէ)',
  });
});

app.get('/api/laws', (_req, res) => res.json(db.getLaws()));

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Justitia AI → http://localhost:${PORT}`);
  console.log(process.env.OPENAI_API_KEY ? '✓ OpenAI ready' : '⚠ Mock mode (no API key)');
});

module.exports = app;
