/* =========================================================================
   RAIN — Supabase client
   Publishable key is safe to expose in frontend code — it identifies your
   project but grants no access beyond what your Row Level Security
   policies (see supabase/schema.sql) allow.
   Requires the Supabase JS CDN script to be loaded BEFORE this file:
   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
   ========================================================================= */
const SUPABASE_URL = "https://aadnjjohcysykhrggigj.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_YmAqdnXTPA7QWEp7WxbdLQ_6ZM6mr8q";

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
