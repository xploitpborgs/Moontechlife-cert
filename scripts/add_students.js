import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import crypto from 'node:crypto';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase URL or Key in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const courseName = 'Web development with AI';
const facilitators = ['igbayilola kazeem', 'Oluwasola Adebayo'];
const facilitatorNameString = facilitators.join(', ');

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

async function addStudentsAndCourse() {
  console.log(`Checking course: "${courseName}"...`);

  // 1. Ensure course exists in public.courses
  let courseId = null;
  const { data: existingCourses, error: cFetchErr } = await supabase
    .from('courses')
    .select('*')
    .ilike('course_name', courseName);

  if (cFetchErr) {
    console.error('Error fetching courses:', cFetchErr);
  }

  if (existingCourses && existingCourses.length > 0) {
    courseId = existingCourses[0].id;
    console.log(`Found existing course record with ID: ${courseId}`);
  } else {
    console.log(`Creating new course: "${courseName}"...`);
    const { data: newCourse, error: cInsertErr } = await supabase
      .from('courses')
      .insert({
        course_name: courseName,
        facilitator_name: facilitatorNameString,
        facilitator_title: 'Instructors',
      })
      .select()
      .single();

    if (cInsertErr) {
      console.error('Failed to create course:', cInsertErr);
    } else {
      courseId = newCourse.id;
      console.log(`Created course with ID: ${courseId}`);
    }
  }

  // 2. Add course facilitators to public.course_facilitators if courseId exists
  if (courseId) {
    console.log('Ensuring course facilitators in course_facilitators table...');
    for (let i = 0; i < facilitators.length; i++) {
      const name = facilitators[i];
      const { data: existingFac } = await supabase
        .from('course_facilitators')
        .select('*')
        .eq('course_id', courseId)
        .ilike('facilitator_name', name);

      if (!existingFac || existingFac.length === 0) {
        const { error: facErr } = await supabase.from('course_facilitators').insert({
          course_id: courseId,
          facilitator_name: name,
          facilitator_title: 'Instructor',
          sort_order: i + 1,
        });
        if (facErr) {
          console.warn(`Note on course_facilitators insert for ${name}:`, facErr.message);
        } else {
          console.log(`Added facilitator "${name}" to course.`);
        }
      }
    }
  }

  // 3. Insert or update students
  console.log(`Processing ${rawStudents.length} students...`);
  let addedCount = 0;
  let updatedCount = 0;
  let errorCount = 0;

  for (const s of rawStudents) {
    const email = s.email.trim().toLowerCase();
    const name = s.name.trim();

    // Check if student already exists by email
    const { data: existing, error: findErr } = await supabase
      .from('students')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (findErr) {
      console.error(`Error checking student ${email}:`, findErr.message);
      errorCount++;
      continue;
    }

    if (existing) {
      // Update student course & snapshots
      const { error: updateErr } = await supabase
        .from('students')
        .update({
          full_name: name,
          course: courseName,
          course_id: courseId || existing.course_id,
          course_name_snapshot: courseName,
          facilitator_name_snapshot: facilitatorNameString,
          facilitator_title_snapshot: 'Instructors',
        })
        .eq('id', existing.id);

      if (updateErr) {
        console.error(`Error updating ${email}:`, updateErr.message);
        errorCount++;
      } else {
        console.log(`Updated student: ${name} (${email}) - cert_token: ${existing.cert_token}`);
        updatedCount++;
      }
    } else {
      // Create new student
      const certToken = crypto.randomBytes(16).toString('hex');
      const { data: inserted, error: insertErr } = await supabase
        .from('students')
        .insert({
          full_name: name,
          email: email,
          course: courseName,
          course_id: courseId,
          cert_token: certToken,
          course_name_snapshot: courseName,
          facilitator_name_snapshot: facilitatorNameString,
          facilitator_title_snapshot: 'Instructors',
        })
        .select()
        .single();

      if (insertErr) {
        console.error(`Error inserting ${name} (${email}):`, insertErr.message);
        errorCount++;
      } else {
        console.log(`Added student: ${name} (${email}) - cert_token: ${inserted.cert_token}`);
        addedCount++;
      }
    }
  }

  console.log('\n--- Summary ---');
  console.log(`Total processed: ${rawStudents.length}`);
  console.log(`Added new: ${addedCount}`);
  console.log(`Updated existing: ${updatedCount}`);
  console.log(`Errors: ${errorCount}`);
}

addStudentsAndCourse();
