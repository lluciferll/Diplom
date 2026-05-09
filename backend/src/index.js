const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { PrismaClient, Role, TaskStatus, Priority, ProjectMemberRole } = require("@prisma/client");
const { z } = require("zod");

dotenv.config();

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

const PORT = Number(process.env.PORT || 4000);
const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key";

function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: "8h" });
}

function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Unauthorized" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}

function allowRoles(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };
}

async function isProjectMember(userId, projectId) {
  return prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
}

function roleRank(role) {
  return {
    [ProjectMemberRole.VIEWER]: 1,
    [ProjectMemberRole.MEMBER]: 2,
    [ProjectMemberRole.MANAGER]: 3,
    [ProjectMemberRole.OWNER]: 4,
  }[role] || 0;
}

async function requireProjectRole(req, res, projectId, minRole = ProjectMemberRole.VIEWER) {
  if (req.user.role === Role.ADMIN) return true;
  const membership = await isProjectMember(req.user.id, projectId);
  if (!membership) {
    res.status(403).json({ message: "Нет доступа к проекту" });
    return false;
  }
  if (roleRank(membership.role) < roleRank(minRole)) {
    res.status(403).json({ message: "Недостаточно прав в проекте" });
    return false;
  }
  return true;
}

async function addHistory(taskId, authorId, action, details) {
  await prisma.taskHistory.create({
    data: {
      taskId,
      authorId,
      action,
      details: details ? JSON.stringify(details) : null,
    },
  });
}

async function notifyUser(userId, title, message, taskId) {
  await prisma.notification.create({
    data: { userId, title, message, taskId },
  });
}

const uploadsDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (_req, file, cb) => {
      const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}-${file.originalname.replace(/\s+/g, "_")}`;
      cb(null, safeName);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
});

app.get("/health", (_req, res) => res.json({ ok: true }));

app.post("/auth/register", async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    name: z.string().min(2),
    password: z.string().min(6),
    role: z.nativeEnum(Role).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  const { email, name, password, role } = parsed.data;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ message: "Email already exists" });
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, name, passwordHash, role: role || Role.EXECUTOR },
  });
  const token = signToken(user);
  res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});

app.post("/auth/login", async (req, res) => {
  const schema = z.object({ email: z.string().email(), password: z.string().min(6) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ message: "Invalid credentials" });
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ message: "Invalid credentials" });
  const token = signToken(user);
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});

app.get("/auth/me", auth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json({ id: user.id, email: user.email, name: user.name, role: user.role });
});

app.get("/users", auth, allowRoles(Role.ADMIN, Role.MANAGER), async (_req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, createdAt: true },
    orderBy: { id: "asc" },
  });
  res.json(users);
});

app.get("/projects", auth, async (req, res) => {
  const projects = await prisma.project.findMany({
    where: {
      archivedAt: null,
      OR: [{ createdById: req.user.id }, { members: { some: { userId: req.user.id } } }],
    },
    include: {
      members: { include: { user: { select: { id: true, name: true, email: true, role: true } } }, orderBy: { createdAt: "asc" } },
    },
    orderBy: { updatedAt: "desc" },
  });
  res.json(projects);
});

app.post("/projects", auth, allowRoles(Role.ADMIN, Role.MANAGER), async (req, res) => {
  const schema = z.object({ title: z.string().min(2), description: z.string().optional(), memberIds: z.array(z.number()).optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const { title, description, memberIds = [] } = parsed.data;
  const uniqueMemberIds = [...new Set([req.user.id, ...memberIds])];

  const project = await prisma.project.create({
    data: {
      title,
      description,
      createdById: req.user.id,
      members: {
        create: uniqueMemberIds.map((userId) => ({
          userId,
          role: userId === req.user.id ? ProjectMemberRole.OWNER : ProjectMemberRole.MEMBER,
        })),
      },
    },
    include: { members: true },
  });
  res.status(201).json(project);
});

app.put("/projects/:id", auth, allowRoles(Role.ADMIN, Role.MANAGER), async (req, res) => {
  const id = Number(req.params.id);
  const allowed = await requireProjectRole(req, res, id, ProjectMemberRole.MANAGER);
  if (!allowed) return;
  const schema = z.object({ title: z.string().min(2), description: z.string().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const project = await prisma.project.update({ where: { id }, data: parsed.data });
  res.json(project);
});

app.post("/projects/:id/archive", auth, allowRoles(Role.ADMIN, Role.MANAGER), async (req, res) => {
  const id = Number(req.params.id);
  const allowed = await requireProjectRole(req, res, id, ProjectMemberRole.MANAGER);
  if (!allowed) return;
  await prisma.project.update({ where: { id }, data: { archivedAt: new Date() } });
  res.status(204).send();
});

app.delete("/projects/:id", auth, allowRoles(Role.ADMIN, Role.MANAGER), async (req, res) => {
  const id = Number(req.params.id);
  // MANAGER и OWNER в проекте — как в UI «удалить проект» у глобального менеджера
  const allowed = await requireProjectRole(req, res, id, ProjectMemberRole.MANAGER);
  if (!allowed) return;
  await prisma.project.delete({ where: { id } });
  res.status(204).send();
});

app.get("/projects/:id/members", auth, async (req, res) => {
  const projectId = Number(req.params.id);
  const allowed = await requireProjectRole(req, res, projectId, ProjectMemberRole.VIEWER);
  if (!allowed) return;
  const members = await prisma.projectMember.findMany({
    where: { projectId },
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
    orderBy: { createdAt: "asc" },
  });
  res.json(members);
});

app.post("/projects/:id/members", auth, allowRoles(Role.ADMIN, Role.MANAGER), async (req, res) => {
  const projectId = Number(req.params.id);
  const allowed = await requireProjectRole(req, res, projectId, ProjectMemberRole.MANAGER);
  if (!allowed) return;
  const schema = z.object({ userId: z.number(), role: z.nativeEnum(ProjectMemberRole).optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const member = await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId, userId: parsed.data.userId } },
    update: { role: parsed.data.role || ProjectMemberRole.MEMBER },
    create: {
      projectId,
      userId: parsed.data.userId,
      role: parsed.data.role || ProjectMemberRole.MEMBER,
    },
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
  });
  res.status(201).json(member);
});

app.put("/projects/:id/members/:userId", auth, allowRoles(Role.ADMIN, Role.MANAGER), async (req, res) => {
  const projectId = Number(req.params.id);
  const userId = Number(req.params.userId);
  const allowed = await requireProjectRole(req, res, projectId, ProjectMemberRole.MANAGER);
  if (!allowed) return;
  const schema = z.object({ role: z.nativeEnum(ProjectMemberRole) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const member = await prisma.projectMember.update({
    where: { projectId_userId: { projectId, userId } },
    data: { role: parsed.data.role },
  });
  res.json(member);
});

app.delete("/projects/:id/members/:userId", auth, allowRoles(Role.ADMIN, Role.MANAGER), async (req, res) => {
  const projectId = Number(req.params.id);
  const userId = Number(req.params.userId);
  const allowed = await requireProjectRole(req, res, projectId, ProjectMemberRole.MANAGER);
  if (!allowed) return;
  await prisma.projectMember.delete({ where: { projectId_userId: { projectId, userId } } });
  res.status(204).send();
});

app.get("/projects/:id/tasks", auth, async (req, res) => {
  const projectId = Number(req.params.id);
  const status = req.query.status ? String(req.query.status) : undefined;
  const priority = req.query.priority ? String(req.query.priority) : undefined;
  const assigneeId = req.query.assigneeId ? Number(req.query.assigneeId) : undefined;
  const q = req.query.q ? String(req.query.q).trim() : "";
  const overdue = req.query.overdue === "true";
  const allowed = await requireProjectRole(req, res, projectId, ProjectMemberRole.VIEWER);
  if (!allowed) return;
  const where = {
    projectId,
    archivedAt: null,
    ...(status ? { status } : {}),
    ...(priority ? { priority } : {}),
    ...(Number.isFinite(assigneeId) ? { assigneeId } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(overdue ? { dueDate: { lt: new Date() }, status: { not: TaskStatus.DONE } } : {}),
  };
  const tasks = await prisma.task.findMany({
    where,
    include: {
      assignee: { select: { id: true, name: true, email: true, role: true } },
      comments: { include: { author: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" } },
      timeLogs: true,
      checklist: { orderBy: { createdAt: "asc" } },
      tags: { include: { tag: true } },
      attachments: true,
      history: { orderBy: { createdAt: "desc" }, take: 20 },
    },
    orderBy: { createdAt: "asc" },
  });
  res.json(tasks);
});

app.get("/projects/:id/tags", auth, async (req, res) => {
  const projectId = Number(req.params.id);
  const allowed = await requireProjectRole(req, res, projectId, ProjectMemberRole.VIEWER);
  if (!allowed) return;
  const tags = await prisma.tag.findMany({ where: { projectId }, orderBy: { name: "asc" } });
  res.json(tags);
});

app.post("/projects/:id/tags", auth, allowRoles(Role.ADMIN, Role.MANAGER, Role.EXECUTOR), async (req, res) => {
  const projectId = Number(req.params.id);
  const allowed = await requireProjectRole(req, res, projectId, ProjectMemberRole.MEMBER);
  if (!allowed) return;
  const schema = z.object({
    name: z.string().min(1).max(30),
    color: z.string().regex(/^#([0-9a-fA-F]{6})$/).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const tag = await prisma.tag.create({
    data: { projectId, name: parsed.data.name.trim(), color: parsed.data.color || "#2563eb" },
  });
  res.status(201).json(tag);
});

app.post("/tasks", auth, allowRoles(Role.ADMIN, Role.MANAGER, Role.EXECUTOR), async (req, res) => {
  const schema = z.object({
    title: z.string().min(2),
    description: z.string().optional(),
    projectId: z.number(),
    assigneeId: z.number().optional(),
    dueDate: z.string().datetime().optional(),
    priority: z.nativeEnum(Priority).optional(),
    status: z.nativeEnum(TaskStatus).optional(),
    tagIds: z.array(z.number()).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const payload = parsed.data;
  const allowed = await requireProjectRole(req, res, payload.projectId, ProjectMemberRole.MEMBER);
  if (!allowed) return;
  const task = await prisma.task.create({
    data: {
      title: payload.title,
      description: payload.description,
      projectId: payload.projectId,
      ...(payload.assigneeId ? { assignee: { connect: { id: payload.assigneeId } } } : {}),
      dueDate: payload.dueDate ? new Date(payload.dueDate) : null,
      priority: payload.priority || Priority.MEDIUM,
      status: payload.status || TaskStatus.TODO,
      createdById: req.user.id,
    },
    include: { checklist: true, tags: { include: { tag: true } }, attachments: true, history: true, assignee: true },
  });
  if (payload.tagIds) {
    await prisma.taskTag.deleteMany({ where: { taskId: task.id } });
    if (payload.tagIds.length) {
      await prisma.taskTag.createMany({
        data: payload.tagIds.map((tagId) => ({ taskId: task.id, tagId })),
        skipDuplicates: true,
      });
    }
  }
  const taskWithExtras = await prisma.task.findUnique({
    where: { id: task.id },
    include: {
      assignee: { select: { id: true, name: true, email: true, role: true } },
      comments: { include: { author: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" } },
      timeLogs: true,
      checklist: { orderBy: { createdAt: "asc" } },
      tags: { include: { tag: true } },
      attachments: true,
      history: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  await addHistory(task.id, req.user.id, "TASK_CREATED", { title: task.title });
  if (task.assigneeId && task.dueDate) {
    await notifyUser(task.assigneeId, "Новая задача с дедлайном", `Вам назначена задача "${task.title}"`, task.id);
  }
  res.status(201).json(taskWithExtras);
});

app.put("/tasks/:id", auth, async (req, res) => {
  const id = Number(req.params.id);
  const schema = z.object({
    title: z.string().min(2).optional(),
    description: z.string().nullable().optional(),
    assigneeId: z.number().nullable().optional(),
    dueDate: z.string().datetime().nullable().optional(),
    priority: z.nativeEnum(Priority).optional(),
    status: z.nativeEnum(TaskStatus).optional(),
    tagIds: z.array(z.number()).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const { tagIds, assigneeId, ...restData } = parsed.data;
  const existing = await prisma.task.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ message: "Task not found" });
  const allowed = await requireProjectRole(req, res, existing.projectId, ProjectMemberRole.MEMBER);
  if (!allowed) return;
  await prisma.task.update({
    where: { id },
    data: {
      ...restData,
      dueDate: restData.dueDate === undefined ? undefined : restData.dueDate ? new Date(restData.dueDate) : null,
      ...(assigneeId === undefined
        ? {}
        : assigneeId === null
          ? { assignee: { disconnect: true } }
          : { assignee: { connect: { id: assigneeId } } }),
    },
  });
  if (tagIds !== undefined) {
    await prisma.taskTag.deleteMany({ where: { taskId: id } });
    if (tagIds.length) {
      await prisma.taskTag.createMany({
        data: tagIds.map((tagId) => ({ taskId: id, tagId })),
        skipDuplicates: true,
      });
    }
  }
  const updated = await prisma.task.findUnique({
    where: { id },
    include: {
      assignee: { select: { id: true, name: true, email: true, role: true } },
      comments: { include: { author: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" } },
      timeLogs: true,
      checklist: { orderBy: { createdAt: "asc" } },
      tags: { include: { tag: true } },
      attachments: true,
      history: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  await addHistory(updated.id, req.user.id, "TASK_UPDATED", {
    status: restData.status,
    assigneeId: assigneeId,
    dueDate: restData.dueDate,
  });
  if (updated.assigneeId && updated.dueDate) {
    await notifyUser(updated.assigneeId, "Обновлен срок задачи", `Проверьте сроки задачи "${updated.title}"`, updated.id);
  }
  res.json(updated);
});

app.delete("/tasks/:id", auth, allowRoles(Role.ADMIN, Role.MANAGER), async (req, res) => {
  const id = Number(req.params.id);
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) return res.status(404).json({ message: "Task not found" });
  const allowed = await requireProjectRole(req, res, task.projectId, ProjectMemberRole.MANAGER);
  if (!allowed) return;
  await prisma.task.delete({ where: { id } });
  res.status(204).send();
});

app.post("/tasks/:id/archive", auth, async (req, res) => {
  const id = Number(req.params.id);
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) return res.status(404).json({ message: "Task not found" });
  const allowed = await requireProjectRole(req, res, task.projectId, ProjectMemberRole.MEMBER);
  if (!allowed) return;
  await prisma.task.update({ where: { id }, data: { archivedAt: new Date() } });
  await addHistory(id, req.user.id, "TASK_ARCHIVED", null);
  res.status(204).send();
});

app.post("/tasks/:id/comments", auth, async (req, res) => {
  const id = Number(req.params.id);
  const schema = z.object({ text: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) return res.status(404).json({ message: "Task not found" });
  const allowed = await requireProjectRole(req, res, task.projectId, ProjectMemberRole.VIEWER);
  if (!allowed) return;
  const comment = await prisma.comment.create({
    data: { text: parsed.data.text, taskId: id, authorId: req.user.id },
    include: { author: { select: { id: true, name: true } } },
  });
  await addHistory(task.id, req.user.id, "COMMENT_ADDED", { commentId: comment.id });
  res.status(201).json(comment);
});

app.post("/tasks/:id/timelogs", auth, async (req, res) => {
  const id = Number(req.params.id);
  const schema = z.object({ planned: z.number().min(0).optional(), spent: z.number().min(0).optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) return res.status(404).json({ message: "Task not found" });
  const allowed = await requireProjectRole(req, res, task.projectId, ProjectMemberRole.VIEWER);
  if (!allowed) return;
  const log = await prisma.timeLog.create({
    data: { taskId: id, userId: req.user.id, planned: parsed.data.planned || 0, spent: parsed.data.spent || 0 },
  });
  res.status(201).json(log);
});

app.post("/tasks/:id/checklist", auth, async (req, res) => {
  const id = Number(req.params.id);
  const schema = z.object({ text: z.string().min(1).max(300) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) return res.status(404).json({ message: "Task not found" });
  const allowed = await requireProjectRole(req, res, task.projectId, ProjectMemberRole.MEMBER);
  if (!allowed) return;
  const item = await prisma.checklistItem.create({
    data: { taskId: id, text: parsed.data.text.trim() },
  });
  await addHistory(task.id, req.user.id, "CHECKLIST_ADDED", { checklistId: item.id });
  res.status(201).json(item);
});

app.put("/checklist/:id", auth, async (req, res) => {
  const id = Number(req.params.id);
  const schema = z.object({
    text: z.string().min(1).max(300).optional(),
    done: z.boolean().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const item = await prisma.checklistItem.findUnique({ where: { id }, include: { task: true } });
  if (!item) return res.status(404).json({ message: "Checklist item not found" });
  const allowed = await requireProjectRole(req, res, item.task.projectId, ProjectMemberRole.MEMBER);
  if (!allowed) return;
  const updated = await prisma.checklistItem.update({
    where: { id },
    data: {
      ...(parsed.data.text !== undefined ? { text: parsed.data.text.trim() } : {}),
      ...(parsed.data.done !== undefined ? { done: parsed.data.done } : {}),
    },
  });
  await addHistory(item.taskId, req.user.id, "CHECKLIST_UPDATED", { checklistId: updated.id, done: updated.done });
  res.json(updated);
});

app.delete("/checklist/:id", auth, async (req, res) => {
  const id = Number(req.params.id);
  const item = await prisma.checklistItem.findUnique({ where: { id }, include: { task: true } });
  if (!item) return res.status(404).json({ message: "Checklist item not found" });
  const allowed = await requireProjectRole(req, res, item.task.projectId, ProjectMemberRole.MEMBER);
  if (!allowed) return;
  await prisma.checklistItem.delete({ where: { id } });
  await addHistory(item.taskId, req.user.id, "CHECKLIST_DELETED", { checklistId: id });
  res.status(204).send();
});

app.post("/tasks/:id/attachments", auth, upload.single("file"), async (req, res) => {
  const id = Number(req.params.id);
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) return res.status(404).json({ message: "Task not found" });
  const allowed = await requireProjectRole(req, res, task.projectId, ProjectMemberRole.MEMBER);
  if (!allowed) return;
  if (!req.file) return res.status(400).json({ message: "Файл не передан" });
  const saved = await prisma.attachment.create({
    data: {
      taskId: id,
      originalName: req.file.originalname,
      fileName: req.file.filename,
      mimeType: req.file.mimetype,
      size: req.file.size,
      uploadedBy: req.user.id,
    },
  });
  await addHistory(id, req.user.id, "ATTACHMENT_ADDED", { attachmentId: saved.id, file: saved.originalName });
  res.status(201).json(saved);
});

app.delete("/attachments/:id", auth, async (req, res) => {
  const id = Number(req.params.id);
  const attachment = await prisma.attachment.findUnique({ where: { id }, include: { task: true } });
  if (!attachment) return res.status(404).json({ message: "Attachment not found" });
  const allowed = await requireProjectRole(req, res, attachment.task.projectId, ProjectMemberRole.MEMBER);
  if (!allowed) return;
  const filePath = path.join(uploadsDir, attachment.fileName);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  await prisma.attachment.delete({ where: { id } });
  await addHistory(attachment.taskId, req.user.id, "ATTACHMENT_DELETED", { attachmentId: id });
  res.status(204).send();
});

app.get("/dashboard/:projectId", auth, async (req, res) => {
  const projectId = Number(req.params.projectId);
  const allowed = await requireProjectRole(req, res, projectId, ProjectMemberRole.VIEWER);
  if (!allowed) return;

  const [total, todo, inProgress, review, done, overdue] = await Promise.all([
    prisma.task.count({ where: { projectId, archivedAt: null } }),
    prisma.task.count({ where: { projectId, archivedAt: null, status: TaskStatus.TODO } }),
    prisma.task.count({ where: { projectId, archivedAt: null, status: TaskStatus.IN_PROGRESS } }),
    prisma.task.count({ where: { projectId, archivedAt: null, status: TaskStatus.REVIEW } }),
    prisma.task.count({ where: { projectId, archivedAt: null, status: TaskStatus.DONE } }),
    prisma.task.count({ where: { projectId, archivedAt: null, dueDate: { lt: new Date() }, status: { not: TaskStatus.DONE } } }),
  ]);

  res.json({ total, todo, inProgress, review, done, overdue });
});

app.post("/notifications/scan", auth, async (req, res) => {
  const tasks = await prisma.task.findMany({
    where: {
      assigneeId: req.user.id,
      archivedAt: null,
      dueDate: { not: null, lte: new Date(Date.now() + 24 * 60 * 60 * 1000) },
      status: { not: TaskStatus.DONE },
    },
    select: { id: true, title: true, dueDate: true },
  });
  for (const task of tasks) {
    const exists = await prisma.notification.findFirst({
      where: { userId: req.user.id, taskId: task.id, title: "Дедлайн задачи" },
    });
    if (!exists) {
      await notifyUser(req.user.id, "Дедлайн задачи", `Срок задачи "${task.title}" скоро истекает`, task.id);
    }
  }
  res.json({ created: tasks.length });
});

app.get("/notifications", auth, async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  res.json(notifications);
});

app.put("/notifications/:id/read", auth, async (req, res) => {
  const id = Number(req.params.id);
  const item = await prisma.notification.update({
    where: { id },
    data: { read: true },
  });
  res.json(item);
});

app.get("/projects/:id/export.csv", auth, async (req, res) => {
  const projectId = Number(req.params.id);
  const allowed = await requireProjectRole(req, res, projectId, ProjectMemberRole.VIEWER);
  if (!allowed) return;
  const tasks = await prisma.task.findMany({
    where: { projectId, archivedAt: null },
    include: { assignee: true, tags: { include: { tag: true } }, timeLogs: true },
    orderBy: { createdAt: "asc" },
  });
  const header = ["ID", "Название", "Статус", "Приоритет", "Исполнитель", "Дедлайн", "Теги", "ПланЧасы", "ФактЧасы"];
  const rows = tasks.map((t) => [
    t.id,
    `"${(t.title || "").replace(/"/g, '""')}"`,
    t.status,
    t.priority,
    `"${t.assignee?.name || ""}"`,
    t.dueDate ? t.dueDate.toISOString() : "",
    `"${t.tags.map((x) => x.tag.name).join(", ")}"`,
    t.timeLogs.reduce((acc, x) => acc + x.planned, 0),
    t.timeLogs.reduce((acc, x) => acc + x.spent, 0),
  ]);
  const csv = [header.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename=project-${projectId}-report.csv`);
  res.send(`\uFEFF${csv}`);
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`API started on port ${PORT}`);
});
