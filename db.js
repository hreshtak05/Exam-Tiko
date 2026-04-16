// In-memory store — no native dependencies, works on Vercel serverless
// Note: data resets on cold starts; fine for a demo prototype.

let nextCaseId = 1;
let nextLawId  = 1;

const laws = [
  {
    id: nextLawId++, article: 'Հոդված 6', law_number: 'ՀՕ-180',
    law_title: 'Հայեցողական լիազորություններ',
    description: 'Վարչական մարմինն ընտրում է ՀՀ օրենսդրությամբ սահմանված իրավաչափ տարբերակներից մեկը՝ ապահովելով մարդու իրավունքների պաշտպանություն, իրավահավասարություն, համաչափություն եւ կամայականության բացակայություն։',
    examples: 'Թույլտվությունների տրամադրում, տուգանքի չափի ընտրություն, ժամկետների նշանակում'
  },
  {
    id: nextLawId++, article: 'Հոդված 7', law_number: 'ՀՕ-180',
    law_title: 'Կամայականության արգելք',
    description: 'Նույնատիպ փաստական հանգամանքներ ունեցող գործերով վարչական մարմինն ընդունում է նույնատիպ վարչական ակտ։ Վարչական մարմինը կարող է շեղվել ձեւավորված վարչական պրակտիկայից, եթե դա հիմնավորված է փաստական կամ իրավական տարբերություններով եւ նշված է վարչական ակտում։',
    examples: 'Նույն տեսակի խախտումների համար նույն տուգանք, նույն ժամկետ, նույն ընթացակարգ'
  },
  {
    id: nextLawId++, article: 'Հոդված 8', law_number: 'ՀՕ-180',
    law_title: 'Համաչափություն',
    description: 'Վարչական ակտը պետք է լինի նպատակային (ունենա օրինական նպատակ), անհրաժեշտ (minimum necessary) եւ չափավոր (proportionate to the goal)։ Վարչական մարմինը պետք է ընտրի նպատակին հասնելու ամենաքիչ սահմանափակող միջոցը։',
    examples: 'Փոքր խախտման համար մեծ տուգանք կամ մեծ խախտման համար փոքր տուգանք'
  },
];

