import { useEffect, useMemo, useState, useRef } from "react";
import { api, setNetworkErrorNotifier, setToken, API_BASE } from "./api";

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

function extractApiErrorMessage(err) {
  const data = err?.response?.data;
  if (typeof data?.message === "string") return data.message;
  if (typeof data === "string") return data;
  if (!err?.response && err?.message) return err.message;
  if (!err?.response) return "Сервер недоступен. Проверьте соединение и что backend запущен.";
  return "Запрос не выполнен";
}

function parseWorkspaceQuery() {
  if (typeof window === "undefined") return { projectId: null, taskId: null };
  const u = new URL(window.location.href);
  const project = Number(u.searchParams.get("project"));
  const task = Number(u.searchParams.get("task"));
  return {
    projectId: Number.isFinite(project) && project > 0 ? project : null,
    taskId: Number.isFinite(task) && task > 0 ? task : null,
  };
}

/** Синхронизирует ?project=&task= с текущим экраном (без новой записи в истории браузера). */
function replaceWorkspaceLocation(projectId, taskId, taskProjectId = null) {
  if (typeof window === "undefined") return;
  const u = new URL(window.location.href);
  if (projectId != null && projectId !== "") {
    u.searchParams.set("project", String(projectId));
  } else {
    u.searchParams.delete("project");
  }
  const showTask = taskId != null && taskId !== "" && (taskProjectId == null || Number(taskProjectId) === Number(projectId));
  if (showTask) u.searchParams.set("task", String(taskId));
  else u.searchParams.delete("task");
  window.history.replaceState({}, "", `${u.pathname}${u.search}`);
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

const PanelLeftIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M10 4v16" />
  </svg>
);

const PanelOpenIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M10 4v16M16 9l2 3-2 3" />
  </svg>
);

const LinkIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <path d="M10 13a5 5 0 0 1 7-7l2 2a5 5 0 0 1-7 7" />
    <path d="M14 11a5 5 0 0 0-7-7l-2 2a5 5 0 0 0 7 7" />
  </svg>
);

function WorkspaceSkeleton() {
  return (
    <div className="workspace-skeleton" aria-busy="true" aria-label="Загрузка сводки и фильтров">
      <div className="sk-pills-row">
        {[1, 2, 3, 4, 5, 6].map((k) => (
          <span key={k} className="sk-pill" />
        ))}
      </div>
      <div className="sk-search-card">
        <span className="sk-line sk-line-wide" />
        <div className="sk-chips-row">
          {[1, 2, 3, 4, 5].map((k) => (
            <span key={k} className="sk-chip" />
          ))}
        </div>
      </div>
      <span className="sk-line sk-line-mid" />
      <span className="sk-line sk-line-short" />
    </div>
  );
}

