import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function analyze() {
  const { data: students } = await supabase.from('students').select('*');
  
  const updatedEmails = new Set([
    'atiatnurtemidayo@gmail.com',
    'justinaayomide18@gmail.com',
    'olami.samod@gmail.com',
    'divine4u2008@gmail.com',
    'ojosarah115@gmail.com',
    'uchennaraziel@gmail.com',
    'onikibeokeoghene@gmail.com',
    'omoleyebishop@gmail.com',
    'fortuneonyeagwaziam@gmail.com',
  ]);

  console.log('--- Updated Students Details ---');
  students.filter(s => updatedEmails.has(s.email.toLowerCase())).forEach(s => {
    console.log(s);
  });
}

analyze();
