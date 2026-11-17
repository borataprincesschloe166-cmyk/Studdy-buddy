// auth.js — Login / Create account para sa Study Buddy
// Gamit ang `supabaseClient` galing sa app.js, kaya i-load ito PAGKATAPOS ng app.js:
//   <script src="app.js" defer></script>
//   <script src="auth.js" defer></script>
(() => {
  const sb = supabaseClient; // galing sa app.js

  /* ---------- Styles ---------- */
  const styleEl = document.createElement("style");
  styleEl.textContent = `
.auth-overlay{position:fixed;inset:0;background:rgba(35,31,58,.45);display:grid;place-items:center;padding:24px;z-index:1000}
.auth-overlay[hidden]{display:none}
.auth-card{width:100%;max-width:400px;background:#fff;border:1px solid #e6e2f3;border-radius:20px;padding:28px;color:#231f3a;font-family:inherit}
.auth-card h2{margin:0 0 6px;font-size:24px}
.auth-card .auth-sub{margin:0 0 20px;color:#6f6a85;font-size:15px}
.auth-card label{display:block;font-size:14px;font-weight:600;margin-bottom:6px}
.auth-card .auth-field{margin-bottom:14px}
.auth-card input{width:100%;box-sizing:border-box;padding:12px 14px;font:inherit;font-size:16px;border:1px solid #e6e2f3;border-radius:12px}
.auth-card input:focus{outline:2px solid #6b4fd1;outline-offset:1px;border-color:transparent}
.auth-primary{width:100%;padding:13px;font:inherit;font-weight:600;font-size:16px;color:#fff;background:#6b4fd1;border:0;border-radius:12px;cursor:pointer}
.auth-primary:hover{background:#5a3fbd}
.auth-primary:disabled{opacity:.6;cursor:wait}
.auth-link{background:none;border:0;padding:0;font:inherit;color:#6b4fd1;font-weight:600;cursor:pointer}
.auth-link:hover{text-decoration:underline}
.auth-row{display:flex;justify-content:space-between;align-items:center;margin-top:16px;font-size:14px;color:#6f6a85;gap:8px;flex-wrap:wrap}
.auth-msg{min-height:20px;margin:0 0 12px;font-size:14px}
.auth-msg.error{color:#b3261e}
.auth-msg.success{color:#2e7d4f}
.auth-badge-btn{background:none;border:0;padding:0;margin-left:6px;font:inherit;font-weight:600;color:#6b4fd1;cursor:pointer}
.auth-badge-btn:hover{text-decoration:underline}
`;
  document.head.appendChild(styleEl);

  /* ---------- Modal ---------- */
  const overlay = document.createElement("div");
  overlay.className = "auth-overlay";
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="auth-card" role="dialog" aria-modal="true" aria-labelledby="auth-title">
      <h2 id="auth-title"></h2>
      <p class="auth-sub" id="auth-sub"></p>
      <form id="auth-form" novalidate>
        <div class="auth-field" id="auth-name-field" hidden>
          <label for="auth-name">Name</label>
          <input id="auth-name" type="text" autocomplete="name" placeholder="Ano'ng itatawag namin sa'yo?">
        </div>
        <div class="auth-field">
          <label for="auth-email">Email</label>
          <input id="auth-email" type="email" autocomplete="email" placeholder="you@example.com" required>
        </div>
        <div class="auth-field">
          <label for="auth-password">Password</label>
          <input id="auth-password" type="password" placeholder="At least 6 characters" required>
        </div>
        <p class="auth-msg" id="auth-msg" role="alert"></p>
        <button class="auth-primary" id="auth-submit" type="submit"></button>
      </form>
      <div class="auth-row">
        <span><span id="auth-switch-text"></span> <button class="auth-link" id="auth-switch" type="button"></button></span>
        <button class="auth-link" id="auth-forgot" type="button">Forgot password?</button>
      </div>
      <div class="auth-row">
        <button class="auth-link" id="auth-close" type="button">Continue as guest</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const el = id => document.getElementById(id);
  let mode = "login";

  function setMode(next) {
    mode = next;
    const signup = mode === "signup";
    el("auth-title").textContent = signup ? "Create your account" : "Welcome back";
    el("auth-sub").textContent = signup
      ? "Save your tasks to your account so they follow you anywhere."
      : "Log in to see your saved tasks.";
    el("auth-name-field").hidden = !signup;
    el("auth-submit").textContent = signup ? "Create account" : "Log in";
    el("auth-switch-text").textContent = signup ? "May account ka na?" : "Wala ka pang account?";
    el("auth-switch").textContent = signup ? "Log in" : "Create account";
    el("auth-forgot").hidden = signup;
    el("auth-password").autocomplete = signup ? "new-password" : "current-password";
    msg("");
  }

  function msg(text, type = "error") {
    const m = el("auth-msg");
    m.textContent = text;
    m.className = "auth-msg " + (text ? type : "");
  }

  function friendly(error) {
    const m = (error && error.message ? error.message : "").toLowerCase();
    if (m.includes("invalid login")) return "Mali ang email o password.";
    if (m.includes("already registered") || m.includes("already been registered"))
      return "May account na gamit ang email na ito. Subukang mag-log in.";
    if (m.includes("password") && m.includes("6")) return "Gawing at least 6 characters ang password.";
    if (m.includes("valid email") || m.includes("invalid email")) return "Mali ang format ng email.";
    if (m.includes("email not confirmed")) return "I-confirm muna ang email mo. Check ang inbox.";
    if (m.includes("rate limit") || m.includes("too many")) return "Masyadong maraming subok. Maghintay sandali.";
    if (m.includes("fetch") || m.includes("network")) return "Walang internet connection. Subukan ulit.";
    return "May nangyaring mali: " + (error && error.message ? error.message : "subukan ulit.");
  }

  function openModal(m = "login") {
    setMode(m);
    overlay.hidden = false;
    el("auth-email").focus();
  }
  function closeModal() { overlay.hidden = true; }

  el("auth-switch").addEventListener("click", () => setMode(mode === "login" ? "signup" : "login"));
  el("auth-close").addEventListener("click", closeModal);
  overlay.addEventListener("click", e => { if (e.target === overlay) closeModal(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !overlay.hidden) closeModal(); });

  el("auth-forgot").addEventListener("click", async () => {
    const email = el("auth-email").value.trim();
    if (!email) return msg("Ilagay muna ang email mo sa taas.");
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    error ? msg(friendly(error)) : msg("Naipadala na ang reset link. Check ang email mo.", "success");
  });

  el("auth-form").addEventListener("submit", async e => {
    e.preventDefault();
    const email = el("auth-email").value.trim();
    const password = el("auth-password").value;
    const name = el("auth-name").value.trim();
    const btn = el("auth-submit");
    const redirect = location.origin + location.pathname;
    btn.disabled = true;
    msg("");

    try {
      if (mode === "signup") {
        const { data: { session } } = await sb.auth.getSession();
        const isGuest = session && session.user && session.user.is_anonymous;

        if (isGuest) {
          // I-upgrade ang guest account: pareho pa rin ang user, kaya hindi mawawala ang tasks
          const { error } = await sb.auth.updateUser(
            { email, password, data: { name } },
            { emailRedirectTo: redirect }
          );
          if (error) throw error;
          msg("Halos tapos na! Check ang email mo at i-click ang confirm link.", "success");
          btn.disabled = false;
          return;
        }

        const { data, error } = await sb.auth.signUp({
          email, password, options: { data: { name }, emailRedirectTo: redirect }
        });
        if (error) throw error;
        if (!data.session) {
          msg("Halos tapos na! Check ang email mo at i-click ang confirm link.", "success");
          btn.disabled = false;
          return;
        }
      } else {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      location.reload(); // para ma-load ulit ng app.js ang tasks ng account
    } catch (err) {
      msg(friendly(err));
      btn.disabled = false;
    }
  });

  /* ---------- "Private guest workspace" badge ---------- */
  async function renderBadge() {
    const badge = document.querySelector(".guest-badge");
    if (!badge) return;

    const { data: { session } } = await sb.auth.getSession();
    const user = session && session.user;
    const loggedIn = user && !user.is_anonymous;

    const dot = badge.querySelector("span");
    badge.textContent = "";
    if (dot) badge.appendChild(dot);

    const label = document.createElement("span");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "auth-badge-btn";

    if (loggedIn) {
      const name = (user.user_metadata && user.user_metadata.name) || user.email;
      label.textContent = " " + name;
      btn.textContent = "Log out";
      btn.addEventListener("click", async () => { await sb.auth.signOut(); location.reload(); });
    } else {
      label.textContent = " Private guest workspace";
      btn.textContent = "Log in / Sign up";
      btn.addEventListener("click", () => openModal("login"));
    }
    badge.append(label, btn);
  }

  sb.auth.onAuthStateChange(() => renderBadge());
  renderBadge();
})();