function BoardSkeleton() {
  return (
    <div className="board-region board-surface board-skeleton-wrap" aria-hidden>
      <div className="sk-board-toolbar" />
      <div className="board board-skeleton-cols">
        {[0, 1, 2, 3].map((col) => (
          <div key={col} className="column card sk-column">
            <div className="sk-col-head" />
            <span className="sk-card-bar" />
            <span className="sk-card-bar sk-card-bar-short" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ConfirmModal({ config, onClose, notifyError }) {
  const [busy, setBusy] = useState(false);
  const cancelRef = useRef(null);

  useEffect(() => {
    if (!config) return undefined;
    cancelRef.current?.focus();
    function onDocKey(e) {
      if (e.key === "Escape" && !busy) {
        onClose();
      }
    }
    document.addEventListener("keydown", onDocKey);
    return () => document.removeEventListener("keydown", onDocKey);
  }, [config, busy, onClose]);

  if (!config) return null;

  async function confirm() {
    setBusy(true);
    try {
      await config.action();
      onClose();
    } catch (err) {
      notifyError?.(extractApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={`modal-overlay confirm-overlay${config.danger ? " confirm-overlay--danger" : ""}`}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        className="confirm-dialog card"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby={config.description ? "confirm-dialog-desc" : undefined}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-dialog-title" className="confirm-dialog-title">
          {config.title}
        </h2>
        {config.description ? (
          <p id="confirm-dialog-desc" className="confirm-dialog-desc">
            {config.description}
          </p>
        ) : null}
        <div className="confirm-dialog-actions">
          <button ref={cancelRef} type="button" className="ghost" disabled={busy} onClick={() => !busy && onClose()}>
            {config.cancelText || "Отмена"}
          </button>
          <button type="button" className={config.danger ? "danger" : undefined} disabled={busy} onClick={() => confirm()}>
            {busy ? "Подождите…" : config.confirmText || "Продолжить"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TaskModal({
  task,
  users,
  tags,
  initialStatus,
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
  taskPermalink,
  onPermalinkCopied,
  suppressEscape = false,
}) {
  const modalRef = useRef(null);
  const [form, setForm] = useState({
    title: task?.title || "",
    description: task?.description || "",
    priority: task?.priority || "MEDIUM",
    status: task?.status || initialStatus || "TODO",
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
      if (e.key === "Escape" && !suppressEscape) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, suppressEscape]);

  useEffect(() => {
    const root = modalRef.current;
    if (!root) return undefined;
    const sel = "#task-title, button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])";
    queueMicrotask(() => {
      const first = root.querySelector(sel);
      first?.focus({ preventScroll: true });
    });
    function trapTab(e) {
      if (e.key !== "Tab") return;
      const elems = [...root.querySelectorAll("button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])")];
      if (elems.length === 0) return;
      const first = elems[0];
      const last = elems[elems.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    root.addEventListener("keydown", trapTab);
    return () => root.removeEventListener("keydown", trapTab);
  }, [task?.id, isEdit]);

  function toggleTag(tagId) {
    setForm((prev) => ({
      ...prev,
      tagIds: prev.tagIds.includes(tagId) ? prev.tagIds.filter((id) => id !== tagId) : [...prev.tagIds, tagId],
    }));
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        ref={modalRef}
        className="modal modal-task"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-modal-title"
      >
        <div className="modal-task-header">
          <div className="modal-task-header-inner">
          <div>
            <div className="modal-task-heading-row">
              <p className="modal-task-kicker">{isEdit ? "Редактирование" : "Создание"}</p>
              {isEdit && (
                <span className="modal-status-badge" data-status={form.status}>
                  {STATUS_LABELS[form.status] || form.status}
                </span>
              )}
            </div>
            <h3 id="task-modal-title">{isEdit ? (form.title.trim() || "Задача") : "Новая задача"}</h3>
            <p className="modal-task-lead">
              {isEdit
                ? "Сначала сохраните поля карточки. Чек-лист, переписка и файлы — во вкладках ниже."
                : "Заполните основное и нажмите «Создать». Остальное добавите после сохранения."}
            </p>
          </div>
          <div className="modal-task-header-actions">
            {isEdit && taskPermalink ? (
              <button
                type="button"
                className="ghost modal-permalink-btn"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(taskPermalink);
                    onPermalinkCopied?.();
                  } catch {
                    onPermalinkCopied?.("Не удалось скопировать ссылку", "error");
                  }
                }}
                title={taskPermalink}
              >
                <LinkIcon />
                <span>Копировать ссылку</span>
              </button>
            ) : null}
            <button type="button" className="modal-task-close" aria-label="Закрыть" onClick={onClose}>
              <CloseIcon />
            </button>
          </div>
          </div>
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
                <select
                  id="task-assignee"
                  value={form.assigneeId === "" || form.assigneeId == null ? "" : String(form.assigneeId)}
                  onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}
                  title={form.assigneeId ? (users.find((u) => String(u.id) === String(form.assigneeId))?.name ?? "") : ""}
                >
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
                onClick={() => {
                  let assigneeId = null;
                  const raw = form.assigneeId;
                  if (raw !== "" && raw != null) {
                    const n = Number(raw);
                    assigneeId = Number.isFinite(n) && n > 0 ? n : null;
                  }
                  onSave({
                    ...form,
                    assigneeId,
                    dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null,
                  });
                }}
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
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [draggingTaskId, setDraggingTaskId] = useState(null);
  const [createTaskDefaults, setCreateTaskDefaults] = useState(null);
  const [debouncedTaskQ, setDebouncedTaskQ] = useState("");
  const [confirmDialog, setConfirmDialog] = useState(null);
  const notifRef = useRef(null);
  const toastTimerRef = useRef(null);
  const prevProjectIdRef = useRef(null);
  const workspaceBootstrapRef = useRef(false);
  const deepLinkTaskKeyRef = useRef("");
  function pushToast(message, variant = "success") {
    setToast({ message, variant });
  }
  const pushToastRef = useRef(pushToast);
  pushToastRef.current = pushToast;

  useEffect(() => {
    if (!toast?.message) return;
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 3800);
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, [toast]);

  useEffect(() => setToken(token), [token]);

  useEffect(() => {
    if (!token) {
      setNetworkErrorNotifier(null);
      return undefined;
    }
    setNetworkErrorNotifier((message, variant = "error") => pushToastRef.current(message, variant));
    return () => setNetworkErrorNotifier(null);
  }, [token]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedTaskQ(filters.q.trim()), 380);
    return () => clearTimeout(timer);
  }, [filters.q]);

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

  useEffect(() => {
    if (!token) {
      workspaceBootstrapRef.current = false;
      deepLinkTaskKeyRef.current = "";
      return undefined;
    }
    return undefined;
  }, [token]);

  /** Закрываем модалку задачи при переключении проекта — карточка относится к другому контексту. */
  useEffect(() => {
    setModalTask((prev) => (prev && selectedProject && prev.projectId !== undefined && prev.projectId !== selectedProject.id ? null : prev));
  }, [selectedProject?.id]);

  useEffect(() => {
    deepLinkTaskKeyRef.current = "";
  }, [selectedProject?.id]);

  /** Прямые ссылки вида ?project=&task=. */
  useEffect(() => {
    if (!token || typeof window === "undefined") return undefined;
    const pid = selectedProject?.id ?? null;
    const tid =
      modalTask && selectedProject?.id === modalTask.projectId ? modalTask.id : null;
    replaceWorkspaceLocation(pid, tid, modalTask?.projectId ?? selectedProject?.id);
    return undefined;
  }, [token, selectedProject?.id, modalTask?.id, modalTask?.projectId]);

  useEffect(() => {
    let cancelled = false;
    async function openFromUrl() {
      if (!token || !selectedProject || workspaceLoading || typeof window === "undefined") return;
      const { taskId } = parseWorkspaceQuery();
      if (!taskId) {
        deepLinkTaskKeyRef.current = "";
        return;
      }
      const pendingMark = `${selectedProject.id}:${taskId}:pending`;
      const doneMark = `${selectedProject.id}:${taskId}:done`;
      const local = tasks.find((t) => t.id === taskId);
      if (local && local.projectId === selectedProject.id) {
        deepLinkTaskKeyRef.current = doneMark;
        setModalTask((cur) => (cur?.id === local.id ? cur : local));
        return;
      }

      if (deepLinkTaskKeyRef.current === doneMark || deepLinkTaskKeyRef.current === pendingMark) return;
      deepLinkTaskKeyRef.current = pendingMark;

      try {
        const { data } = await api.get(`/tasks/${taskId}`);
        if (cancelled) return;
        if (!projects.some((p) => p.id === data.projectId)) {
          pushToast("Нет доступа к задаче из ссылки", "error");
          replaceWorkspaceLocation(selectedProject.id, null);
          deepLinkTaskKeyRef.current = "";
          return;
        }
        const proj = projects.find((p) => p.id === data.projectId);
        if (proj && proj.id !== selectedProject.id) {
          deepLinkTaskKeyRef.current = "";
          setSelectedProject(proj);
        }
        setModalTask(data);
        deepLinkTaskKeyRef.current = doneMark;
      } catch (e) {
        if (!cancelled) {
          pushToast(extractApiErrorMessage(e), "error");
          if (selectedProject?.id != null) replaceWorkspaceLocation(selectedProject.id, null);
          deepLinkTaskKeyRef.current = "";
        }
      }
    }
    openFromUrl();
    return () => {
      cancelled = true;
    };
  }, [token, selectedProject?.id, workspaceLoading, tasks, projects]);

  async function loadProjects() {
    const { data } = await api.get("/projects");
    setProjects(data);
    setSelectedProject((cur) => {
      if (!data.length) return null;
      if (!workspaceBootstrapRef.current) {
        workspaceBootstrapRef.current = true;
        const { projectId: urlPid } = parseWorkspaceQuery();
        if (urlPid) {
          const hit = data.find((p) => p.id === urlPid);
          if (hit) return hit;
        }
      }
      if (cur && data.some((p) => p.id === cur.id)) return data.find((p) => p.id === cur.id);
      return data[0] ?? null;
    });
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
    if (!projectId) return;
    const params = {};
    if (debouncedTaskQ) params.q = debouncedTaskQ;
    if (filters.status) params.status = filters.status;
    if (filters.priority) params.priority = filters.priority;
    if (filters.assigneeId) params.assigneeId = Number(filters.assigneeId);
    if (filters.overdue) params.overdue = true;
    const [tasksRes, statsRes] = await Promise.all([api.get(`/projects/${projectId}/tasks`, { params }), api.get(`/dashboard/${projectId}`)]);
    let result = tasksRes.data;
    if (filters.tagId) {
      const tagId = Number(filters.tagId);
      result = result.filter((taskItem) => (taskItem.tags || []).some((t) => t.tagId === tagId));
    }
    setTasks(result);
    setStats(statsRes.data);
  }

  useEffect(() => { if (!token) return; loadProjects(); loadUsers(); }, [token]);
  useEffect(() => {
    if (!token || !selectedProject) return;
    const pid = selectedProject.id;
    let cancelled = false;
    (async () => {
      const switched = prevProjectIdRef.current !== pid;
      if (switched) prevProjectIdRef.current = pid;
      setWorkspaceLoading(true);
      try {
        if (switched) {
          setTasks([]);
          setStats(null);
          await Promise.all([loadTags(pid), loadMembers(pid)]);
        }
        await loadProjectData(pid);
      } finally {
        if (!cancelled) setWorkspaceLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, selectedProject?.id, debouncedTaskQ, filters.status, filters.priority, filters.assigneeId, filters.overdue, filters.tagId]);
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
    workspaceBootstrapRef.current = false;
    deepLinkTaskKeyRef.current = "";
    prevProjectIdRef.current = null;
    setTokenState(null);
    setUser(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    if (typeof window !== "undefined") {
      replaceWorkspaceLocation(null, null);
    }
  }

  async function createProject(e) {
    e.preventDefault();
    if (!newProjectTitle.trim()) return;
    await api.post("/projects", { title: newProjectTitle, description: newProjectDesc });
    setNewProjectTitle("");
    setNewProjectDesc("");
    await loadProjects();
    pushToast("Проект создан");
  }
  function openDeleteProjectDialog() {
    const p = selectedProject;
    if (!p) return;
    setConfirmDialog({
      title: `Удалить проект «${p.title}»?`,
      description:
        "Будут удалены все задачи, комментарии, вложения по этому проекту и сам проект. Отменить действие нельзя.",
      danger: true,
      confirmText: "Удалить навсегда",
      cancelText: "Отмена",
      action: async () => {
        await api.delete(`/projects/${p.id}`);
        const { data } = await api.get("/projects");
        setProjects(data);
        setSelectedProject(data.length ? data[0] : null);
        setTasks([]);
        setStats(null);
        setModalTask(null);
        pushToast("Проект удалён");
      },
    });
  }

  function openArchiveProjectDialog() {
    const p = selectedProject;
    if (!p) return;
    setConfirmDialog({
      title: `Архивировать проект «${p.title}»?`,
      description: "Проект будет скрыт из списка активных. По политике организации восстановление может выполнять администратор.",
      confirmText: "В архив",
      cancelText: "Отмена",
      action: async () => {
        await api.post(`/projects/${p.id}/archive`);
        const { data } = await api.get("/projects");
        setProjects(data);
        setSelectedProject(data.length ? data[0] : null);
        pushToast("Проект отправлен в архив");
      },
    });
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
  function askRemoveMember(m) {
    if (!selectedProject) return;
    setConfirmDialog({
      title: "Убрать участника из проекта?",
      description: `${m.user.name} больше не увидит этот проект в списке.`,
      danger: false,
      confirmText: "Убрать",
      cancelText: "Отмена",
      action: async () => {
        await api.delete(`/projects/${selectedProject.id}/members/${m.userId}`);
        await loadMembers(selectedProject.id);
        pushToast("Участник исключён из проекта");
      },
    });
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
      pushToast(existingTask ? "Изменения сохранены" : "Задача добавлена на доску");
    } catch (err) {
      if (err.response) {
        pushToast(err.response.data?.message || "Не удалось сохранить задачу", "error");
      }
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
    const snapshot = tasks.map((x) => ({ ...x }));
    setTasks((list) => list.map((t) => (t.id === taskId ? { ...t, status } : t)));
    try {
      await api.put(`/tasks/${taskId}`, { status });
      await loadProjectData(selectedProject.id);
    } catch (err) {
      setTasks(snapshot);
      if (err.response) pushToast(err.response.data?.message || "Не удалось переместить карточку", "error");
      else pushToast(extractApiErrorMessage(err), "error");
      await loadProjectData(selectedProject.id);
    }
  }
  function openArchiveTaskDialog(taskId) {
    setConfirmDialog({
      title: "Отправить задачу в архив?",
      description: "Карточка исчезнет с канбана активных задач.",
      confirmText: "В архив",
      cancelText: "Отмена",
      action: async () => {
        await api.post(`/tasks/${taskId}/archive`);
        await loadProjectData(selectedProject.id);
        setModalTask(null);
        pushToast("Задача в архиве");
      },
    });
  }
  async function uploadAttachment(taskId, file) {
    try {
      const formData = new FormData();
      formData.append("file", file);
      await api.post(`/tasks/${taskId}/attachments`, formData);
      const { data } = await api.get(`/projects/${selectedProject.id}/tasks`);
      setTasks(data);
      setModalTask(data.find((t) => t.id === taskId));
      pushToast("Файл прикреплён");
    } catch (err) {
      if (err.response) {
        pushToast(err.response.data?.message || "Не удалось загрузить файл", "error");
      }
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
    pushToast("CSV файл сформирован");
  }
  async function markNotificationRead(id) {
    await api.put(`/notifications/${id}/read`);
    await loadNotifications();
  }

  async function markAllNotificationsRead() {
    try {
      await api.post("/notifications/read-all");
      await loadNotifications();
      pushToast("Все уведомления помечены прочитанными");
    } catch (err) {
      pushToast(extractApiErrorMessage(err), "error");
    }
  }
  function resetFilters() {
    setFilters({ q: "", status: "", priority: "", assigneeId: "", overdue: false, tagId: "" });
  }

  const taskShareUrl = useMemo(() => {
    if (!modalTask?.id || !selectedProject?.id) return "";
    if (modalTask.projectId !== selectedProject.id) return "";
    if (typeof window === "undefined") return "";
    return `${window.location.origin}${window.location.pathname}?project=${selectedProject.id}&task=${modalTask.id}`;
  }, [modalTask?.id, modalTask?.projectId, selectedProject?.id]);

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

  const showOverviewSkeleton = workspaceLoading && stats === null;
  const showBoardSkeleton = workspaceLoading && stats === null;

  if (!token || !user) return <AuthForm onAuth={onAuth} />;

  return (
    <div className="app app-logged">
      <a href="#main-workspace" className="skip-link">
        Перейти к содержимому
      </a>
      <div className="topbar-shell">
        <header className="topbar">
          <div className="topbar-leading">
            {sidebarHidden && (
              <button
                type="button"
                className="ghost topbar-open-sidebar"
                onClick={() => setSidebarHidden(false)}
                aria-label="Показать панель проектов"
              >
                <PanelOpenIcon />
                <span>Проекты</span>
              </button>
            )}
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
                  <div className="notifications-dropdown-head">
                    <h4>Уведомления</h4>
                    {notifications.some((n) => !n.read) ? (
                      <button type="button" className="ghost notifications-read-all" onClick={() => markAllNotificationsRead()}>
                        Прочитать всё
                      </button>
                    ) : null}
                  </div>
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
      <div className={`layout${sidebarHidden ? " layout-sidebar-hidden" : ""}`}>
        {!sidebarHidden && (
        <aside className="sidebar card">
          <div className="sidebar-head-row">
            <div className="sidebar-section-title">
              <h3>Ваши проекты</h3>
            </div>
            <button type="button" className="icon-btn ghost sidebar-hide-btn" onClick={() => setSidebarHidden(true)} aria-label="Скрыть панель проектов" title="Скрыть панель проектов">
              <PanelLeftIcon />
            </button>
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
        )}
        <main id="main-workspace" className="main" tabIndex={-1}>
          {!selectedProject && projects.length > 0 && (
            <div className="empty-workspace card">
              <h2>Выберите проект слева</h2>
              <p>Он откроет статистику, фильтры и канбан-доску.</p>
            </div>
          )}
          {projects.length === 0 && (
            <div className="empty-workspace empty-workspace--start card">
              <h2>Начните с первого проекта</h2>
              <p className="empty-workspace-lead">Ниже — три шага, чтобы появился канбан и задачи для команды.</p>
              <ol className="empty-steps">
                <li>В боковой панели введите название и описание.</li>
                <li>Нажмите «Создать проект».</li>
                <li>Добавьте задачи и распределите по колонкам.</li>
              </ol>
              {(user.role === "EXECUTOR" || user.role === "VIEWER") && (
                <p className="section-hint">Нужны права менеджера или администратора — они создают проекты для команды.</p>
              )}
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
                      <button
                        type="button"
                        className="btn-primary-icon"
                        onClick={() => {
                          setCreateTaskDefaults(null);
                          setIsCreateTaskOpen(true);
                        }}
                      >
                        <PlusIcon />
                        Новая задача
                      </button>
                    )}
                    {(user.role === "ADMIN" || user.role === "MANAGER") && (
                      <button type="button" className="ghost" onClick={exportReport}>Скачать CSV</button>
                    )}
                    {(user.role === "ADMIN" || user.role === "MANAGER") && (
                      <button type="button" className="ghost danger" onClick={openArchiveProjectDialog}>В архив</button>
                    )}
                    {(user.role === "ADMIN" || user.role === "MANAGER") && (
                      <button type="button" className="ghost danger" onClick={openDeleteProjectDialog}>Удалить проект</button>
                    )}
                  </div>
                </div>

                {stats && stats.total === 0 && !workspaceLoading && (
                  <div className="project-zero-banner" aria-label="Подсказка для пустого проекта">
                    <div className="project-zero-banner-text">
                      <strong>Пока нет ни одной задачи</strong>
                      <span>Создайте первую карточку — она появится в колонке «К выполнению», затем её можно двигать по доске.</span>
                    </div>
                    {(user.role === "ADMIN" || user.role === "MANAGER" || user.role === "EXECUTOR") && (
                      <button
                        type="button"
                        className="btn-primary-icon project-zero-banner-cta"
                        onClick={() => {
                          setCreateTaskDefaults({ status: "TODO" });
                          setIsCreateTaskOpen(true);
                        }}
                      >
                        <PlusIcon />
                        Первая задача
                      </button>
                    )}
                  </div>
                )}
                {showOverviewSkeleton ? (
                  <WorkspaceSkeleton />
                ) : (
                  <>
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
                  </>
                )}

                {!showOverviewSkeleton && (
                <>
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
                            <button type="button" className="ghost" onClick={() => askRemoveMember(m)}>Убрать</button>
                          )}
                        </div>
                      ))}
                    </div>
                  </details>

                  <details className="help-sheet">
                    <summary>Краткая справка по интерфейсу</summary>
                    <ul className="help-sheet-list">
                      <li>Карточки перетаскивайте между колонками — статус сохранится автоматически.</li>
                      <li>В карточке задачи сохраните поля сверху, затем пользуйтесь вкладками: чек-лист, обсуждение, время, файлы.</li>
                      <li>Поиск по задачам применится через доли секунды после ввода; сброс — кнопка «Сбросить» над чипами.</li>
                      <li>Раздел ниже задаёт фильтры, теги и состав команды проекта по ролям.</li>
                      <li>Откройте задачу по ссылке: в адресной строке сохранятся параметры «проект» и «задача»; кнопка «Копировать ссылку» в шапке карточки кладёт её в буфер.</li>
                    </ul>
                  </details>
                </>
                )}
              </section>

              {showBoardSkeleton ? (
                <BoardSkeleton />
              ) : (
              <div className="board-region board-surface">
                <div className="board-header">
                  <div>
                    <h3>Канбан-доска</h3>
                    <p className="hint-line">Перетащите карточку между колонками или нажмите на неё, чтобы открыть детали.</p>
                  </div>
                  {(user.role === "ADMIN" || user.role === "MANAGER" || user.role === "EXECUTOR") && (
                    <button
                      type="button"
                      className="btn-primary-icon board-fab"
                      onClick={() => {
                        setCreateTaskDefaults(null);
                        setIsCreateTaskOpen(true);
                      }}
                      title="Быстро добавить задачу на доску"
                    >
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
                        className={`task${draggingTaskId === task.id ? " task--dragging" : ""}`}
                        draggable
                        data-priority={task.priority}
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/plain", String(task.id));
                          e.dataTransfer.effectAllowed = "move";
                          setDraggingTaskId(task.id);
                        }}
                        onDragEnd={() => setDraggingTaskId(null)}
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
                    {(grouped[status] || []).length === 0 && (
                      <div className="empty-column-slot">
                        <p className="empty-column-title">Нет задач</p>
                        <p className="empty-column-hint">Перетащите сюда карточку с другой колонки или создайте задачу.</p>
                        {(user.role === "ADMIN" || user.role === "MANAGER" || user.role === "EXECUTOR") && (
                          <button
                            type="button"
                            className="ghost empty-column-action"
                            onClick={() => {
                              setCreateTaskDefaults({ status });
                              setIsCreateTaskOpen(true);
                            }}
                          >
                            + В этой колонке
                          </button>
                        )}
                      </div>
                    )}
                    </div>
                  </div>
                ))}
                </section>
              </div>
              )}
            </>
          )}
        </main>
      </div>

      {isCreateTaskOpen && (
        <TaskModal
          key={createTaskDefaults?.status ? `new-${createTaskDefaults.status}` : "new-task"}
          suppressEscape={!!confirmDialog}
          initialStatus={createTaskDefaults?.status}
          users={users}
          tags={tags}
          onClose={() => {
            setIsCreateTaskOpen(false);
            setCreateTaskDefaults(null);
          }}
          onSave={(payload) => saveTask(payload, null)}
        />
      )}
      {modalTask && (
        <TaskModal
          suppressEscape={!!confirmDialog}
          task={modalTask}
          users={users}
          tags={tags}
          taskPermalink={taskShareUrl || undefined}
          onPermalinkCopied={(msg, variant) => pushToast(msg ?? "Ссылка скопирована", variant ?? "success")}
          onClose={() => setModalTask(null)}
          onSave={(payload) => saveTask(payload, modalTask)}
          onComment={(text) => addComment(modalTask.id, text)}
          onTimeLog={(payload) => addTimeLog(modalTask.id, payload)}
          onChecklistAdd={(text) => addChecklist(modalTask.id, text)}
          onChecklistToggle={(itemId, done) => toggleChecklist(itemId, done, modalTask.id)}
          onChecklistDelete={(itemId) => deleteChecklist(itemId, modalTask.id)}
          onAttachmentUpload={(file) => uploadAttachment(modalTask.id, file)}
          onAttachmentDelete={(attachmentId) => deleteAttachment(modalTask.id, attachmentId)}
          onArchiveTask={() => openArchiveTaskDialog(modalTask.id)}
        />
      )}

      {confirmDialog && (
        <ConfirmModal
          config={confirmDialog}
          onClose={() => setConfirmDialog(null)}
          notifyError={(message) => pushToast(message, "error")}
        />
      )}

      <div className="toast-host" aria-live="polite">
        {toast?.message && (
          <div className={`toast-item toast-item--${toast.variant || "success"}`} role="status">
            {toast.message}
          </div>
        )}
      </div>
    </div>
  );
}
