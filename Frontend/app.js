const API_URL = "http://127.0.0.1:8000/api/tasks/";

const taskTableBody = document.getElementById("taskTableBody");
const taskModal = document.getElementById("taskModal");
const taskForm = document.getElementById("taskForm");

const titleInput = document.getElementById("titleInput");
const descriptionInput = document.getElementById("descriptionInput");
const deadlineInput = document.getElementById("deadlineInput");
const priorityInput = document.getElementById("priorityInput");
const statusInput = document.getElementById("statusInput");
const titleError = document.getElementById("titleError");

const searchInput = document.getElementById("searchInput");
const priorityFilter = document.getElementById("priorityFilter");

const totalCount = document.getElementById("totalCount");
const pendingCount = document.getElementById("pendingCount");
const completedCount = document.getElementById("completedCount");
const overdueCount = document.getElementById("overdueCount");
const taskCountLabel = document.getElementById("taskCountLabel");
const emptyState = document.getElementById("emptyState");

const newTaskBtn = document.getElementById("newTaskBtn");
const closeModalBtn = document.getElementById("closeModal");
const cancelBtn = document.getElementById("cancelBtn");
const modalTitle = document.getElementById("modalTitle");
const saveBtn = document.getElementById("saveBtn");

let tasks = [];
let editingTaskId = null;
let activeFilter = "all";

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function isOverdue(task) {
    if (!task.deadline || task.status === "Completed") {
        return false;
    }

    // ISO date comparison avoids timezone conversion problems.
    const today = new Date();
    const todayString =
        `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    return task.deadline < todayString;
}

function formatDate(dateString) {
    if (!dateString) return "—";

    const [year, month, day] = dateString.split("-");
    return `${day}-${month}-${year}`;
}

async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            ...(options.body ? { "Content-Type": "application/json" } : {}),
            ...options.headers
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
            `Request failed (${response.status}): ${errorText.slice(0, 250)}`
        );
    }

    if (response.status === 204) return null;

    return response.json();
}

async function loadTasks() {
    try {
        const data = await apiRequest(API_URL);

        // Supports normal Django REST Framework pagination too.
        tasks = Array.isArray(data) ? data : (data.results || []);

        renderTasks();
        updateStats();
    } catch (error) {
        console.error("Could not load tasks:", error);

        alert(
            "Backend connection failed. Check that Django is running at http://127.0.0.1:8000/"
        );
    }
}

function updateStats() {
    totalCount.textContent = tasks.length;
    pendingCount.textContent =
        tasks.filter(task => task.status === "Pending").length;
    completedCount.textContent =
        tasks.filter(task => task.status === "Completed").length;
    overdueCount.textContent =
        tasks.filter(isOverdue).length;
}

function getVisibleTasks() {
    const searchText = searchInput.value.trim().toLowerCase();
    const selectedPriority = priorityFilter.value;

    return tasks.filter(task => {
        const matchesStatus =
            activeFilter === "all" || task.status.toLowerCase() === activeFilter;

        const matchesPriority =
            selectedPriority === "all" || task.priority === selectedPriority;

        const matchesSearch =
            `${task.title} ${task.description}`
                .toLowerCase()
                .includes(searchText);

        return matchesStatus && matchesPriority && matchesSearch;
    });
}

function renderTasks() {
    const visibleTasks = getVisibleTasks();

    taskTableBody.innerHTML = visibleTasks.map(task => {
        const overdue = isOverdue(task);

        return `
            <tr>
                <td>
                    <strong>${escapeHTML(task.title)}</strong>
                    <div>${escapeHTML(task.description || "")}</div>
                    ${overdue ? '<small class="overdue">Overdue</small>' : ""}
                </td>
                <td>${formatDate(task.deadline)}</td>
                <td>
                    <span class="badge priority-${task.priority.toLowerCase()}">
                        ${escapeHTML(task.priority)}
                    </span>
                </td>
                <td>
                    <span class="badge status-${task.status.toLowerCase()}">
                        ${escapeHTML(task.status)}
                    </span>
                </td>
                <td class="actions">
                    <button class="action-btn edit-btn"
                        data-action="edit" data-id="${task.id}">Edit</button>
                    <button class="action-btn complete-btn"
                        data-action="toggle" data-id="${task.id}">
                        ${task.status === "Completed" ? "Reopen" : "Complete"}
                    </button>
                    <button class="action-btn delete-btn"
                        data-action="delete" data-id="${task.id}">Delete</button>
                </td>
            </tr>
        `;
    }).join("");

    emptyState.classList.toggle("hidden", visibleTasks.length > 0);
    taskCountLabel.textContent =
        `${visibleTasks.length} task${visibleTasks.length === 1 ? "" : "s"} shown`;
}

function openModal(task = null) {
    taskForm.reset();
    titleError.textContent = "";
    editingTaskId = task ? task.id : null;

    modalTitle.textContent = task ? "Edit Task" : "Create New Task";
    saveBtn.textContent = task ? "Update Task" : "Save Task";

    if (task) {
        titleInput.value = task.title;
        descriptionInput.value = task.description || "";
        deadlineInput.value = task.deadline || "";
        priorityInput.value = task.priority;
        statusInput.value = task.status;
    } else {
        priorityInput.value = "Medium";
        statusInput.value = "Pending";
    }

    taskModal.classList.remove("hidden");
    titleInput.focus();
}

function closeModal() {
    taskModal.classList.add("hidden");
    editingTaskId = null;
    titleError.textContent = "";
}

newTaskBtn.addEventListener("click", () => openModal());
closeModalBtn.addEventListener("click", closeModal);
cancelBtn.addEventListener("click", closeModal);

taskModal.addEventListener("click", event => {
    if (event.target === taskModal) closeModal();
});

document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeModal();
});

taskForm.addEventListener("submit", async event => {
    event.preventDefault();

    const title = titleInput.value.trim();

    if (!title) {
        titleError.textContent = "Please enter a task title.";
        titleInput.focus();
        return;
    }

    titleError.textContent = "";

    const payload = {
        title,
        description: descriptionInput.value.trim(),
        deadline: deadlineInput.value || null,
        priority: priorityInput.value,
        status: statusInput.value
    };

    saveBtn.disabled = true;

    try {
        if (editingTaskId !== null) {
            await apiRequest(`${API_URL}${editingTaskId}/`, {
                method: "PATCH",
                body: JSON.stringify(payload)
            });
        } else {
            await apiRequest(API_URL, {
                method: "POST",
                body: JSON.stringify(payload)
            });
        }

        closeModal();
        await loadTasks();
    } catch (error) {
        console.error("Could not save task:", error);
        alert("Task save cheyyalekapoyam. Backend terminal lo error check cheyyi.");
    } finally {
        saveBtn.disabled = false;
    }
});

taskTableBody.addEventListener("click", async event => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const taskId = Number(button.dataset.id);
    const action = button.dataset.action;
    const task = tasks.find(item => item.id === taskId);

    if (!task) return;

    if (action === "edit") {
        openModal(task);
        return;
    }

    try {
        if (action === "delete") {
            if (!confirm(`Delete "${task.title}"?`)) return;

            await apiRequest(`${API_URL}${taskId}/`, {
                method: "DELETE"
            });
        } else if (action === "toggle") {
            const newStatus =
                task.status === "Completed" ? "Pending" : "Completed";

            await apiRequest(`${API_URL}${taskId}/`, {
                method: "PATCH",
                body: JSON.stringify({ status: newStatus })
            });
        }

        await loadTasks();
    } catch (error) {
        console.error("Could not update task:", error);
        alert("Action complete kaaledu. Backend terminal lo error check cheyyi.");
    }
});

searchInput.addEventListener("input", renderTasks);
priorityFilter.addEventListener("change", renderTasks);

document.querySelectorAll("[data-filter]").forEach(button => {
    button.addEventListener("click", () => {
        activeFilter = button.dataset.filter;

        document.querySelectorAll("[data-filter]").forEach(item => {
            item.classList.toggle(
                "active",
                item.dataset.filter === activeFilter
            );
        });

        renderTasks();
    });
});

loadTasks();