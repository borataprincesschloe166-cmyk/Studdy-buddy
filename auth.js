(() => {
  const sb = supabaseClient;
  const form = document.querySelector("#authForm");
  const message = document.querySelector("#authMessage");
  const params = new URLSearchParams(location.search);
  let mode = params.get("mode") === "signup" ? "signup" : "login";

  const showMessage = (text, isError = false) => {
    if (!message) return;
    message.textContent = text;
    message.className = `auth-message${isError ? " error" : ""}`;
  };

  const friendlyError = error => {
    const text = (error?.message || "").toLowerCase();
    if (text.includes("invalid login")) return "Incorrect email or password.";
    if (text.includes("already registered")) return "That email already has an account. Try logging in.";
    if (text.includes("password") && text.includes("6")) return "Use a password with at least 6 characters.";
    if (text.includes("email not confirmed")) return "Please confirm your email using the link in your inbox.";
    if (text.includes("valid email") || text.includes("invalid email")) return "Enter a valid email address.";
    return error?.message || "Something went wrong. Please try again.";
  };

  if (form) {
    const nameField = document.querySelector("#nameField");
    const nameInput = document.querySelector("#nameInput");
    const emailInput = document.querySelector("#emailInput");
    const passwordInput = document.querySelector("#passwordInput");
    const submitButton = document.querySelector("#authSubmit");
    const switchButton = document.querySelector("#authSwitch");
    const forgotButton = document.querySelector("#forgotPassword");
    const title = document.querySelector("#authTitle");
    const subtitle = document.querySelector("#authSubtitle");
    const switchCopy = document.querySelector("#authSwitchCopy");

    function setMode(nextMode) {
      mode = nextMode;
      const signup = mode === "signup";
      title.textContent = signup ? "Create your account" : "Welcome back";
      subtitle.textContent = signup
        ? "Sign up to save your study progress."
        : "Sign in to continue to your study dashboard.";
      nameField.hidden = !signup;
      nameInput.required = signup;
      submitButton.textContent = signup ? "Create account" : "Sign in";
      switchCopy.textContent = signup ? "Already have an account?" : "New to Study Buddy?";
      switchButton.textContent = signup ? "Sign in" : "Create account";
      forgotButton.hidden = signup;
      passwordInput.autocomplete = signup ? "new-password" : "current-password";
      showMessage("");
    }

    switchButton.addEventListener("click", () => setMode(mode === "login" ? "signup" : "login"));
    form.addEventListener("submit", async event => {
      event.preventDefault();
      submitButton.disabled = true;
      showMessage("");
      const email = emailInput.value.trim();
      const password = passwordInput.value;

      try {
        if (mode === "signup") {
          const { data, error } = await sb.auth.signUp({
            email,
            password,
            options: {
              data: { name: nameInput.value.trim() },
              emailRedirectTo: new URL("index.html", location.href).toString()
            }
          });
          if (error) throw error;
          if (data.session) {
            location.replace("index.html");
            return;
          }
          showMessage("Account created. Check your email to confirm it, then sign in here.");
        } else {
          const { error } = await sb.auth.signInWithPassword({ email, password });
          if (error) throw error;
          location.replace("index.html");
          return;
        }
      } catch (error) {
        showMessage(friendlyError(error), true);
      } finally {
        submitButton.disabled = false;
      }
    });

    forgotButton.addEventListener("click", async () => {
      const email = emailInput.value.trim();
      if (!email) return showMessage("Enter your email address first.", true);
      const { error } = await sb.auth.resetPasswordForEmail(email, {
        redirectTo: new URL("login.html", location.href).toString()
      });
      showMessage(error ? friendlyError(error) : "Password reset link sent. Check your email.", !!error);
    });

    sb.auth.getSession().then(({ data, error }) => {
      if (!error && data.session?.user && !data.session.user.is_anonymous) {
        location.replace("index.html");
      }
    });
    setMode(mode);
  }

  const logoutButton = document.querySelector("#logoutButton");
  if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
      logoutButton.disabled = true;
      const { error } = await sb.auth.signOut();
      if (error) {
        logoutButton.disabled = false;
        alert(error.message);
        return;
      }
      location.replace("login.html");
    });
  }
})();