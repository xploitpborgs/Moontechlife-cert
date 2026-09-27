import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('email', 'oluwasolabayo@gmail.com');
  
  if (error) {
    console.error('Error fetching students:', error);
  } else {
    console.log(`Found ${data.length} records for oluwasolabayo@gmail.com`);
    console.log(data);
  }
}

run();
