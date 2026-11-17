const $ = selector => document.querySelector(selector);
let currentUser = null;
let taskRows = [];
let secondsLeft = 25 * 60;
let timerInterval = null;
let timerRunning = false;

function showMessage(element, text, isError = false) {
  if (!element) return;
  element.textContent = text;
  element.classList.toggle("error", isError);
}

async function startAuthenticatedWorkspace() {
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) throw error;

  const user = data.session && data.session.user;
  if (!user || user.is_anonymous) {
    location.replace("login.html");
    return;
  }

  currentUser = user;
  document.body.classList.remove("auth-checking");

  const accountLabel = $("#accountLabel");
  if (accountLabel) {
    accountLabel.textContent =
      user.user_metadata?.name || user.email || "Signed in";
  }

  await loadTasks();
}

async function loadTasks() {
  const { data, error } = await supabaseClient
    .from("tasks")
    .select("id, title, completed, created_at")
    .order("created_at", { ascending: true });

  if (error) throw error;

  taskRows = data || [];
  renderTasks();

  showMessage(
    $("#taskMessage"),
    taskRows.length ? "" : "Add your first task above."
  );

  showMessage(
    $("#dashboardTaskMessage"),
    taskRows.length ? "" : "No tasks yet. Add your first one on the Tasks page."
  );
}

function renderTasks() {
  const count = $("#taskCount");
  const completedCount = $("#completedCount");

  if (count) count.textContent = taskRows.length;
  if (completedCount) {
    completedCount.textContent =
      taskRows.filter(task => task.completed).length;
  }

  const list = $("#taskList");

  if (list) {
    list.replaceChildren();

    taskRows.forEach(task => {
      const row = document.createElement("div");
      row.className = `task-row${task.completed ? " done" : ""}`;
      row.dataset.id = task.id;

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = task.completed;
      checkbox.setAttribute("aria-label", "Mark task complete");

      const title = document.createElement("span");
      title.className = "task-title";
      title.textContent = task.title;

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "delete-task";
      deleteButton.textContent = "×";
      deleteButton.setAttribute("aria-label", "Delete task");

      row.append(checkbox, title, deleteButton);
      list.appendChild(row);
    });
  }

  const preview = $("#dashboardTaskPreview");

  if (preview) {
    preview.replaceChildren();

    taskRows.slice(0, 4).forEach(task => {
      const row = document.createElement("div");
      row.className = `task-preview-row${task.completed ? " done" : ""}`;

      const mark = document.createElement("span");
      mark.className = "task-preview-mark";
      mark.textContent = task.completed ? "✓" : "○";

      const title = document.createElement("span");
      title.textContent = task.title;

      row.append(mark, title);
      preview.appendChild(row);
    });
  }
}

const taskForm = $("#taskForm");

if (taskForm) {
  taskForm.addEventListener("submit", async event => {
    event.preventDefault();

    const input = $("#taskInput");
    const title = input.value.trim();

    if (!title || !currentUser) return;

    showMessage($("#taskMessage"), "Saving task…");

    const { error } = await supabaseClient.from("tasks").insert({
      user_id: currentUser.id,
      title,
      completed: false
    });

    if (error) {
      showMessage($("#taskMessage"), error.message, true);
      return;
    }

    input.value = "";
    await loadTasks();
  });
}

const taskList = $("#taskList");

if (taskList) {
  taskList.addEventListener("change", async event => {
    if (!event.target.matches('input[type="checkbox"]')) return;

    const row = event.target.closest(".task-row");
    const task = taskRows.find(item => String(item.id) === row.dataset.id);

    if (!task) return;

    const completed = event.target.checked;

    const { error } = await supabaseClient
      .from("tasks")
      .update({ completed })
      .eq("id", task.id);

    if (error) {
      event.target.checked = !completed;
      showMessage($("#taskMessage"), error.message, true);
      return;
    }

    task.completed = completed;
    renderTasks();
  });

  taskList.addEventListener("click", async event => {
    const button = event.target.closest(".delete-task");
    if (!button) return;

    const row = button.closest(".task-row");
    const task = taskRows.find(item => String(item.id) === row.dataset.id);

    if (!task) return;

    const { error } = await supabaseClient
      .from("tasks")
      .delete()
      .eq("id", task.id);

    if (error) {
      showMessage($("#taskMessage"), error.message, true);
      return;
    }

    await loadTasks();
  });
}

