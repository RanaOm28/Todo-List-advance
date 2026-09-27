const STORAGE_KEY = "daymark-tasks-v1";
const priorityRank = { high: 0, medium: 1, low: 2 };

const taskForm = document.querySelector("#taskForm");
const taskTitle = document.querySelector("#taskTitle");
const taskCategory = document.querySelector("#taskCategory");
const taskPriority = document.querySelector("#taskPriority");
const taskDate = document.querySelector("#taskDate");
const taskList = document.querySelector("#taskList");
const emptyState = document.querySelector("#emptyState");
const searchInput = document.querySelector("#searchInput");
const sortSelect = document.querySelector("#sortSelect");
const cancelEdit = document.querySelector("#cancelEdit");
const clearCompleted = document.querySelector("#clearCompleted");

let tasks = readTasks();
let activeFilter = "all";
let activeCategory = "";
let editingId = null;

function readTasks() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
        return Array.isArray(saved) ? saved.filter((task) => task && typeof task.id === "string" && typeof task.title === "string") : [];
    } catch {
        return [];
    }
}

function saveTasks() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function localDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function formatDueDate(dateString) {
    if (!dateString) return "No due date";
    const date = new Date(`${dateString}T00:00:00`);
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function createId() {
    return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function makeTaskElement(task) {
    const item = document.createElement("li");
    item.className = `task-row${task.completed ? " is-complete" : ""}`;
    item.dataset.id = task.id;

    const completeButton = document.createElement("button");
    completeButton.className = "check-button";
    completeButton.type = "button";
    completeButton.dataset.action = "toggle";
    completeButton.setAttribute("aria-label", task.completed ? `Mark ${task.title} as active` : `Complete ${task.title}`);
    completeButton.setAttribute("aria-pressed", String(task.completed));
    completeButton.textContent = task.completed ? "✓" : "";

    const main = document.createElement("div");
    main.className = "task-main";
    const title = document.createElement("div");
    title.className = "task-title";
    title.textContent = task.title;
    const meta = document.createElement("div");
    meta.className = "task-meta";

    const category = document.createElement("span");
    category.className = `task-category category-${task.category.toLowerCase()}`;
    category.textContent = task.category;
    const priority = document.createElement("span");
    priority.className = `priority-indicator priority-${task.priority}`;
    priority.textContent = `${task.priority[0].toUpperCase()}${task.priority.slice(1)} priority`;
    const due = document.createElement("span");
    due.className = "task-due";
    due.textContent = formatDueDate(task.dueDate);
    if (!task.completed && task.dueDate && task.dueDate < localDateString()) due.classList.add("is-overdue");

    meta.append(category, priority, due);
    main.append(title, meta);

    const actions = document.createElement("div");
    actions.className = "task-actions";
    actions.append(
        createActionButton("edit", "Edit task", "&#9998;", "Edit"),
        createActionButton("delete", "Delete task", "&#215;", "Delete")
    );
    item.append(completeButton, main, actions);
    return item;
}

function createActionButton(action, label, symbol, extraClass) {
    const button = document.createElement("button");
    button.className = `task-action${extraClass === "Delete" ? " delete" : ""}`;
    button.type = "button";
    button.dataset.action = action;
    button.setAttribute("aria-label", label);
    button.title = label;
    button.innerHTML = symbol;
    return button;
}

function getVisibleTasks() {
    const today = localDateString();
    const query = searchInput.value.trim().toLocaleLowerCase();
    const filtered = tasks.filter((task) => {
        if (activeCategory && task.category !== activeCategory) return false;
        if (activeFilter === "today" && (task.dueDate !== today || task.completed)) return false;
        if (activeFilter === "upcoming" && (!task.dueDate || task.dueDate <= today || task.completed)) return false;
        if (activeFilter === "completed" && !task.completed) return false;
        if (["all", "today", "upcoming"].includes(activeFilter) && task.completed && activeFilter !== "all") return false;
        if (query && !task.title.toLocaleLowerCase().includes(query) && !task.category.toLocaleLowerCase().includes(query)) return false;
        return true;
    });

    return filtered.sort((first, second) => {
        if (sortSelect.value === "priority") return priorityRank[first.priority] - priorityRank[second.priority] || first.createdAt - second.createdAt;
        if (sortSelect.value === "newest") return second.createdAt - first.createdAt;
        if (!first.dueDate) return 1;
        if (!second.dueDate) return -1;
        return first.dueDate.localeCompare(second.dueDate) || second.createdAt - first.createdAt;
    });
}

function updateSummary() {
    const today = localDateString();
    const active = tasks.filter((task) => !task.completed);
    const todayTasks = tasks.filter((task) => task.dueDate === today && !task.completed);
    const todayDone = tasks.filter((task) => task.dueDate === today && task.completed).length;
    const totalToday = todayTasks.length + todayDone;
    const percent = totalToday ? Math.round((todayDone / totalToday) * 100) : 0;

    document.querySelector("#allCount").textContent = String(active.length);
    document.querySelector("#todayCount").textContent = String(todayTasks.length);
    document.querySelector("#progressLabel").textContent = totalToday ? `${todayDone} of ${totalToday} complete` : "A fresh start.";
    document.querySelector("#progressBar").style.width = `${percent}%`;
    document.querySelector(".progress-track").setAttribute("aria-valuenow", String(percent));
    document.querySelector("#headingCount").textContent = String(getVisibleTasks().length);
    document.querySelector("#footerSummary").textContent = tasks.length ? `${active.length} task${active.length === 1 ? "" : "s"} left to do.` : "Your tasks stay saved on this device.";
    clearCompleted.hidden = !tasks.some((task) => task.completed);
}

function updateHeading() {
    const heading = activeCategory || ({ all: "All tasks", today: "Today", upcoming: "Upcoming", completed: "Completed" }[activeFilter] || "All tasks");
    document.querySelector("#listTitle").firstChild.textContent = `${heading} `;
}

function render() {
    const visibleTasks = getVisibleTasks();
    taskList.replaceChildren(...visibleTasks.map(makeTaskElement));
    emptyState.classList.toggle("is-visible", visibleTasks.length === 0);
    const noTasks = tasks.length === 0;
    document.querySelector("#emptyTitle").textContent = noTasks ? "A little breathing room." : "Nothing on this list.";
    document.querySelector("#emptyMessage").textContent = noTasks ? "Add your first task above and make today yours." : "Try another view or add a task to this one.";
    updateHeading();
    updateSummary();
}

function resetEditor() {
    editingId = null;
    taskForm.reset();
    taskPriority.value = "medium";
    document.querySelector("#submitLabel").textContent = "Add task";
    cancelEdit.hidden = true;
}

taskForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const title = taskTitle.value.trim();
    if (!title) {
        taskTitle.focus();
        return;
    }

    if (editingId) {
        const task = tasks.find((item) => item.id === editingId);
        if (task) Object.assign(task, { title, category: taskCategory.value, priority: taskPriority.value, dueDate: taskDate.value });
    } else {
        tasks.push({
            id: createId(),
            title,
            category: taskCategory.value,
            priority: taskPriority.value,
            dueDate: taskDate.value,
            completed: false,
            createdAt: Date.now()
        });
    }

    saveTasks();
    resetEditor();
    render();
    taskTitle.focus();
});

