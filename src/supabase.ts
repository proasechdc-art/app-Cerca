import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rlaxqsuxemawtiizvicq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsYXhxc3V4ZW1hd3RpaXp2aWNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3NzI1MjIsImV4cCI6MjEwNjM0ODUyMn0.Ksk2OUtHzACWDOpl6FD26zmR-hnJfiPZCotQCGMpb0Y';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
});
