import { useEffect, useMemo, useState } from "react";
import { api, setToken, API_BASE } from "./api";

const STATUS_COLUMNS = ["TODO", "IN_PROGRESS", "REVIEW", "DONE"];
const STATUS_LABELS = {
  TODO: "К выполнению",
  IN_PROGRESS: "В работе",
  REVIEW: "На проверке",
  DONE: "Готово",
};
const PRIORITY_LABELS = { LOW: "Низкий", MEDIUM: "Средний", HIGH: "Высокий" };
const ROLE_LABELS = { ADMIN: "Администратор", MANAGER: "Менеджер", EXECUTOR: "Исполнитель", VIEWER: "Наблюдатель" };
const MEMBER_ROLE_LABELS = { OWNER: "Владелец", MANAGER: "Менеджер", MEMBER: "Участник", VIEWER: "Наблюдатель" };

function extractAuthError(err) {
  const data = err?.response?.data;
  if (data?.message) return data.message;
  if (!err?.response) return "Сервер недоступен. Проверьте, что backend запущен на localhost:4000.";
  return "Ошибка аутентификации";
}

function AuthForm({ onAuth }) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("manager@example.com");
  const [password, setPassword] = useState("manager123");
  const [name, setName] = useState("Demo User");
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setError("");
    try {
      const endpoint = isRegister ? "/auth/register" : "/auth/login";
      const payload = isRegister ? { email, password, name } : { email, password };
      const { data } = await api.post(endpoint, payload);
      onAuth(data.token, data.user);
    } catch (err) {
      setError(extractAuthError(err));
    }
  }

  return (
    <div className="auth-wrap">
      <h1>Система управления проектами</h1>
      <form onSubmit={submit} className="card auth-card">
        <h2>{isRegister ? "Регистрация" : "Вход"}</h2>
        {isRegister && <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Имя" required />}
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" required />
        <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Пароль" type="password" required />
        {error && <p className="error">{error}</p>}
        <button type="submit">{isRegister ? "Создать аккаунт" : "Войти"}</button>
        <button type="button" className="ghost" onClick={() => setIsRegister((v) => !v)}>
          {isRegister ? "Уже есть аккаунт? Войти" : "Нет аккаунта? Зарегистрироваться"}
        </button>
      </form>
    </div>
  );
}

