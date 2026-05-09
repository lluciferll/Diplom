import { useEffect, useMemo, useState, useRef } from "react";
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
    <div className="auth-page">
      <div className="auth-brand">
        <div className="auth-brand-ambient" aria-hidden />
        <div className="auth-brand-inner">
          <div className="auth-logo-xl" aria-hidden>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 13a8 8 0 0 1 16 0" />
              <path d="M4 13v6a2 2 0 0 0 2 2h2" />
              <path d="M20 13v6a2 2 0 0 1-2 2h-2" />
              <path d="M9 17h6" />
            </svg>
          </div>
          <p className="auth-eyebrow">Система управления проектами</p>
          <h1 className="auth-title-display">
            <span className="auth-title-primary">Командное</span>
            <span className="auth-title-secondary">пространство</span>
          </h1>
          <p className="auth-lead">Канбан, роли, фильтры и сроки — в одном окне для всей команды.</p>
          <div className="auth-brand-badges">
            <span className="badge-soft">Kanban</span>
            <span className="badge-soft">Роли и права</span>
            <span className="badge-soft">Учёт времени</span>
          </div>
        </div>
      </div>
      <div className="auth-panel">
        <form onSubmit={submit} className="card auth-card">
          <h2>{isRegister ? "Регистрация" : "Вход в систему"}</h2>
          <p className="auth-card-sub">{isRegister ? "Заполните данные нового аккаунта." : "Введите почту и пароль для входа."}</p>
          {isRegister && <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Имя" required />}
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" required autoComplete="email" />
          <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Пароль" type="password" required autoComplete={isRegister ? "new-password" : "current-password"} />
          {error && <p className="error">{error}</p>}
          <button type="submit">{isRegister ? "Создать аккаунт" : "Войти"}</button>
          <button type="button" className="ghost" onClick={() => setIsRegister((v) => !v)}>
            {isRegister ? "Уже есть аккаунт? Войти" : "Нет аккаунта? Зарегистрироваться"}
          </button>
        </form>
      </div>
    </div>
  );
}

const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);

const BellIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <path d="M18 8A6 6 0 106 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 01-3.46 0" />
  </svg>
);

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
  const [modalTab, setModalTab] = useState("checklist");
  const isEdit = !!task;

  const nChecklist = task?.checklist?.length ?? 0;
  const nComments = task?.comments?.length ?? 0;
  const nFiles = task?.attachments?.length ?? 0;
  const nHistory = task?.history?.length ?? 0;

  useEffect(() => {
    setModalTab("checklist");
  }, [task?.id]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function toggleTag(tagId) {
    setForm((prev) => ({
      ...prev,
      tagIds: prev.tagIds.includes(tagId) ? prev.tagIds.filter((id) => id !== tagId) : [...prev.tagIds, tagId],
    }));
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal modal-task"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-modal-title"
      >
        <div className="modal-task-header">
          <div>
            <p className="modal-task-kicker">{isEdit ? "Редактирование" : "Создание"}</p>
            <h3 id="task-modal-title">{isEdit ? (form.title.trim() || "Задача") : "Новая задача"}</h3>
            <p className="modal-task-lead">
              {isEdit
                ? "Сначала сохраните поля карточки. Чек-лист, переписка и файлы — во вкладках ниже."
                : "Заполните основное и нажмите «Создать». Остальное добавите после сохранения."}
            </p>
          </div>
          <button type="button" className="modal-task-close" aria-label="Закрыть" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>

        <div className="modal-task-body">
          <div className="modal-task-panel">
            <p className="modal-panel-label">Основное</p>
            <div className="form-grid-2 modal-form-grid">
              <div className="field">
                <label htmlFor="task-title">Название</label>
                <input id="task-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Кратко, по сути" />
              </div>
              <div className="field">
                <label htmlFor="task-priority">Приоритет</label>
                <select id="task-priority" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                  <option value="LOW">Низкий</option>
                  <option value="MEDIUM">Средний</option>
                  <option value="HIGH">Высокий</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="task-status">Колонка на доске</label>
                <select id="task-status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {STATUS_COLUMNS.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                </select>
              </div>
              <div className="field field-span-full">
                <label htmlFor="task-assignee">Исполнитель</label>
                <select id="task-assignee" value={form.assigneeId} onChange={(e) => setForm({ ...form, assigneeId: e.target.value })} title={form.assigneeId ? (users.find((u) => String(u.id) === String(form.assigneeId))?.name ?? "") : ""}>
                  <option value="">Не назначен</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.name} — {ROLE_LABELS[u.role] || u.role}</option>)}
                </select>
              </div>
              <div className="field field-span-full">
                <label htmlFor="task-due">Срок выполнения</label>
                <input id="task-due" type="datetime-local" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
              </div>
            </div>
            <div className="field field-tight-top">
              <label htmlFor="task-desc">Описание</label>
              <textarea id="task-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Контекст, критерии готовности, ссылки…" rows={4} />
            </div>
            {!!tags.length && (
              <div className="modal-tags-block">
                <p className="modal-panel-label">Метки</p>
                <div className="tag-list">
                  {tags.map((tag) => (
                    <label key={tag.id} className="tag-check">
                      <input type="checkbox" checked={form.tagIds.includes(tag.id)} onChange={() => toggleTag(tag.id)} />
                      <span className="tag-pill" style={{ borderColor: tag.color }}>{tag.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="modal-task-footer">
            <div className="modal-task-footer-main">
              <button
                type="button"
                onClick={() => onSave({ ...form, assigneeId: form.assigneeId ? Number(form.assigneeId) : null, dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null })}
              >
                {isEdit ? "Сохранить карточку" : "Создать задачу"}
              </button>
              <button type="button" className="ghost" onClick={onClose}>Закрыть без сохранения</button>
            </div>
            {isEdit && (
              <button type="button" className="btn-text-danger" onClick={onArchiveTask}>В архив</button>
            )}
          </div>

          {isEdit && (
            <>
              <div className="modal-tabs-wrap">
                <p className="modal-tabs-heading">Что хотите сделать с задачей сейчас?</p>
                <div className="modal-tabs" role="tablist" aria-label="Разделы задачи">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={modalTab === "checklist"}
                    className={`modal-tab${modalTab === "checklist" ? " active" : ""}`}
                    onClick={() => setModalTab("checklist")}
                  >
                    Чек-лист
                    <span className="tab-badge">{nChecklist}</span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={modalTab === "chat"}
                    className={`modal-tab${modalTab === "chat" ? " active" : ""}`}
                    onClick={() => setModalTab("chat")}
                  >
                    Обсуждение
                    <span className="tab-badge">{nComments}</span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={modalTab === "time"}
                    className={`modal-tab${modalTab === "time" ? " active" : ""}`}
                    onClick={() => setModalTab("time")}
                  >
                    Время
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={modalTab === "files"}
                    className={`modal-tab${modalTab === "files" ? " active" : ""}`}
                    onClick={() => setModalTab("files")}
                  >
                    Файлы
                    <span className="tab-badge">{nFiles}</span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={modalTab === "history"}
                    className={`modal-tab${modalTab === "history" ? " active" : ""}`}
                    onClick={() => setModalTab("history")}
                  >
                    История
                    <span className="tab-badge">{nHistory}</span>
                  </button>
                </div>
              </div>

              <div className="modal-tab-panels">
                {modalTab === "checklist" && (
                  <section className="modal-tab-panel" role="tabpanel">
                    <p className="modal-tab-help">Подзадачи. Отмечайте выполненное — так видно прогресс.</p>
                    <div className="checklist">
                      {(task.checklist || []).map((item) => (
                        <div className="check-item" key={item.id}>
                          <label className="check-item-label">
                            <input type="checkbox" checked={item.done} onChange={(e) => onChecklistToggle(item.id, e.target.checked)} />
                            <span className={item.done ? "done" : ""}>{item.text}</span>
                          </label>
                          <button type="button" className="ghost btn-sm" onClick={() => onChecklistDelete(item.id)}>Убрать</button>
                        </div>
                      ))}
                    </div>
                    <div className="modal-inline-add">
                      <input value={checkText} onChange={(e) => setCheckText(e.target.value)} placeholder="Текст пункта" />
                      <button type="button" onClick={() => { if (checkText.trim()) onChecklistAdd(checkText.trim()); setCheckText(""); }}>Добавить пункт</button>
                    </div>
                  </section>
                )}

                {modalTab === "chat" && (
                  <section className="modal-tab-panel" role="tabpanel">
                    <p className="modal-tab-help">Короткие сообщения по задаче. Сначала сохраните карточку, если меняли поля сверху.</p>
                    <div className="comment-thread">
                      {(task.comments || []).length === 0 && <p className="empty-hint">Пока нет сообщений.</p>}
                      {(task.comments || []).map((c) => (
                        <div key={c.id} className="comment-bubble">
                          <span className="comment-author">{c.author?.name || "Пользователь"}</span>
                          <p className="comment-text">{c.text}</p>
                        </div>
                      ))}
                    </div>
                    <div className="modal-inline-add modal-inline-add-stack">
                      <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Написать комментарий…" rows={2} />
                      <button type="button" onClick={() => { if (comment.trim()) onComment(comment.trim()); setComment(""); }}>Отправить</button>
                    </div>
                  </section>
                )}

                {modalTab === "time" && (
                  <section className="modal-tab-panel" role="tabpanel">
                    <p className="modal-tab-help">План и факт в часах (можно добавлять несколько записей через API; здесь — одна запись за раз).</p>
                    <div className="modal-inline-add modal-time-row">
                      <div className="field field-inline">
                        <label htmlFor="time-plan">План, ч</label>
                        <input id="time-plan" type="number" min="0" placeholder="0" value={planned} onChange={(e) => setPlanned(e.target.value)} />
                      </div>
                      <div className="field field-inline">
                        <label htmlFor="time-fact">Факт, ч</label>
                        <input id="time-fact" type="number" min="0" placeholder="0" value={spent} onChange={(e) => setSpent(e.target.value)} />
                      </div>
                      <button type="button" className="btn-time-submit" onClick={() => onTimeLog({ planned: Number(planned || 0), spent: Number(spent || 0) })}>
                        Записать
                      </button>
                    </div>
                  </section>
                )}

                {modalTab === "files" && (
                  <section className="modal-tab-panel" role="tabpanel">
                    <p className="modal-tab-help">Файлы хранятся на сервере; ссылка откроется в новой вкладке.</p>
                    <div className="modal-inline-add modal-file-row">
                      <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                      <button type="button" onClick={() => { if (file) onAttachmentUpload(file); setFile(null); }}>Загрузить</button>
                    </div>
                    {(task.attachments || []).length === 0 ? (
                      <p className="empty-hint">Вложений пока нет.</p>
                    ) : (
                      <ul className="attachment-list">
                        {(task.attachments || []).map((a) => (
                          <li key={a.id} className="attachment-item">
                            <a href={`${API_BASE}/uploads/${a.fileName}`} target="_blank" rel="noreferrer">{a.originalName}</a>
                            <button type="button" className="ghost btn-sm" onClick={() => onAttachmentDelete(a.id)}>Удалить</button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                )}

                {modalTab === "history" && (
                  <section className="modal-tab-panel" role="tabpanel">
                    <p className="modal-tab-help">Автоматические отметки о действиях с задачей.</p>
                    {(task.history || []).length === 0 ? (
                      <p className="empty-hint">Записей пока нет.</p>
                    ) : (
                      <ul className="history-list">
                        {(task.history || []).map((h) => (
                          <li key={h.id} className="history-item">
                            <span className="history-action">{h.action}</span>
                            <time className="history-time">{new Date(h.createdAt).toLocaleString("ru-RU")}</time>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                )}
              </div>
            </>
          )}
        </div>
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
  const [projectSearch, setProjectSearch] = useState("");
  const [dragOverColumn, setDragOverColumn] = useState(null);
  const notifRef = useRef(null);

  useEffect(() => setToken(token), [token]);

  useEffect(() => {
    if (!showNotifications) return;
    function handleClick(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifications(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showNotifications]);

  useEffect(() => {
    function clearDrag() {
      setDragOverColumn(null);
    }
    window.addEventListener("dragend", clearDrag);
    return () => window.removeEventListener("dragend", clearDrag);
  }, []);

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

  const filteredProjects = useMemo(() => {
    const q = projectSearch.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => p.title.toLowerCase().includes(q));
  }, [projects, projectSearch]);

  function toggleStatusChip(status) {
    setFilters((f) => ({ ...f, status: f.status === status ? "" : status }));
  }

  if (!token || !user) return <AuthForm onAuth={onAuth} />;

  return (
    <div className="app app-logged">
      <div className="topbar-shell">
        <header className="topbar">
          <div className="topbar-brand">
            <div className="topbar-logo" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 13a8 8 0 0 1 16 0" />
                <path d="M4 13v6a2 2 0 0 0 2 2h2" />
                <path d="M20 13v6a2 2 0 0 1-2 2h-2" />
                <path d="M9 17h6" />
              </svg>
            </div>
            <div className="topbar-left">
              <h1>Командное пространство</h1>
              <p className="topbar-subtitle">Проекты и канбан</p>
            </div>
          </div>
          <div className="topbar-actions">
            <div className="popover-anchor" ref={notifRef}>
              <button type="button" className="ghost btn-primary-icon" onClick={() => setShowNotifications((v) => !v)} aria-expanded={showNotifications}>
                <BellIcon />
                Уведомления
                {notifications.filter((n) => !n.read).length > 0 && (
                  <span className="priority-pill" style={{ marginLeft: "2px" }}>{notifications.filter((n) => !n.read).length}</span>
                )}
              </button>
              {showNotifications && (
                <div className="notifications-dropdown card">
                  <h4>Уведомления</h4>
                  {notifications.length === 0 && <p className="muted">Пока пусто</p>}
                  {notifications.map((n) => (
                    <div key={n.id} className={n.read ? "comment" : "comment unread"}>
                      <b>{n.title}</b>
                      <div>{n.message}</div>
                      {!n.read && (
                        <button type="button" className="ghost" style={{ marginTop: "8px" }} onClick={() => markNotificationRead(n.id)}>
                          Прочитано
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <span className="user-chip" title={`${ROLE_LABELS[user.role] || user.role}`}>{user.name}</span>
            <button type="button" className="ghost" onClick={logout}>Выйти</button>
          </div>
        </header>
      </div>
      <div className="layout">
        <aside className="sidebar card">
          <div className="sidebar-section-title">
            <h3>Ваши проекты</h3>
          </div>
          <p className="section-hint">Слева — список, справа — доска задач выбранного проекта.</p>
          <div className="project-search-wrap">
            <label htmlFor="project-search">Поиск проекта</label>
            <input
              id="project-search"
              className="sidebar-search"
              value={projectSearch}
              onChange={(e) => setProjectSearch(e.target.value)}
              placeholder="Начните вводить название…"
            />
          </div>
          <div className="project-list">
            {filteredProjects.map((p) => (
              <button
                key={p.id}
                type="button"
                className={selectedProject?.id === p.id ? "project-btn active" : "project-btn"}
                onClick={() => setSelectedProject(p)}
              >
                {p.title}
              </button>
            ))}
          </div>
          {filteredProjects.length === 0 && projectSearch.trim() && <p className="section-hint">Ничего не найдено — сбросьте поиск.</p>}
          {(user.role === "ADMIN" || user.role === "MANAGER") && (
            <form onSubmit={createProject} className="new-project actions-panel">
              <h4>Новый проект</h4>
              <input value={newProjectTitle} onChange={(e) => setNewProjectTitle(e.target.value)} placeholder="Краткое название" />
              <textarea value={newProjectDesc} onChange={(e) => setNewProjectDesc(e.target.value)} placeholder="Для команды — о чём проект" />
              <button type="submit">Создать проект</button>
            </form>
          )}
        </aside>
        <main className="main">
          {!selectedProject && projects.length > 0 && (
            <div className="empty-workspace card">
              <h2>Выберите проект слева</h2>
              <p>Он откроет статистику, фильтры и канбан-доску.</p>
            </div>
          )}
          {projects.length === 0 && (
            <div className="empty-workspace card">
              <h2>Пока нет проектов</h2>
              <p>Если у вас есть права администратора или менеджера, создайте первый проект в боковой панели.</p>
            </div>
          )}
          {selectedProject && (
            <>
              <section className="card workspace-overview">
                <div className="page-hero">
                  <div>
                    <p className="breadcrumb">
                      Проекты <span>›</span> {selectedProject.title}
                    </p>
                    <h2>{selectedProject.title}</h2>
                    <p className="page-hero-desc">{selectedProject.description || "Добавьте описание проекта, чтобы команде было понятнее контекст."}</p>
                  </div>
                  <div className="hero-actions">
                    {(user.role === "ADMIN" || user.role === "MANAGER" || user.role === "EXECUTOR") && (
                      <button type="button" className="btn-primary-icon" onClick={() => setIsCreateTaskOpen(true)}>
                        <PlusIcon />
                        Новая задача
                      </button>
                    )}
                    {(user.role === "ADMIN" || user.role === "MANAGER") && (
                      <button type="button" className="ghost" onClick={exportReport}>Скачать CSV</button>
                    )}
                    {(user.role === "ADMIN" || user.role === "MANAGER") && (
                      <button type="button" className="ghost danger" onClick={archiveProject}>В архив</button>
                    )}
                    {(user.role === "ADMIN" || user.role === "MANAGER") && (
                      <button type="button" className="ghost danger" onClick={deleteProject}>Удалить проект</button>
                    )}
                  </div>
                </div>
                {stats && (
                  <div className="stats stats-compact" aria-label="Сводка по задачам">
                    <div className="stat stat-pill"><span className="stat-name">Всего</span><b>{stats.total}</b></div>
                    <div className="stat stat-pill"><span className="stat-name">К выполнению</span><b>{stats.todo}</b></div>
                    <div className="stat stat-pill"><span className="stat-name">В работе</span><b>{stats.inProgress}</b></div>
                    <div className="stat stat-pill"><span className="stat-name">На проверке</span><b>{stats.review}</b></div>
                    <div className="stat stat-pill"><span className="stat-name">Готово</span><b>{stats.done}</b></div>
                    <div className="stat stat-pill stat-pill-warn"><span className="stat-name">Просрочено</span><b>{stats.overdue}</b></div>
                  </div>
                )}

                <div className="search-strip search-strip-tuned">
                  <div className="search-strip-top">
                    <div className="search-field-big">
                      <label htmlFor="task-search">Поиск по задачам</label>
                      <input
                        id="task-search"
                        placeholder="Имя или фрагмент описания"
                        value={filters.q}
                        onChange={(e) => setFilters({ ...filters, q: e.target.value })}
                      />
                    </div>
                    <button type="button" className="ghost btn-reset-filters" onClick={resetFilters}>Сбросить</button>
                  </div>
                  <p className="chip-hint">Быстро по статусу (можно вклучить второй фильтр в разделе ниже)</p>
                  <div className="chip-row" role="group" aria-label="Фильтр по статусу">
                    <button type="button" className={`filter-chip${filters.status === "" ? " active" : ""}`} onClick={() => setFilters((f) => ({ ...f, status: "" }))}>Все</button>
                    {STATUS_COLUMNS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        className={`filter-chip${filters.status === s ? " active" : ""}`}
                        onClick={() => toggleStatusChip(s)}
                      >
                        {STATUS_LABELS[s]}
                      </button>
                    ))}
                  </div>
                </div>

                <details className="filters-advanced">
                  <summary>Дополнительные фильтры и теги</summary>
                  <div className="filters-inner">
                    <div className="filters">
                      <div className="field">
                        <label htmlFor="fil-status">Статус в списке</label>
                        <select id="fil-status" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
                          <option value="">Все</option>{STATUS_COLUMNS.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                        </select>
                      </div>
                      <div className="field">
                        <label htmlFor="fil-priority">Приоритет</label>
                        <select id="fil-priority" value={filters.priority} onChange={(e) => setFilters({ ...filters, priority: e.target.value })}>
                          <option value="">Любой</option>
                          <option value="LOW">Низкий</option>
                          <option value="MEDIUM">Средний</option>
                          <option value="HIGH">Высокий</option>
                        </select>
                      </div>
                      <div className="field">
                        <label htmlFor="fil-assignee">Исполнитель</label>
                        <select id="fil-assignee" value={filters.assigneeId} onChange={(e) => setFilters({ ...filters, assigneeId: e.target.value })}>
                          <option value="">Любой</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                      </div>
                      <div className="field">
                        <label htmlFor="fil-tag">Тег</label>
                        <select id="fil-tag" value={filters.tagId} onChange={(e) => setFilters({ ...filters, tagId: e.target.value })}>
                          <option value="">Любой</option>{tags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
                        </select>
                      </div>
                      <div className="field checkbox-field">
                        <label><input type="checkbox" checked={filters.overdue} onChange={(e) => setFilters({ ...filters, overdue: e.target.checked })} />Только просроченные</label>
                      </div>
                    </div>

                    <form className="row tag-create" onSubmit={createTag} aria-label="Создание тега">
                      <input placeholder="Название тега" value={newTagName} onChange={(e) => setNewTagName(e.target.value)} />
                      <input type="color" value={newTagColor} onChange={(e) => setNewTagColor(e.target.value)} title="Цвет" aria-label="Цвет тега" />
                      <button type="submit">Добавить тег</button>
                    </form>
                  </div>
                </details>

                <details className="details-block">
                  <summary>Команда и права доступа</summary>
                  <div className="details-body members-inner">
                    {(user.role === "ADMIN" || user.role === "MANAGER") && (
                      <form className="row" onSubmit={addMember}>
                        <select value={memberUserId} onChange={(e) => setMemberUserId(e.target.value)} aria-label="Пользователь">
                          <option value="">Кого добавить</option>
                          {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
                        </select>
                        <select value={memberRole} onChange={(e) => setMemberRole(e.target.value)} aria-label="Роль в проекте">
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
                        {(user.role === "ADMIN" || user.role === "MANAGER") && m.userId !== user.id && (
                          <button type="button" className="ghost" onClick={() => removeMember(m.userId)}>Убрать</button>
                        )}
                      </div>
                    ))}
                  </div>
                </details>
              </section>

              <div className="board-region board-surface">
                <div className="board-header">
                  <div>
                    <h3>Канбан-доска</h3>
                    <p className="hint-line">Перетащите карточку между колонками или нажмите на неё, чтобы открыть детали.</p>
                  </div>
                  {(user.role === "ADMIN" || user.role === "MANAGER" || user.role === "EXECUTOR") && (
                    <button type="button" className="btn-primary-icon board-fab" onClick={() => setIsCreateTaskOpen(true)} title="Быстро добавить задачу на доску">
                      <PlusIcon />
                      <span className="board-fab-text">Задача</span>
                    </button>
                  )}
                </div>
                <section className="board">
                {STATUS_COLUMNS.map((status) => (
                  <div
                    key={status}
                    className={`column card${dragOverColumn === status ? " drag-over" : ""}`}
                    data-status={status}
                    onDragOver={(e) => { e.preventDefault(); setDragOverColumn(status); }}
                    onDrop={(e) => {
                      const id = Number(e.dataTransfer.getData("text/plain"));
                      if (id) onTaskDrop(id, status);
                      setDragOverColumn(null);
                    }}
                  >
                    <div className="column-head">
                      <h3>{STATUS_LABELS[status]}</h3>
                      <span>{(grouped[status] || []).length}</span>
                    </div>
                    <div className="column-drop-zone">
                    {(grouped[status] || []).map((task) => (
                      <div
                        key={task.id}
                        className="task"
                        draggable
                        data-priority={task.priority}
                        onDragStart={(e) => e.dataTransfer.setData("text/plain", String(task.id))}
                        onClick={() => setModalTask(task)}
                      >
                        <div className="task-title">{task.title}</div>
                        <div className="task-meta">
                          <span className="priority-pill">{PRIORITY_LABELS[task.priority] || task.priority}</span>
                        </div>
                        <div className="task-footer">
                          <span className="task-assignee">{task.assignee?.name || "Без исполнителя"}</span>
                          {task.dueDate && (
                            <span className="task-due">до {new Date(task.dueDate).toLocaleDateString("ru-RU")}</span>
                          )}
                        </div>
                        <div className="task-tags">
                          {(task.tags || []).map((t) => <span key={t.id} className="tag-pill" style={{ borderColor: t.tag.color }}>{t.tag.name}</span>)}
                        </div>
                      </div>
                    ))}
                    {(grouped[status] || []).length === 0 && <p className="empty-column">Перетащите сюда задачу или создайте новую</p>}
                    </div>
                  </div>
                ))}
                </section>
              </div>
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