const notesKey = "studyBuddyQuickNotes";
const notesInput = $("#notesInput");

if (notesInput) {
  notesInput.value = localStorage.getItem(notesKey) || "";

  notesInput.addEventListener("input", event => {
    localStorage.setItem(notesKey, event.target.value);
    showMessage($("#notesMessage"), "Saved in this browser ✓");
  });
}

const notesPreview = $("#dashboardNotesPreview");

if (notesPreview) {
  notesPreview.textContent =
    localStorage.getItem(notesKey) || "Your saved notes will appear here.";
}

function displayTimer() {
  const timer = $("#timer");
  if (!timer) return;

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  timer.textContent =
    `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getSessionData() {
  const key = "studyBuddySessionsToday";
  const today = new Date().toLocaleDateString();
  const saved = JSON.parse(localStorage.getItem(key) || "{}");

  if (saved.date !== today) {
    return { key, today, saved: { date: today, count: 0 } };
  }

  return { key, today, saved };
}

function renderSessionCount() {
  const count = $("#sessionCount");
  if (count) count.textContent = getSessionData().saved.count || 0;
}

function updateSessionCount() {
  const { key, today, saved } = getSessionData();

  saved.date = today;
  saved.count = (saved.count || 0) + 1;

  localStorage.setItem(key, JSON.stringify(saved));
  renderSessionCount();
}

renderSessionCount();
displayTimer();

const timerButton = $("#timerButton");

if (timerButton) {
  timerButton.addEventListener("click", () => {
    if (timerRunning) {
      clearInterval(timerInterval);
      timerRunning = false;
      timerButton.textContent = "Resume";
      return;
    }

    if (secondsLeft <= 0) secondsLeft = 25 * 60;

    timerRunning = true;
    timerButton.textContent = "Pause";

    timerInterval = setInterval(() => {
      secondsLeft -= 1;
      displayTimer();

      if (secondsLeft <= 0) {
        clearInterval(timerInterval);
        timerRunning = false;
        updateSessionCount();
        timerButton.textContent = "Start focusing";
        secondsLeft = 25 * 60;
        displayTimer();
        alert("Focus session complete! Take a short break ☕");
      }
    }, 1000);
  });
}

const resetTimerButton = $("#resetTimerButton");

if (resetTimerButton) {
  resetTimerButton.addEventListener("click", () => {
    clearInterval(timerInterval);
    timerRunning = false;
    secondsLeft = 25 * 60;

    if (timerButton) timerButton.textContent = "Start focusing";
    displayTimer();
  });
}

const tips = [
  "Try explaining a tricky idea in your own words.",
  "Put your phone away for one focused study session.",
  "Take a short break after finishing a task.",
  "Write down three things you learned today.",
  "Start with the smallest task to build momentum."
];

let tipIndex = 0;
const newTipButton = $("#newTipButton");

if (newTipButton) {
  newTipButton.addEventListener("click", () => {
    tipIndex = (tipIndex + 1) % tips.length;
    $("#studyTip").textContent = tips[tipIndex];
  });
}

startAuthenticatedWorkspace().catch(error => {
  if (!currentUser) {
    location.replace("login.html");
    return;
  }

  document.body.classList.remove("auth-checking");

  showMessage(
    $("#taskMessage") || $("#dashboardTaskMessage"),
    `Could not connect: ${error.message}. Check Supabase settings and the tasks table.`,
    true
  );
});