const cases = [
  { id:nextCaseId++, case_type:'Ճանապարհային խախտում', description:'Անվտանգ ապահովիչ գոտի չկիրառել', additional_data:'Առաջին խախտում, ցերեկ', decision:'5,000 ՀՀ դրամ տուգանք', explanation:'Առաջին խախտման և ցածր ռիսկի հիմքով կիրառվում է նվազագույն տուգանք', legal_basis:'["Հոդված 7","Հոդված 8"]', consistency_score:95, status:'active', created_at:'2024-01-10' },
  { id:nextCaseId++, case_type:'Ճանապարհային խախտում', description:'Անվտանգ ապահովիչ գոտի չկիրառել', additional_data:'Կրկնվող խախտում', decision:'15,000 ՀՀ դրամ տուգանք', explanation:'Կրկնվող խախտումն ավելի խիստ պատժամիջոց է պահանջում', legal_basis:'["Հոդված 7","Հոդված 8"]', consistency_score:92, status:'active', created_at:'2024-01-15' },
  { id:nextCaseId++, case_type:'Ճանապարհային խախտում', description:'Կարմիր լույսով անցնել', additional_data:'Առաջին խախտում', decision:'10,000 ՀՀ դրամ տուգանք', explanation:'Ճանապարհային անվտանգության ռիսկ, համաչափ տուգանք', legal_basis:'["Հոդված 6","Հոդված 8"]', consistency_score:90, status:'active', created_at:'2024-01-20' },
  { id:nextCaseId++, case_type:'Ճանապարհային խախտում', description:'Կարմիր լույսով անցնել', additional_data:'Կրկնվող, վթար', decision:'30,000 ՀՀ դրամ + վարորդական իրավունքի կասեցում 30 օր', explanation:'Վթարի ռիսկ, կրկնվող խախտում — ավելի խիստ', legal_basis:'["Հոդված 6","Հոդված 7","Հոդված 8"]', consistency_score:88, status:'active', created_at:'2024-02-01' },
  { id:nextCaseId++, case_type:'Ճանապարհային խախտում', description:'Արագաչափի խախտում 20–40 կմ/ժ', additional_data:'Առաջին խախտում', decision:'20,000 ՀՀ դրամ տուգանք', explanation:'Չափավոր արագության խախտում, առաջին անգամ', legal_basis:'["Հոդված 8"]', consistency_score:91, status:'active', created_at:'2024-02-10' },
  { id:nextCaseId++, case_type:'Ճանապարհային խախտում', description:'Ձախ կողմով ոչ թույլատրելի տեղ կայանում', additional_data:'Ոչ աշխատանքային ժամ', decision:'8,000 ՀՀ դրամ տուգանք', explanation:'Ոչ բարձր ռիսկ, ոչ աշխատանքային ժամ — նվազ տուգանք', legal_basis:'["Հոդված 8"]', consistency_score:89, status:'active', created_at:'2024-02-15' },
  { id:nextCaseId++, case_type:'Բիզնես կանոնախախտում', description:'Լիցենզիայի ժամկետի անցկացում', additional_data:'1–2 ամիս ուշացում', decision:'50,000 ՀՀ դրամ + 30 օր ժամկետ ուղղման', explanation:'Կարճ ուշացում, ուղղման հնարավորություն', legal_basis:'["Հոդված 8"]', consistency_score:87, status:'active', created_at:'2024-02-20' },
  { id:nextCaseId++, case_type:'Բիզնես կանոնախախտում', description:'Լիցենզիայի ժամկետի անցկացում', additional_data:'6+ ամիս ուշացում', decision:'150,000 ՀՀ դրամ + 15 օր + ժամանակավոր կասեցում', explanation:'Երկար ուշացում, ավելի խիստ արձագանք', legal_basis:'["Հոդված 7","Հոդված 8"]', consistency_score:85, status:'active', created_at:'2024-03-01' },
  { id:nextCaseId++, case_type:'Բիզնես կանոնախախտում', description:'Հարկային հաշվետվության ուշ ներկայացում', additional_data:'1 ամիս ուշ, փոքր ձեռնարկություն', decision:'25,000 ՀՀ դրամ', explanation:'Փոքր ձեռնարկություն, կարճ ուշացում', legal_basis:'["Հոդված 6","Հոդված 8"]', consistency_score:93, status:'active', created_at:'2024-03-05' },
  { id:nextCaseId++, case_type:'Շինարարական խախտում', description:'Կառուցապատում առանց թույլտվության', additional_data:'Փոքր ժամանակավոր շինություն', decision:'Կասեցում + 100,000 ՀՀ դրամ + 30 օր ժամկետ', explanation:'Ժամանակավոր կասեցում մինչև թույլտվություն ստանալ', legal_basis:'["Հոդված 6","Հոդված 8"]', consistency_score:88, status:'active', created_at:'2024-03-10' },
  { id:nextCaseId++, case_type:'Շինարարական խախտում', description:'Կառուցապատում առանց թույլտվության', additional_data:'Մեծ կապիտալ շինություն', decision:'Կասեցում + 500,000 ՀՀ դրամ + քանդման պահանջ', explanation:'Մեծ ծավալ, կրկնվող անտեսում', legal_basis:'["Հոդված 7","Հոդված 8"]', consistency_score:84, status:'active', created_at:'2024-03-15' },
  { id:nextCaseId++, case_type:'Աղմուկի կանոնախախտում', description:'Գիշերային ժամերին ռեստորանի աղմուկ', additional_data:'23:00–01:00, բնակելի թաղամաս', decision:'30,000 ՀՀ դրամ + 7-օրյա նախազգուշացում', explanation:'Ռեստորան + բնակելի տարածք + ուշ ժամ', legal_basis:'["Հոդված 8"]', consistency_score:90, status:'active', created_at:'2024-04-01' },
  { id:nextCaseId++, case_type:'Աղմուկի կանոնախախտում', description:'Շինարարություն ոչ թույլատրելի ժամ', additional_data:'22:00–06:00', decision:'50,000 ՀՀ դրամ + կասեցում', explanation:'Շինարարությունն ավելի բարձր ռիսկ ունի', legal_basis:'["Հոդված 7","Հոդված 8"]', consistency_score:89, status:'active', created_at:'2024-04-05' },
  { id:nextCaseId++, case_type:'Բնապահպանական խախտում', description:'Կոյուղաջրի ոչ ճիշտ հեռացում', additional_data:'Փոքր ձեռնարկություն, առաջին անգամ', decision:'75,000 ՀՀ դրամ + 14 օր ուղղման ժամկետ', explanation:'Էկոլոգիական ռիսկ, բայց առաջին անգամ', legal_basis:'["Հոդված 6","Հոդված 8"]', consistency_score:86, status:'active', created_at:'2024-04-10' },
  { id:nextCaseId++, case_type:'Բնապահպանական խախտում', description:'Կոյուղաջրի ոչ ճիշտ հեռացում', additional_data:'Կրկնվող, հոսքի մեջ', decision:'300,000 ՀՀ դրամ + 7 օր + կազմակերպության կասեցում', explanation:'Կրկնվող + բնության ուղղակի վնաս', legal_basis:'["Հոդված 7","Հոդված 8"]', consistency_score:82, status:'active', created_at:'2024-04-15' },
];

