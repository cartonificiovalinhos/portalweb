import { prisma } from './prisma';

export async function isProgramAllowed(userId: number, entityId: number | null, programCode: string): Promise<boolean> {
  if (!entityId) return false;

  const program = await prisma.program.findUnique({
    where: { code: programCode },
    select: { id: true, moduleId: true },
  });
  if (!program) return false;

  const userEntity = await prisma.userEntity.findFirst({
    where: { userId, entityId },
    orderBy: { id: 'desc' },
    select: { id: true },
  });
  if (!userEntity) return false;

  const userEntityModuleAllowed = await prisma.userEntityModule.findFirst({
    where: { userEntityId: userEntity.id, moduleId: program.moduleId, allowed: true },
    orderBy: { id: 'desc' },
    select: { id: true },
  });

  if (!userEntityModuleAllowed) {
    const anyUserEntityModule = await prisma.userEntityModule.findFirst({
      where: { userEntityId: userEntity.id, moduleId: program.moduleId },
      orderBy: { id: 'desc' },
      select: { allowed: true },
    });
    if (anyUserEntityModule) return Boolean(anyUserEntityModule.allowed);
    return true;
  }

  const userProgramAllowed = await prisma.userEntityModuleProgram.findFirst({
    where: { userEntityModuleId: userEntityModuleAllowed.id, programId: program.id, allowed: true },
    orderBy: { id: 'desc' },
    select: { id: true },
  });

  if (userProgramAllowed) return true;

  const anyUserProgram = await prisma.userEntityModuleProgram.findFirst({
    where: { userEntityModuleId: userEntityModuleAllowed.id, programId: program.id },
    orderBy: { id: 'desc' },
    select: { allowed: true },
  });
  if (anyUserProgram) return Boolean(anyUserProgram.allowed);
  return true;
}