taskList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const task = tasks.find((item) => item.id === button.closest(".task-row").dataset.id);
    if (!task) return;

    if (button.dataset.action === "toggle") task.completed = !task.completed;
    if (button.dataset.action === "delete") {
        tasks = tasks.filter((item) => item.id !== task.id);
        if (editingId === task.id) resetEditor();
    }
    if (button.dataset.action === "edit") {
        editingId = task.id;
        taskTitle.value = task.title;
        taskCategory.value = task.category;
        taskPriority.value = task.priority;
        taskDate.value = task.dueDate || "";
        document.querySelector("#submitLabel").textContent = "Save changes";
        cancelEdit.hidden = false;
        taskTitle.focus();
        taskForm.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
    }
    saveTasks();
    render();
});

document.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
        activeFilter = button.dataset.filter;
        activeCategory = "";
        document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("is-active", item === button));
        render();
    });
});

document.querySelectorAll("[data-category]").forEach((button) => {
    button.addEventListener("click", () => {
        activeCategory = activeCategory === button.dataset.category ? "" : button.dataset.category;
        activeFilter = "all";
        document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("is-active", item === button && Boolean(activeCategory)));
        if (!activeCategory) document.querySelector('[data-filter="all"]').classList.add("is-active");
        render();
    });
});

searchInput.addEventListener("input", render);
sortSelect.addEventListener("change", render);
cancelEdit.addEventListener("click", resetEditor);
clearCompleted.addEventListener("click", () => {
    tasks = tasks.filter((task) => !task.completed);
    saveTasks();
    render();
});

document.querySelector("#todayDate").textContent = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
render();