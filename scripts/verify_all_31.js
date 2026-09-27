import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

const rawStudents = [
  { name: 'Abass Adam', email: 'adamtemitope01@gmail.com' },
  { name: 'Abdulganiyy AtiyyatuNur Temidayo', email: 'atiatnurtemidayo@gmail.com' },
  { name: 'Abdullah Taofeeq', email: 'taofeeqabdullah03@gmail.com' },
  { name: 'adebayo', email: 'zarkswift@gmail.com' },
  { name: 'Adebayo Yusuf', email: 'folaranmiyusuf27@gmail.com' },
  { name: 'Adefila Ayomide', email: 'justinaayomide18@gmail.com' },
  { name: 'ADENIRAN SAMAD OLAMILEKAN', email: 'olami.samod@gmail.com' },
  { name: 'Adeoti kolade', email: 'adeotikolade06@gmail.com' },
  { name: 'Adisent shaka', email: 'kuwasglobal@gmail.com' },
  { name: 'Adjerese Ejiro', email: 'adjereseejiro8@gmail.com' },
  { name: 'Daodu Oyinloluwa Rachael', email: 'oyinloluwadaodu23@gmail.com' },
  { name: 'Divine chukwuma onyike', email: 'divine4u2008@gmail.com' },
  { name: 'Esther Osarumwense Orukpe', email: 'orukpeesther39@gmail.com' },
  { name: 'Eunice Orji', email: 'beginintech@gmail.com' },
  { name: 'Ibukun Folorunsho', email: 'ibukunthedesigner@gmail.com' },
  { name: 'Ibukun Folorunsho', email: 'anikefolorunsho@gmail.com' },
  { name: 'Idema David Oye', email: 'idemadavid814@gmail.com' },
  { name: 'Meetpearls', email: 'nepearlsclothing1@gmail.com' },
  { name: 'Ndive Oluebube success', email: 'oluebubeaudrey68@gmail.com' },
  { name: 'Odunayo Obanla', email: 'dorcasobanla2000@gmail.com' },
  { name: 'Odutola Boluwatito', email: 'boluwatitoodutola@gmail.com' },
  { name: 'Ogbebor winter isaac', email: 'ogbeborwinter380@gmail.com' },
  { name: 'Ojo Sarah Olamide', email: 'ojosarah115@gmail.com' },
  { name: 'Okechi Uchenna Chukwuebuka', email: 'uchennaraziel@gmail.com' },
  { name: 'Okeoghene onikibe', email: 'onikibeokeoghene@gmail.com' },
  { name: 'Omoleye Bishop Opeyemi', email: 'omoleyebishop@gmail.com' },
  { name: 'Onyeagwaziam Fortune', email: 'fortuneonyeagwaziam@gmail.com' },
  { name: 'Owoade Opeyemi', email: 'owoadeopeyemi11@gmail.com' },
  { name: 'Treasure', email: 'mayortreasure002@gmail.com' },
  { name: 'Uyanna Chioma Jessica', email: 'jessicachioma663@gmail.com' },
  { name: 'Zana Teeraboh', email: 'teeraboh@gmail.com' },
];

async function verifyAll() {
  const { data: allStudents } = await supabase.from('students').select('*');
  console.log(`Total DB rows in students table: ${allStudents.length}`);

  const report = [];
  for (const s of rawStudents) {
    const email = s.email.trim().toLowerCase();
    const rows = allStudents.filter(row => row.email.toLowerCase() === email);
    report.push({
      name: s.name,
      email: email,
      rowCount: rows.length,
      courses: rows.map(r => r.course || r.course_name_snapshot),
      tokens: rows.map(r => r.cert_token)
    });
  }

  console.table(report);
}

verifyAll();
