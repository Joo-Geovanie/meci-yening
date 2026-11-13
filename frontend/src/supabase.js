import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
// Satu client untuk seluruh aplikasi; sesi bertahan saat halaman dimuat ulang.
export const supabase = url && key ? createClient(url, key) : null;
