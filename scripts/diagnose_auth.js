/**
 * Deep auth diagnostic: test admin API directly (bypasses auth service),
 * check for bad triggers or functions on auth schema.
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

// Use service role key for admin API
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
);

async function run() {
  // Test if service role key works at all
  console.log('\n--- Service role key test ---');
  const { data: users, error: ue } = await supabaseAdmin.auth.admin.listUsers({ perPage: 3 });
  if (ue) {
    console.error('admin listUsers error:', ue.message);
  } else {
    console.log('admin listUsers OK, first user emails:', users.users.map(u => u.email));
  }

  // Try getting user by email
  console.log('\n--- Checking borgsbeto@gmail.com exists ---');
  const allEmails = users?.users?.map(u => u.email) || [];
  const found = allEmails.includes('borgsbeto@gmail.com');
  console.log('Found in auth.users:', found);
  console.log('All auth user emails:', allEmails);

  // Check if any trigger on auth.users is failing
  console.log('\n--- Checking for problematic triggers/functions ---');
  const { data: triggers, error: te } = await supabaseAdmin.rpc('pg_catalog.pg_trigger', {}).catch(() => null) || {};
  if (te) console.log('trigger check skipped');

  // Try a direct admin user creation test (won't actually create — just shows error)
  console.log('\n--- Admin generateLink test ---');
  const { data: link, error: le } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: 'borgsbeto@gmail.com',
  });
  if (le) console.error('generateLink error:', le.message, '| code:', le.code);
  else console.log('generateLink OK — token_hash length:', link?.properties?.token_hash?.length);
}

run();
