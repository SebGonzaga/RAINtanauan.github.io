/* =========================================================================
   DIVA — DivaAuth (Supabase-backed)
   Drop-in replacement for the old localStorage DivaAuth in main.js.
   Keeps the SAME cached user shape ({ name, email, role, city }) and the
   SAME synchronous getUser()/isAdmin() so renderAppShell() and every page
   that reads DivaAuth.getUser() need NO changes.

   The only behavior change: login/register/logout are now async (they
   talk to Supabase), and there's a new DivaAuth.init() that MUST be
   awaited once per page load, before anything reads DivaAuth.getUser().

   Load order in <head>/<body> of every page:
     <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
     <script src="assets/js/supabase-client.js"></script>
     <script src="assets/js/diva-auth.js"></script>
     <script src="assets/js/main.js"></script>
   ========================================================================= */
const DivaAuth = {
  CACHE_KEY: "diva_user",

  // Maps Supabase's profiles.role enum ('resident'|'admin') to the labels
  // the existing UI code already expects, so nothing else has to change.
  _roleLabel(role) { return role === "admin" ? "Administrator" : "Community Resident"; },

  getUser() {
    try { return JSON.parse(localStorage.getItem(this.CACHE_KEY) || "null"); }
    catch (e) { return null; }
  },
  _cacheUser(user) { localStorage.setItem(this.CACHE_KEY, JSON.stringify(user)); },
  _clearCache() { localStorage.removeItem(this.CACHE_KEY); },

  requireLogin() {
    const u = this.getUser();
    if (!u) { window.location.href = "login.html"; }
    return u;
  },
  isAdmin(u) { return !!(u && u.role === "Administrator"); },

  /** Call once per page load, BEFORE any code reads DivaAuth.getUser().
   *  Refreshes the local cache from the real Supabase session so a user
   *  who logged in on one tab/page is recognized on every other page. */
  async init() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { this._clearCache(); return null; }

    const { data: profile, error } = await sb
      .from("profiles")
      .select("full_name, role, barangay")
      .eq("id", session.user.id)
      .single();

    if (error || !profile) {
      console.error("Supabase profile fetch error:", error);
      this._clearCache();
      return null;
    }

    const user = {
      id: session.user.id,
      email: session.user.email,
      name: profile.full_name,
      role: this._roleLabel(profile.role),
      city: profile.barangay || "",
    };
    this._cacheUser(user);
    return user;
  },

  /** Returns the cached user object on success, null on bad credentials,
   *  or the string "suspended" — kept for compatibility, but account
   *  suspension isn't wired up in Supabase yet (see note in README). */
  async login(email, password) {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      console.error("Supabase sign-in error:", error);
      return null;
    }
    const user = await this.init();
    if (!user) console.error("Signed in, but profile fetch/init failed — check the 'read own profile' RLS policy and that a profiles row exists for this user.");
    return user;
  },

  /** Registers a new Community Resident account via Supabase Auth.
   *  A database trigger (see supabase/schema.sql) auto-creates the
   *  matching profiles row. Returns the created session's user, or
   *  { error: "message" } on failure (e.g. email already registered,
   *  weak password, or a server-side trigger/database error). */
  async register({ name, email, password, city }) {
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });
    if (error || !data.user) {
      // Log the FULL error object (status, code, message) — the generic
      // banner text was hiding real causes like a failing DB trigger,
      // email rate limiting, or "Database error saving new user".
      console.error("Supabase sign-up error:", error);
      return { error: (error && error.message) || "Registration failed. Please try again." };
    }

    // If email confirmation is enabled in Supabase Auth settings, there's
    // no active session yet — the user must confirm via email before
    // signing in. Callers should check for this case (see register.html).
    if (!data.session) return { pendingConfirmation: true };

    // Barangay isn't part of auth signup metadata by default; store it
    // on the profile now that the trigger has created the row.
    if (city) {
      await sb.from("profiles").update({ barangay: city }).eq("id", data.user.id);
    }
    return this.init();
  },

  async logout() {
    await sb.auth.signOut();
    this._clearCache();
    window.location.href = "index.html";
  },
};
