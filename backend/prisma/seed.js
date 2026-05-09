const { PrismaClient, Role, TaskStatus, Priority, ProjectMemberRole } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function createUser(email, name, password, role) {
  const passwordHash = await bcrypt.hash(password, 10);
  return prisma.user.upsert({
    where: { email },
    update: { name, passwordHash, role },
    create: { email, name, passwordHash, role },
  });
}

async function main() {
  const admin = await createUser("admin@example.com", "Admin User", "admin123", Role.ADMIN);
  const manager = await createUser("manager@example.com", "Manager User", "manager123", Role.MANAGER);
  const executor = await createUser("executor@example.com", "Executor User", "executor123", Role.EXECUTOR);
  const viewer = await createUser("viewer@example.com", "Viewer User", "viewer123", Role.VIEWER);

  const project = await prisma.project.create({
    data: {
      title: "Diploma PM System",
      description: "Demo seeded project",
      createdById: admin.id,
      members: {
        create: [
          { userId: admin.id, role: ProjectMemberRole.OWNER },
          { userId: manager.id, role: ProjectMemberRole.MANAGER },
          { userId: executor.id, role: ProjectMemberRole.MEMBER },
          { userId: viewer.id, role: ProjectMemberRole.VIEWER },
        ],
      },
    },
  });

  const task1 = await prisma.task.create({
    data: {
      title: "Set up project architecture",
      description: "Create base structure for frontend and backend",
      status: TaskStatus.TODO,
      priority: Priority.HIGH,
      projectId: project.id,
      createdById: manager.id,
      assigneeId: executor.id,
    },
  });

  const task2 = await prisma.task.create({
    data: {
      title: "Implement authentication",
      status: TaskStatus.IN_PROGRESS,
      priority: Priority.HIGH,
      projectId: project.id,
      createdById: manager.id,
      assigneeId: executor.id,
    },
  });

  await prisma.comment.create({
    data: { text: "Please keep API documented in Swagger-like format.", taskId: task2.id, authorId: manager.id },
  });

  await prisma.timeLog.create({
    data: { taskId: task1.id, userId: executor.id, planned: 6, spent: 2 },
  });

  const urgentTag = await prisma.tag.create({
    data: { projectId: project.id, name: "Срочно", color: "#dc2626" },
  });
  const backendTag = await prisma.tag.create({
    data: { projectId: project.id, name: "Backend", color: "#2563eb" },
  });

  await prisma.taskTag.createMany({
    data: [
      { taskId: task1.id, tagId: urgentTag.id },
      { taskId: task2.id, tagId: backendTag.id },
    ],
  });

  await prisma.checklistItem.createMany({
    data: [
      { taskId: task2.id, text: "Настроить JWT авторизацию", done: true },
      { taskId: task2.id, text: "Добавить разграничение ролей", done: false },
    ],
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log("Seed complete");
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