// ─── Query helpers ─────────────────────────────────────────────────────────────
function getCases({ type, search } = {}) {
  return cases
    .filter(c => !type   || c.case_type === type)
    .filter(c => !search || [c.case_type, c.description, c.decision, c.additional_data]
      .some(f => f && f.toLowerCase().includes(search.toLowerCase())))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function getCaseById(id) {
  return cases.find(c => c.id === Number(id)) || null;
}

function createCase({ case_type, description, additional_data, decision, explanation, legal_basis, consistency_score }) {
  const now = new Date().toISOString().split('T')[0];
  const row = {
    id: nextCaseId++, case_type, description,
    additional_data: additional_data || null,
    decision: decision || null,
    explanation: explanation || null,
    legal_basis: JSON.stringify(Array.isArray(legal_basis) ? legal_basis : (legal_basis ? [legal_basis] : [])),
    consistency_score: consistency_score || 0,
    status: 'active',
    created_at: now,
  };
  cases.push(row);
  return row;
}

function getSimilarCases(case_type, description) {
  const byType = cases.filter(c => c.case_type === case_type);
  if (byType.length >= 3) return byType.slice(-6).reverse();
  const keyword = (description || '').split(/\s+/)[0].toLowerCase();
  const extra = cases
    .filter(c => c.case_type !== case_type && keyword &&
      (c.description || '').toLowerCase().includes(keyword))
    .slice(-3);
  return [...byType, ...extra].reverse();
}

function getStats() {
  const total = cases.length;
  const today = new Date().toISOString().split('T')[0];
  const todayCount = cases.filter(c => c.created_at && c.created_at.startsWith(today)).length;
  const typeMap = {};
  cases.forEach(c => { typeMap[c.case_type] = (typeMap[c.case_type] || 0) + 1; });
  const byType = Object.entries(typeMap)
    .map(([case_type, n]) => ({ case_type, n }))
    .sort((a, b) => b.n - a.n);
  const avgScore = cases.length
    ? Math.round(cases.reduce((s, c) => s + (c.consistency_score || 0), 0) / cases.length)
    : 0;
  return { total, today: todayCount, byType, avgScore };
}

function getLaws() { return laws; }

module.exports = { getCases, getCaseById, createCase, getSimilarCases, getStats, getLaws };