function TaskModal({
  task,
  users,
  tags,
  onClose,
  onSave,
  onComment,
  onTimeLog,
  onChecklistAdd,
  onChecklistToggle,
  onChecklistDelete,
  onAttachmentUpload,
  onAttachmentDelete,
  onArchiveTask,
}) {
  const [form, setForm] = useState({
    title: task?.title || "",
    description: task?.description || "",
    priority: task?.priority || "MEDIUM",
    status: task?.status || "TODO",
    assigneeId: task?.assigneeId || "",
    dueDate: task?.dueDate ? new Date(task.dueDate).toISOString().slice(0, 16) : "",
    tagIds: task?.tags?.map((t) => t.tagId) || [],
  });
  const [comment, setComment] = useState("");
  const [planned, setPlanned] = useState("");
  const [spent, setSpent] = useState("");
  const [checkText, setCheckText] = useState("");
  const [file, setFile] = useState(null);
  const isEdit = !!task;

  function toggleTag(tagId) {
    setForm((prev) => ({
      ...prev,
      tagIds: prev.tagIds.includes(tagId) ? prev.tagIds.filter((id) => id !== tagId) : [...prev.tagIds, tagId],
    }));
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal card" onClick={(e) => e.stopPropagation()}>
        <h3>{isEdit ? "Детали задачи" : "Создание задачи"}</h3>
        <div className="grid">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Название" />
          <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
            <option value="LOW">Низкий</option><option value="MEDIUM">Средний</option><option value="HIGH">Высокий</option>
          </select>
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            {STATUS_COLUMNS.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
          <select value={form.assigneeId} onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}>
            <option value="">Не назначен</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({ROLE_LABELS[u.role] || u.role})</option>)}
          </select>
          <input type="datetime-local" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Описание" />
        </div>
        {!!tags.length && (
          <>
            <h4>Теги</h4>
            <div className="tag-list">
              {tags.map((tag) => (
                <label key={tag.id} className="tag-check">
                  <input type="checkbox" checked={form.tagIds.includes(tag.id)} onChange={() => toggleTag(tag.id)} />
                  <span className="tag-pill" style={{ borderColor: tag.color }}>{tag.name}</span>
                </label>
              ))}
            </div>
          </>
        )}
        <div className="row">
          <button onClick={() => onSave({ ...form, assigneeId: form.assigneeId ? Number(form.assigneeId) : null, dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null })}>Сохранить</button>
          <button className="ghost" onClick={onClose}>Закрыть</button>
        </div>

        {isEdit && (
          <>
            <div className="row">
              <button className="ghost danger" onClick={onArchiveTask}>Архивировать задачу</button>
            </div>
            <h4>Чек-лист</h4>
            <div className="checklist">
              {(task.checklist || []).map((item) => (
                <div className="check-item" key={item.id}>
                  <label className="row">
                    <input type="checkbox" checked={item.done} onChange={(e) => onChecklistToggle(item.id, e.target.checked)} />
                    <span className={item.done ? "done" : ""}>{item.text}</span>
                  </label>
                  <button className="ghost" onClick={() => onChecklistDelete(item.id)}>Удалить</button>
                </div>
              ))}
            </div>
            <div className="row">
              <input value={checkText} onChange={(e) => setCheckText(e.target.value)} placeholder="Новый пункт чек-листа" />
              <button onClick={() => { if (checkText.trim()) onChecklistAdd(checkText.trim()); setCheckText(""); }}>Добавить</button>
            </div>

            <h4>Комментарии</h4>
            <div className="comments">
              {(task.comments || []).map((c) => <div key={c.id} className="comment"><b>{c.author?.name || "Пользователь"}:</b> {c.text}</div>)}
            </div>
            <div className="row">
              <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Новый комментарий" />
              <button onClick={() => { if (comment.trim()) onComment(comment.trim()); setComment(""); }}>Добавить</button>
            </div>

            <h4>Учёт времени</h4>
            <div className="row">
              <input type="number" min="0" placeholder="План (часы)" value={planned} onChange={(e) => setPlanned(e.target.value)} />
              <input type="number" min="0" placeholder="Факт (часы)" value={spent} onChange={(e) => setSpent(e.target.value)} />
              <button onClick={() => onTimeLog({ planned: Number(planned || 0), spent: Number(spent || 0) })}>Добавить запись</button>
            </div>

            <h4>Вложения</h4>
            <div className="row">
              <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              <button onClick={() => { if (file) onAttachmentUpload(file); setFile(null); }}>Загрузить</button>
            </div>
            <div className="comments">
              {(task.attachments || []).map((a) => (
                <div className="comment" key={a.id}>
                  <a href={`${API_BASE}/uploads/${a.fileName}`} target="_blank" rel="noreferrer">{a.originalName}</a>
                  <button className="ghost" onClick={() => onAttachmentDelete(a.id)}>Удалить</button>
                </div>
              ))}
            </div>

            <h4>История изменений</h4>
            <div className="comments">
              {(task.history || []).map((h) => (
                <div className="comment" key={h.id}>
                  <b>{h.action}</b> - {new Date(h.createdAt).toLocaleString("ru-RU")}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [token, setTokenState] = useState(localStorage.getItem("token"));
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  });
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [members, setMembers] = useState([]);
  const [tags, setTags] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState(null);
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#2563eb");
  const [memberUserId, setMemberUserId] = useState("");
  const [memberRole, setMemberRole] = useState("MEMBER");
  const [modalTask, setModalTask] = useState(null);
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [filters, setFilters] = useState({ q: "", status: "", priority: "", assigneeId: "", overdue: false, tagId: "" });

  useEffect(() => setToken(token), [token]);

  async function loadProjects() {
    const { data } = await api.get("/projects");
    setProjects(data);
    if (!selectedProject && data.length) setSelectedProject(data[0]);
  }
  async function loadUsers() {
    try { const { data } = await api.get("/users"); setUsers(data); } catch { setUsers([]); }
  }
  async function loadTags(projectId) {
    const { data } = await api.get(`/projects/${projectId}/tags`);
    setTags(data);
  }
  async function loadMembers(projectId) {
    const { data } = await api.get(`/projects/${projectId}/members`);
    setMembers(data);
  }
  async function loadNotifications() {
    const { data } = await api.get("/notifications");
    setNotifications(data);
  }
  async function loadProjectData(projectId) {
    const params = {};
    if (filters.q) params.q = filters.q;
    if (filters.status) params.status = filters.status;
    if (filters.priority) params.priority = filters.priority;
    if (filters.assigneeId) params.assigneeId = Number(filters.assigneeId);
    if (filters.overdue) params.overdue = true;
    const [tasksRes, statsRes] = await Promise.all([api.get(`/projects/${projectId}/tasks`, { params }), api.get(`/dashboard/${projectId}`)]);
    let result = tasksRes.data;
    if (filters.tagId) {
      const tagId = Number(filters.tagId);
      result = result.filter((task) => (task.tags || []).some((t) => t.tagId === tagId));
    }
    setTasks(result);
    setStats(statsRes.data);
  }

  useEffect(() => { if (!token) return; loadProjects(); loadUsers(); }, [token]);
  useEffect(() => {
    if (!token || !selectedProject) return;
    loadTags(selectedProject.id);
    loadMembers(selectedProject.id);
    loadProjectData(selectedProject.id);
  }, [token, selectedProject?.id, filters.q, filters.status, filters.priority, filters.assigneeId, filters.overdue, filters.tagId]);
  useEffect(() => {
    if (!token) return;
    api.post("/notifications/scan").catch(() => null);
    loadNotifications().catch(() => null);
  }, [token]);

  function onAuth(newToken, nextUser) {
    setTokenState(newToken);
    setUser(nextUser);
    localStorage.setItem("token", newToken);
    localStorage.setItem("user", JSON.stringify(nextUser));
  }
  function logout() {
    setTokenState(null); setUser(null);
    localStorage.removeItem("token"); localStorage.removeItem("user");
  }

  async function createProject(e) {
    e.preventDefault();
    if (!newProjectTitle.trim()) return;
    await api.post("/projects", { title: newProjectTitle, description: newProjectDesc });
    setNewProjectTitle(""); setNewProjectDesc(""); await loadProjects();
  }
  async function deleteProject() {
    if (!selectedProject) return;
    const ok = window.confirm(`Удалить проект "${selectedProject.title}"? Это действие необратимо.`);
    if (!ok) return;
    try {
      await api.delete(`/projects/${selectedProject.id}`);
      const { data } = await api.get("/projects");
      setProjects(data);
      setSelectedProject(data.length ? data[0] : null);
      setTasks([]);
      setStats(null);
      setModalTask(null);
    } catch (err) {
      const msg = err?.response?.data?.message || "Не удалось удалить проект. Проверьте права (нужна роль менеджера в этом проекте).";
      alert(msg);
    }
  }
  async function archiveProject() {
    if (!selectedProject) return;
    const ok = window.confirm(`Архивировать проект "${selectedProject.title}"?`);
    if (!ok) return;
    await api.post(`/projects/${selectedProject.id}/archive`);
    const { data } = await api.get("/projects");
    setProjects(data);
    setSelectedProject(data.length ? data[0] : null);
  }
  async function createTag(e) {
    e.preventDefault();
    if (!newTagName.trim() || !selectedProject) return;
    await api.post(`/projects/${selectedProject.id}/tags`, { name: newTagName, color: newTagColor });
    setNewTagName(""); setNewTagColor("#2563eb");
    await loadTags(selectedProject.id);
  }
  async function addMember(e) {
    e.preventDefault();
    if (!memberUserId || !selectedProject) return;
    await api.post(`/projects/${selectedProject.id}/members`, { userId: Number(memberUserId), role: memberRole });
    setMemberUserId("");
    setMemberRole("MEMBER");
    await loadMembers(selectedProject.id);
  }
  async function updateMemberRole(userId, role) {
    await api.put(`/projects/${selectedProject.id}/members/${userId}`, { role });
    await loadMembers(selectedProject.id);
  }
  async function removeMember(userId) {
    await api.delete(`/projects/${selectedProject.id}/members/${userId}`);
    await loadMembers(selectedProject.id);
  }
  async function saveTask(payload, existingTask) {
    try {
      if (existingTask) {
        await api.put(`/tasks/${existingTask.id}`, payload);
        setModalTask(null);
      } else {
        const createPayload = {
          title: payload.title,
          description: payload.description,
          projectId: selectedProject.id,
          priority: payload.priority,
          status: payload.status,
          tagIds: payload.tagIds,
          ...(payload.assigneeId ? { assigneeId: payload.assigneeId } : {}),
          ...(payload.dueDate ? { dueDate: payload.dueDate } : {}),
        };
        await api.post("/tasks", createPayload);
        setIsCreateTaskOpen(false);
      }
      await loadProjectData(selectedProject.id);
    } catch (err) {
      alert(err?.response?.data?.message || "Не удалось сохранить задачу");
    }
  }
  async function addComment(taskId, text) {
    await api.post(`/tasks/${taskId}/comments`, { text });
    const { data } = await api.get(`/projects/${selectedProject.id}/tasks`);
    setTasks(data); setModalTask(data.find((t) => t.id === taskId));
  }
  async function addTimeLog(taskId, payload) {
    await api.post(`/tasks/${taskId}/timelogs`, payload);
    const { data } = await api.get(`/projects/${selectedProject.id}/tasks`);
    setTasks(data); setModalTask(data.find((t) => t.id === taskId));
  }
  async function addChecklist(taskId, text) {
    await api.post(`/tasks/${taskId}/checklist`, { text });
    await loadProjectData(selectedProject.id);
    const { data } = await api.get(`/projects/${selectedProject.id}/tasks`);
    setModalTask(data.find((t) => t.id === taskId));
  }
  async function toggleChecklist(itemId, done, taskId) {
    await api.put(`/checklist/${itemId}`, { done });
    const { data } = await api.get(`/projects/${selectedProject.id}/tasks`);
    setTasks(data); setModalTask(data.find((t) => t.id === taskId));
  }
  async function deleteChecklist(itemId, taskId) {
    await api.delete(`/checklist/${itemId}`);
    const { data } = await api.get(`/projects/${selectedProject.id}/tasks`);
    setTasks(data); setModalTask(data.find((t) => t.id === taskId));
  }
  async function onTaskDrop(taskId, status) {
    await api.put(`/tasks/${taskId}`, { status });
    await loadProjectData(selectedProject.id);
  }
  async function archiveTask(taskId) {
    await api.post(`/tasks/${taskId}/archive`);
    await loadProjectData(selectedProject.id);
    setModalTask(null);
  }
  async function uploadAttachment(taskId, file) {
    try {
      const formData = new FormData();
      formData.append("file", file);
      await api.post(`/tasks/${taskId}/attachments`, formData);
      const { data } = await api.get(`/projects/${selectedProject.id}/tasks`);
      setTasks(data);
      setModalTask(data.find((t) => t.id === taskId));
    } catch (err) {
      alert(err?.response?.data?.message || "Не удалось загрузить файл");
    }
  }
  async function deleteAttachment(taskId, attachmentId) {
    await api.delete(`/attachments/${attachmentId}`);
    const { data } = await api.get(`/projects/${selectedProject.id}/tasks`);
    setTasks(data);
    setModalTask(data.find((t) => t.id === taskId));
  }
  async function exportReport() {
    const response = await api.get(`/projects/${selectedProject.id}/export.csv`, { responseType: "blob" });
    const blobUrl = window.URL.createObjectURL(new Blob([response.data], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = blobUrl;
    link.setAttribute("download", `project-${selectedProject.id}-report.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(blobUrl);
  }
  async function markNotificationRead(id) {
    await api.put(`/notifications/${id}/read`);
    await loadNotifications();
  }
  function resetFilters() {
    setFilters({ q: "", status: "", priority: "", assigneeId: "", overdue: false, tagId: "" });
  }

  const grouped = useMemo(() => {
    const map = { TODO: [], IN_PROGRESS: [], REVIEW: [], DONE: [] };
    tasks.forEach((t) => map[t.status]?.push(t));
    return map;
  }, [tasks]);

  if (!token || !user) return <AuthForm onAuth={onAuth} />;

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-left">
          <h1>Система управления проектами</h1>
          <p className="topbar-subtitle">Рабочее пространство команды</p>
        </div>
        <div className="row">
          <button className="ghost" onClick={() => setShowNotifications((v) => !v)}>
            Уведомления ({notifications.filter((n) => !n.read).length})
          </button>
          <span className="user-chip">{user.name} ({ROLE_LABELS[user.role] || user.role})</span>
          <button className="ghost" onClick={logout}>Выйти</button>
        </div>
      </header>
      {showNotifications && (
        <div className="notifications card">
          <h4>Уведомления</h4>
          {notifications.length === 0 && <p className="muted">Нет уведомлений</p>}
          {notifications.map((n) => (
            <div key={n.id} className={n.read ? "comment" : "comment unread"}>
              <b>{n.title}</b>
              <div>{n.message}</div>
              {!n.read && <button className="ghost" onClick={() => markNotificationRead(n.id)}>Отметить прочитанным</button>}
            </div>
          ))}
        </div>
      )}
      <div className="layout">
        <aside className="sidebar card">
          <div className="sidebar-section">
            <h3>Проекты</h3>
            <p className="section-hint">Выберите проект для просмотра задач</p>
          </div>
          <div className="project-list">
            {projects.map((p) => <button key={p.id} className={selectedProject?.id === p.id ? "project-btn active" : "project-btn"} onClick={() => setSelectedProject(p)}>{p.title}</button>)}
          </div>
          {(user.role === "ADMIN" || user.role === "MANAGER") && (
            <form onSubmit={createProject} className="new-project actions-panel">
              <h4>Новый проект</h4>
              <input value={newProjectTitle} onChange={(e) => setNewProjectTitle(e.target.value)} placeholder="Название нового проекта" />
              <textarea value={newProjectDesc} onChange={(e) => setNewProjectDesc(e.target.value)} placeholder="Описание" />
              <button type="submit">Создать проект</button>
            </form>
          )}
        </aside>
        <main className="main">
          {selectedProject && (
            <>
              <section className="card">
                <div className="project-head">
                  <div>
                    <h2>{selectedProject.title}</h2>
                    <p>{selectedProject.description || "Описание отсутствует"}</p>
                  </div>
                  <div className="row">
                    {(user.role === "ADMIN" || user.role === "MANAGER" || user.role === "EXECUTOR") && <button onClick={() => setIsCreateTaskOpen(true)}>Создать задачу</button>}
                    {(user.role === "ADMIN" || user.role === "MANAGER") && <button className="ghost" onClick={exportReport}>Экспорт отчета</button>}
                    {(user.role === "ADMIN" || user.role === "MANAGER") && <button className="ghost danger" onClick={archiveProject}>Архивировать проект</button>}
                    {(user.role === "ADMIN" || user.role === "MANAGER") && <button className="ghost danger" onClick={deleteProject}>Удалить проект</button>}
                  </div>
                </div>
                {stats && <div className="stats"><div className="stat">Всего<br /><b>{stats.total}</b></div><div className="stat">К выполнению<br /><b>{stats.todo}</b></div><div className="stat">В работе<br /><b>{stats.inProgress}</b></div><div className="stat">На проверке<br /><b>{stats.review}</b></div><div className="stat">Готово<br /><b>{stats.done}</b></div><div className="stat">Просрочено<br /><b>{stats.overdue}</b></div></div>}

                <div className="toolbar card">
                  <h4>Фильтры задач</h4>
                  <div className="filters">
                    <div className="field"><label>Поиск</label><input placeholder="Название или описание" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} /></div>
                    <div className="field"><label>Статус</label><select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
                      <option value="">Все статусы</option>{STATUS_COLUMNS.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                    </select></div>
                    <div className="field"><label>Приоритет</label><select value={filters.priority} onChange={(e) => setFilters({ ...filters, priority: e.target.value })}>
                      <option value="">Любой</option><option value="LOW">Низкий</option><option value="MEDIUM">Средний</option><option value="HIGH">Высокий</option>
                    </select></div>
                    <div className="field"><label>Исполнитель</label><select value={filters.assigneeId} onChange={(e) => setFilters({ ...filters, assigneeId: e.target.value })}>
                      <option value="">Любой</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select></div>
                    <div className="field"><label>Тег</label><select value={filters.tagId} onChange={(e) => setFilters({ ...filters, tagId: e.target.value })}>
                      <option value="">Любой</option>{tags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
                    </select></div>
                    <div className="field checkbox-field"><label><input type="checkbox" checked={filters.overdue} onChange={(e) => setFilters({ ...filters, overdue: e.target.checked })} />Только просроченные</label></div>
                  </div>
                  <div className="row">
                    <button type="button" className="ghost" onClick={resetFilters}>Сбросить фильтры</button>
                  </div>
                </div>

                <form className="row tag-create" onSubmit={createTag}>
                  <input placeholder="Новый тег" value={newTagName} onChange={(e) => setNewTagName(e.target.value)} />
                  <input type="color" value={newTagColor} onChange={(e) => setNewTagColor(e.target.value)} />
                  <button type="submit">Добавить тег</button>
                </form>
                <div className="members card">
                  <h4>Участники проекта и права</h4>
                  {(user.role === "ADMIN" || user.role === "MANAGER") && (
                    <form className="row" onSubmit={addMember}>
                      <select value={memberUserId} onChange={(e) => setMemberUserId(e.target.value)}>
                        <option value="">Выберите пользователя</option>
                        {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
                      </select>
                      <select value={memberRole} onChange={(e) => setMemberRole(e.target.value)}>
                        <option value="MANAGER">Менеджер</option>
                        <option value="MEMBER">Участник</option>
                        <option value="VIEWER">Наблюдатель</option>
                      </select>
                      <button type="submit">Добавить</button>
                    </form>
                  )}
                  {members.map((m) => (
                    <div className="member-row" key={m.userId}>
                      <span>{m.user.name}</span>
                      <select value={m.role} onChange={(e) => updateMemberRole(m.userId, e.target.value)} disabled={!(user.role === "ADMIN" || user.role === "MANAGER")}>
                        <option value="OWNER">Владелец</option>
                        <option value="MANAGER">Менеджер</option>
                        <option value="MEMBER">Участник</option>
                        <option value="VIEWER">Наблюдатель</option>
                      </select>
                      <span className="muted">{MEMBER_ROLE_LABELS[m.role]}</span>
                      {(user.role === "ADMIN" || user.role === "MANAGER") && m.userId !== user.id && <button className="ghost" onClick={() => removeMember(m.userId)}>Удалить</button>}
                    </div>
                  ))}
                </div>
              </section>

              <section className="board">
                {STATUS_COLUMNS.map((status) => (
                  <div key={status} className="column card" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { const id = Number(e.dataTransfer.getData("text/plain")); if (id) onTaskDrop(id, status); }}>
                    <div className="column-head">
                      <h3>{STATUS_LABELS[status]}</h3>
                      <span>{(grouped[status] || []).length}</span>
                    </div>
                    {(grouped[status] || []).map((task) => (
                      <div key={task.id} className="task" draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", String(task.id))} onClick={() => setModalTask(task)}>
                        <div className="task-title">{task.title}</div>
                        <div className="muted">{PRIORITY_LABELS[task.priority] || task.priority}</div>
                        <div className="muted">{task.assignee?.name || "Не назначен"}</div>
                        {task.dueDate && <div className="muted">Срок: {new Date(task.dueDate).toLocaleDateString("ru-RU")}</div>}
                        <div className="task-tags">
                          {(task.tags || []).map((t) => <span key={t.id} className="tag-pill" style={{ borderColor: t.tag.color }}>{t.tag.name}</span>)}
                        </div>
                      </div>
                    ))}
                    {(grouped[status] || []).length === 0 && <p className="empty-column">Задач пока нет</p>}
                  </div>
                ))}
              </section>
            </>
          )}
        </main>
      </div>

      {isCreateTaskOpen && <TaskModal users={users} tags={tags} onClose={() => setIsCreateTaskOpen(false)} onSave={(payload) => saveTask(payload, null)} />}
      {modalTask && (
        <TaskModal
          task={modalTask}
          users={users}
          tags={tags}
          onClose={() => setModalTask(null)}
          onSave={(payload) => saveTask(payload, modalTask)}
          onComment={(text) => addComment(modalTask.id, text)}
          onTimeLog={(payload) => addTimeLog(modalTask.id, payload)}
          onChecklistAdd={(text) => addChecklist(modalTask.id, text)}
          onChecklistToggle={(itemId, done) => toggleChecklist(itemId, done, modalTask.id)}
          onChecklistDelete={(itemId) => deleteChecklist(itemId, modalTask.id)}
          onAttachmentUpload={(file) => uploadAttachment(modalTask.id, file)}
          onAttachmentDelete={(attachmentId) => deleteAttachment(modalTask.id, attachmentId)}
          onArchiveTask={() => archiveTask(modalTask.id)}
        />
      )}
    </div>
  );
}
