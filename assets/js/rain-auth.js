/* =========================================================================
   RAIN — RainAuth (Supabase-backed)
   Drop-in replacement for the old localStorage RainAuth in main.js.
   Keeps the SAME cached user shape ({ name, email, role, city }) and the
   SAME synchronous getUser()/isAdmin() so renderAppShell() and every page
   that reads RainAuth.getUser() need NO changes.

   The only behavior change: login/register/logout are now async (they
   talk to Supabase), and there's a new RainAuth.init() that MUST be
   awaited once per page load, before anything reads RainAuth.getUser().

   Load order in <head>/<body> of every page:
     <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
     <script src="assets/js/supabase-client.js"></script>
     <script src="assets/js/rain-auth.js"></script>
     <script src="assets/js/main.js"></script>
   ========================================================================= */
const RainAuth = {
  CACHE_KEY: "rain_user",

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

  /** Call once per page load, BEFORE any code reads RainAuth.getUser().
   *  Refreshes the local cache from the real Supabase session so a user
   *  who logged in on one tab/page is recognized on every other page.
   *
   *  IMPORTANT: a network/connectivity failure here (slow cold start,
   *  blocked domain in a wrapped WebView app, momentary offline, etc.)
   *  must NOT be treated the same as "not logged in" — that used to
   *  wipe the cached user and blank the whole page. Only a definitive
   *  "no session" / auth rejection clears the cache; anything that
   *  looks like a transient network failure falls back to the last
   *  known-good cached user so the page still renders. */
  async init() {
    const cachedUser = this.getUser();

    let session;
    try {
      const { data, error } = await sb.auth.getSession();
      if (error) throw error;
      session = data.session;
    } catch (err) {
      console.error("RainAuth.init: getSession failed (treating as network issue, keeping cache):", err);
      return cachedUser; // don't nuke the page over a network blip
    }

    if (!session) { this._clearCache(); return null; } // genuine logout / no session

    let profile, error;
    try {
      ({ data: profile, error } = await sb
        .from("profiles")
        .select("full_name, role, barangay")
        .eq("id", session.user.id)
        .single());
    } catch (err) {
      console.error("RainAuth.init: profile fetch threw (treating as network issue, keeping cache):", err);
      return cachedUser;
    }

    if (error || !profile) {
      // Distinguish a real backend rejection (has a Postgrest error code,
      // e.g. RLS denial) from a generic network failure (no code, usually
      // "Failed to fetch" / TypeError). Only clear cache on the former.
      const looksLikeNetworkFailure = error && !error.code;
      console.error("Supabase profile fetch error:", error);
      if (looksLikeNetworkFailure && cachedUser) return cachedUser;
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
  async register({ name, email, phone, password, city }) {
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

    // Barangay and phone aren't part of auth signup metadata by default;
    // store them on the profile now that the trigger has created the row.
    // data.user.id exists as soon as signUp succeeds -- even if email
    // confirmation is still pending -- so this runs regardless of session
    // state (previously this ran after the pendingConfirmation check below,
    // which meant the city/phone were silently dropped whenever email
    // confirmation was required).
    const profileUpdates = {};
    if (city) profileUpdates.barangay = city;
    if (phone) profileUpdates.phone = phone;
    if (Object.keys(profileUpdates).length) {
      const { error: profileError } = await sb.from("profiles").update(profileUpdates).eq("id", data.user.id);
      if (profileError) console.error("Save profile fields error:", profileError);
    }

    // If email confirmation is enabled in Supabase Auth settings, there's
    // no active session yet — the user must confirm via email before
    // signing in. Callers should check for this case (see register.html).
    if (!data.session) return { pendingConfirmation: true };

    return this.init();
  },

  async logout() {
    await sb.auth.signOut();
    this._clearCache();
    window.location.href = "index.html";
  },
};
