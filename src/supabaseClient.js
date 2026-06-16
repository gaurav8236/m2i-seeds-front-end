import { createClient } from '@supabase/supabase-js';

// Replace with your actual Supabase URL and Anon Key
const supabaseUrl = 'https://sajzzwdoforindpqiseh.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhanp6d2RvZm9yaW5kcHFpc2VoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMDMxMTksImV4cCI6MjA5NDU3OTExOX0.m4rjhis25BLhCyxtGbp-_EdT__gsI7zBo6H_DJxaYi4';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
