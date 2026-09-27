/**
 * 4-Week Cohort — "Web development with AI"
 *
 * This script:
 *  1. Updates existing student records for "Web development with AI" to
 *     set cohort_type = '4week' (they were inserted with the default '100day').
 *  2. Inserts NEW records for students who don't have one yet (e.g. facilitators
 *     who also completed the course: Igbayilola & Oluwasola).
 *
 * SAFE TO RE-RUN — skips rows that are already marked as '4week'.
 *
 * Run:  node scripts/add_4week_students.js
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import crypto from 'node:crypto';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials. Check your .env file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ---------------------------------------------------------------------------
// Course config — from the existing add_new_certificates_clean.js
// ---------------------------------------------------------------------------
const COURSE_NAME      = 'Web development with AI';
const COURSE_ID        = '30a3c89a-09c3-48ef-a08a-0a54a1aaa977';
const FACILITATOR_NAME = 'igbayilola kazeem, Oluwasola Adebayo';
const FACILITATOR_TITLE = 'Instructors';
const COHORT_TYPE       = '4week';

// ---------------------------------------------------------------------------
// 4-Week cohort student list
// ---------------------------------------------------------------------------
const rawStudents = [
  { name: 'Igbayilola Kazeem',              email: 'igbayilolakazeem01@gmail.com' },
  { name: 'Oluwasola Adebayo',              email: 'oluwasolabayo@gmail.com' },
  { name: 'Abass Adam',                     email: 'adamtemitope01@gmail.com' },
  { name: 'Abdulganiyy AtiyyatuNur Temidayo', email: 'atiatnurtemidayo@gmail.com' },
  { name: 'Abdullah Taofeeq',               email: 'taofeeqabdullah03@gmail.com' },
  { name: 'Adebayo',                        email: 'zarkswift@gmail.com' },
  { name: 'Adebayo Yusuf',                  email: 'folaranmiyusuf27@gmail.com' },
  { name: 'Adefila Ayomide',                email: 'justinaayomide18@gmail.com' },
  { name: 'ADENIRAN SAMAD OLAMILEKAN',      email: 'olami.samod@gmail.com' },
  { name: 'Adeoti Kolade',                  email: 'adeotikolade06@gmail.com' },
  { name: 'Adisent Shaka',                  email: 'kuwasglobal@gmail.com' },
  { name: 'Adjerese Ejiro',                 email: 'adjereseejiro8@gmail.com' },
  { name: 'Daodu Oyinloluwa Rachael',       email: 'oyinloluwadaodu23@gmail.com' },
  { name: 'Divine Chukwuma Onyike',         email: 'divine4u2008@gmail.com' },
  { name: 'Esther Osarumwense Orukpe',      email: 'orukpeesther39@gmail.com' },
  { name: 'Eunice Orji',                    email: 'beginintech@gmail.com' },
  { name: 'Ibukun Folorunsho',              email: 'anikefolorunsho@gmail.com' },
  { name: 'Idema David Oye',                email: 'idemadavid814@gmail.com' },
  { name: 'Meetpearls',                     email: 'nepearlsclothing1@gmail.com' },
  { name: 'Ndive Oluebube Success',         email: 'oluebubeaudrey68@gmail.com' },
  { name: 'Odunayo Obanla',                 email: 'dorcasobanla2000@gmail.com' },
  { name: 'Odutola Boluwatito',             email: 'boluwatitoodutola@gmail.com' },
  { name: 'Ogbebor Winter Isaac',           email: 'ogbeborwinter380@gmail.com' },
  { name: 'Ojo Sarah Olamide',              email: 'ojosarah115@gmail.com' },
  { name: 'Okechi Uchenna Chukwuebuka',    email: 'uchennaraziel@gmail.com' },
  { name: 'Okeoghene Onikibe',              email: 'onikibeokeoghene@gmail.com' },
  { name: 'Omoleye Bishop Opeyemi',         email: 'omoleyebishop@gmail.com' },
  { name: 'Onyeagwaziam Fortune',           email: 'fortuneonyeagwaziam@gmail.com' },
  { name: 'Owoade Opeyemi',                 email: 'owoadeopeyemi11@gmail.com' },
  { name: 'Treasure',                       email: 'mayortreasure002@gmail.com' },
  { name: 'Uyanna Chioma Jessica',          email: 'jessicachioma663@gmail.com' },
  { name: 'Zana Teeraboh',                  email: 'teeraboh@gmail.com' },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function run() {
  console.log(`\n🚀 Processing ${rawStudents.length} students for the 4-Week Cohort ("${COURSE_NAME}")...\n`);

  let updated  = 0;
  let inserted = 0;
  let alreadyDone = 0;
  let errors   = 0;

  for (const s of rawStudents) {
    const email = s.email.trim().toLowerCase();
    const name  = s.name.trim();

    // Look up by email only — the student may have a row under a different course name
    const { data: rows, error: fetchErr } = await supabase
      .from('students')
      .select('id, cert_token, cohort_type, course')
      .eq('email', email);

    if (fetchErr) {
      console.error(`❌ FETCH ERROR  ${name} (${email}): ${fetchErr.message}`);
      errors++;
      continue;
    }

    // Find a row that is already the 4-week course record
    const already4Week = rows?.find(
      (r) => r.cohort_type === '4week' && r.course === COURSE_NAME,
    );

    if (already4Week) {
      console.log(`✅ ALREADY SET  ${name} (${email}) — already 4week. Token: ${already4Week.cert_token}`);
      alreadyDone++;
      continue;
    }

    // Find the row for this specific course (to update)
    const matchingCourseRow = rows?.find((r) => r.course === COURSE_NAME);

    if (matchingCourseRow) {
      // Update the existing "Web development with AI" row to 4week
      const { error: updateErr } = await supabase
        .from('students')
        .update({ cohort_type: COHORT_TYPE })
        .eq('id', matchingCourseRow.id);

      if (updateErr) {
        console.error(`❌ UPDATE ERROR ${name} (${email}): ${updateErr.message}`);
        errors++;
      } else {
        console.log(`🔄 UPDATED      ${name} (${email}) → cohort_type set to 4week. Token: ${matchingCourseRow.cert_token}`);
        updated++;
      }
      continue;
    }

    // Student has a row for a DIFFERENT course — update that row to point to the 4-week course
    const anyRow = rows?.[0];
    if (anyRow) {
      const { error: updateErr } = await supabase
        .from('students')
        .update({
          cohort_type:              COHORT_TYPE,
          course:                   COURSE_NAME,
          course_id:                COURSE_ID,
          course_name_snapshot:     COURSE_NAME,
          facilitator_name_snapshot: FACILITATOR_NAME,
          facilitator_title_snapshot: FACILITATOR_TITLE,
        })
        .eq('id', anyRow.id);

      if (updateErr) {
        console.error(`❌ UPDATE(remap) ERROR ${name} (${email}): ${updateErr.message}`);
        errors++;
      } else {
        console.log(`🔄 REMAPPED     ${name} (${email}) — was "${anyRow.course}" → now 4week "${COURSE_NAME}". Token: ${anyRow.cert_token}`);
        updated++;
      }
      continue;
    }

    // No row at all — insert a fresh one
    const certToken = crypto.randomBytes(16).toString('hex');
    const { data: newRow, error: insertErr } = await supabase
      .from('students')
      .insert({
        full_name:                name,
        email,
        course:                   COURSE_NAME,
        course_id:                COURSE_ID,
        cohort_type:              COHORT_TYPE,
        cert_token:               certToken,
        course_name_snapshot:     COURSE_NAME,
        facilitator_name_snapshot: FACILITATOR_NAME,
        facilitator_title_snapshot: FACILITATOR_TITLE,
      })
      .select()
      .single();

    if (insertErr) {
      console.error(`❌ INSERT ERROR ${name} (${email}): ${insertErr.message}`);
      errors++;
    } else {
      console.log(`➕ INSERTED     ${name} (${email}) → Token: ${newRow.cert_token}`);
      inserted++;
    }
  }

  console.log('\n--- Summary ---');
  console.log(`Total students:     ${rawStudents.length}`);
  console.log(`🔄 Updated:         ${updated}`);
  console.log(`➕ Inserted (new):  ${inserted}`);
  console.log(`✅ Already done:    ${alreadyDone}`);
  console.log(`❌ Errors:          ${errors}`);

  if (errors === 0) {
    console.log('\n🎉 All students are now correctly tagged as 4-week cohort!');
  }
}

run();
