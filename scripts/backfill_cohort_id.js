/**
 * Back-fill cohort_id for all students that have cohort_type set
 * but no cohort_id yet (rows inserted before the cohorts table existed).
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY,
);

async function run() {
  // Fetch all cohorts
  const { data: cohorts, error: ce } = await supabase.from('cohorts').select('id, slug');
  if (ce) { console.error(ce); process.exit(1); }
  console.log('Cohorts in DB:', cohorts.map(c => `${c.slug} → ${c.id}`).join('\n'));

  for (const cohort of cohorts) {
    const { data, error } = await supabase
      .from('students')
      .update({ cohort_id: cohort.id })
      .eq('cohort_type', cohort.slug)
      .is('cohort_id', null)
      .select('id');

    if (error) {
      console.error(`Failed for ${cohort.slug}:`, error.message);
    } else {
      console.log(`✅ Back-filled ${data?.length || 0} students for cohort: ${cohort.slug}`);
    }
  }
  console.log('\nDone.');
}
run();
