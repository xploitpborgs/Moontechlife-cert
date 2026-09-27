import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import crypto from 'node:crypto';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const courseName = 'Web development with AI';
const webDevCourseId = '8fe38530-3602-4d4e-a275-19415ec4d8e3'; // ID for 'Web Development'
const newCourseId = '30a3c89a-09c3-48ef-a08a-0a54a1aaa977'; // ID for 'Web development with AI'
const facilitatorNameString = 'igbayilola kazeem, Oluwasola Adebayo';

const restored9Emails = [
  'atiatnurtemidayo@gmail.com',
  'justinaayomide18@gmail.com',
  'olami.samod@gmail.com',
  'divine4u2008@gmail.com',
  'ojosarah115@gmail.com',
  'uchennaraziel@gmail.com',
  'onikibeokeoghene@gmail.com',
  'omoleyebishop@gmail.com',
  'fortuneonyeagwaziam@gmail.com',
];

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

async function runFix() {
  console.log('--- Step 1: Restoring 9 modified student records back to previous course ---');
  for (const email of restored9Emails) {
    const { error: restoreErr } = await supabase
      .from('students')
      .update({
        course: 'Web Development',
        course_id: webDevCourseId,
        course_name_snapshot: 'Web Development',
        facilitator_name_snapshot: null,
        facilitator_title_snapshot: null,
      })
      .eq('email', email)
      .eq('course_id', newCourseId);

    if (restoreErr) {
      console.error(`Error restoring ${email}:`, restoreErr.message);
    } else {
      console.log(`Restored previous record for ${email} -> "Web Development"`);
    }
  }

  console.log('\n--- Step 2: Creating NEW certificate records for ALL 31 students for "Web development with AI" ---');
  let insertedCount = 0;
  let errorCount = 0;

  for (const s of rawStudents) {
    const email = s.email.trim().toLowerCase();
    const name = s.name.trim();

    // Check if student already has a record specifically for "Web development with AI"
    const { data: existingForThisCourse } = await supabase
      .from('students')
      .select('*')
      .eq('email', email)
      .eq('course', courseName)
      .maybeSingle();

    if (existingForThisCourse) {
      console.log(`Student ${name} (${email}) already has a record for "${courseName}". Token: ${existingForThisCourse.cert_token}`);
      insertedCount++;
      continue;
    }

    const certToken = crypto.randomBytes(16).toString('hex');
    const { data: newRow, error: insertErr } = await supabase
      .from('students')
      .insert({
        full_name: name,
        email: email,
        course: courseName,
        course_id: newCourseId,
        cert_token: certToken,
        course_name_snapshot: courseName,
        facilitator_name_snapshot: facilitatorNameString,
        facilitator_title_snapshot: 'Instructors',
      })
      .select()
      .single();

    if (insertErr) {
      console.error(`Failed to insert ${name} (${email}):`, insertErr.message);
      errorCount++;
    } else {
      console.log(`Inserted NEW certificate: ${name} (${email}) -> Token: ${newRow.cert_token}`);
      insertedCount++;
    }
  }

  console.log('\n--- Summary ---');
  console.log(`Total students processed: ${rawStudents.length}`);
  console.log(`Successfully present for "${courseName}": ${insertedCount}`);
  console.log(`Errors: ${errorCount}`);
}

runFix();
