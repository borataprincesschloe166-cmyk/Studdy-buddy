const $ = selector => document.querySelector(selector);

let currentUser = null;
let taskRows = [];
let secondsLeft = 25 * 60;
let timerInterval = null;
let timerRunning = false;

function showMessage(element, text, isError = false) {
  element.textContent = text;
  element.classList.toggle("error", isError);
}

async function startAuthenticatedWorkspace() {
  showMessage($("#taskMessage"), "Checking your sign-in…");

  const { data, error } = await supabaseClient.auth.getSession();
  if (error) throw error;

  const user = data.session && data.session.user;
  if (!user || user.is_anonymous) {
    location.replace("login.html");
    return;
  }

  currentUser = user;
  document.body.classList.remove("auth-checking");
  const name = user.user_metadata?.name || user.email;
  const label = $("#accountLabel");
  if (label) label.textContent = name || "Signed in";
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
  showMessage($("#taskMessage"), taskRows.length ? "" : "Add your first task above.");
}

function renderTasks() {
  const list = $("#taskList");
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

  $("#taskCount").textContent = taskRows.length;
  $("#completedCount").textContent =
    taskRows.filter(task => task.completed).length;
}

$("#taskForm").addEventListener("submit", async event => {
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

$("#taskList").addEventListener("change", async event => {
  if (!event.target.matches('input[type="checkbox"]')) return;

  const row = event.target.closest(".task-row");
  const task = taskRows.find(item => item.id === row.dataset.id);
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

$("#taskList").addEventListener("click", async event => {
  const button = event.target.closest(".delete-task");
  if (!button) return;

  const row = button.closest(".task-row");
  const task = taskRows.find(item => item.id === row.dataset.id);
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

const notesKey = "studyBuddyQuickNotes";
$("#notesInput").value = localStorage.getItem(notesKey) || "";

$("#notesInput").addEventListener("input", event => {
  localStorage.setItem(notesKey, event.target.value);
  showMessage($("#notesMessage"), "Saved in this browser ✓");
});

function displayTimer() {
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  $("#timer").textContent =
    `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function updateSessionCount() {
  const key = "studyBuddySessionsToday";
  const today = new Date().toLocaleDateString();
  const saved = JSON.parse(localStorage.getItem(key) || "{}");

  if (saved.date !== today) {
    saved.date = today;
    saved.count = 0;
  }

  saved.count += 1;
  localStorage.setItem(key, JSON.stringify(saved));
  $("#sessionCount").textContent = saved.count;
}

const sessionData = JSON.parse(localStorage.getItem("studyBuddySessionsToday") || "{}");
if (sessionData.date === new Date().toLocaleDateString()) {
  $("#sessionCount").textContent = sessionData.count || 0;
}

$("#timerButton").addEventListener("click", () => {
  if (timerRunning) {
    clearInterval(timerInterval);
    timerRunning = false;
    $("#timerButton").textContent = "Resume";
    return;
  }

  if (secondsLeft <= 0) secondsLeft = 25 * 60;

  timerRunning = true;
  $("#timerButton").textContent = "Pause";

  timerInterval = setInterval(() => {
    secondsLeft -= 1;
    displayTimer();

    if (secondsLeft <= 0) {
      clearInterval(timerInterval);
      timerRunning = false;
      updateSessionCount();
      $("#timerButton").textContent = "Start focusing";
      secondsLeft = 25 * 60;
      displayTimer();
      alert("Focus session complete! Take a short break ☕");
    }
  }, 1000);
});

$("#resetTimerButton").addEventListener("click", () => {
  clearInterval(timerInterval);
  timerRunning = false;
  secondsLeft = 25 * 60;
  $("#timerButton").textContent = "Start focusing";
  displayTimer();
});

const tips = [
  "Try explaining a tricky idea in your own words.",
  "Put your phone away for one focused study session.",
  "Take a short break after finishing a task.",
  "Write down three things you learned today.",
  "Start with the smallest task to build momentum."
];

let tipIndex = 0;
$("#newTipButton").addEventListener("click", () => {
  tipIndex = (tipIndex + 1) % tips.length;
  $("#studyTip").textContent = tips[tipIndex];
});

displayTimer();

startAuthenticatedWorkspace().catch(error => {
  if (!currentUser) {
    location.replace("login.html");
    return;
  }
  document.body.classList.remove("auth-checking");
  showMessage(
    $("#taskMessage"),
    `Could not connect: ${error.message}. Check Supabase settings and the tasks table.`,
    true
  );
});