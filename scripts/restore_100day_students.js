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

const restored9Emails = [
  { name: 'Abdulganiyy AtiyyatuNur Temidayo', email: 'atiatnurtemidayo@gmail.com', course: 'Web Development' },
  { name: 'Adefila Ayomide', email: 'justinaayomide18@gmail.com', course: 'Web Development' },
  { name: 'ADENIRAN SAMAD OLAMILEKAN', email: 'olami.samod@gmail.com', course: 'Web Development' },
  { name: 'Divine chukwuma onyike', email: 'divine4u2008@gmail.com', course: 'Web Development' },
  { name: 'Ojo Sarah Olamide', email: 'ojosarah115@gmail.com', course: 'Web Development' },
  { name: 'Okechi Uchenna Chukwuebuka', email: 'uchennaraziel@gmail.com', course: 'Web Development' },
  { name: 'Okeoghene onikibe', email: 'onikibeokeoghene@gmail.com', course: 'Web Development' },
  { name: 'Omoleye Bishop Opeyemi', email: 'omoleyebishop@gmail.com', course: 'Web Development' },
  { name: 'Onyeagwaziam Fortune', email: 'fortuneonyeagwaziam@gmail.com', course: 'Web Development' },
  { name: 'Oluwasola Adebayo', email: 'oluwasolabayo@gmail.com', course: 'Digital Marketing' }
];

async function run() {
  console.log('Restoring original 100-Day records for the 10 students who were overwritten...');
  
  // 1. Get the cohort ID for 100-Day
  const { data: cohortData } = await supabase.from('cohorts').select('id').eq('slug', '100day').single();
  const cohortId100Day = cohortData.id;
  
  // 2. Get course IDs
  const { data: webDevCourse } = await supabase.from('courses').select('id').eq('name', 'Web Development').single();
  const { data: digMarketCourse } = await supabase.from('courses').select('id').eq('name', 'Digital Marketing').single();

  for (const student of restored9Emails) {
    const courseId = student.course === 'Web Development' ? webDevCourse?.id : digMarketCourse?.id;
    
    const certToken = crypto.randomBytes(16).toString('hex');
    const { error } = await supabase
      .from('students')
      .insert({
        full_name: student.name,
        email: student.email,
        course: student.course,
        course_id: courseId,
        cohort_type: '100day',
        cohort_id: cohortId100Day,
        cert_token: certToken,
        course_name_snapshot: student.course,
      });

    if (error) {
      if (error.code === '23505') {
        console.log(`✅ ${student.email} already has a 100-day record.`);
      } else {
        console.error(`❌ Error inserting ${student.email}:`, error.message);
      }
    } else {
      console.log(`➕ Restored ${student.course} (100-Day) record for ${student.email}`);
    }
  }
}

run();
