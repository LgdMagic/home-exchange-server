import type { ExecutionContext } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { ProfileCompletedGuard } from './profile-completed.guard.js';
import { ProfileErrorCode } from '../../modules/customer-profile/constants/profile-error-code.js';

function createContext(user?: { sub: string }): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

function createPrismaMock(profileCompletedAt: Date | null) {
  return {
    customerProfile: {
      findUnique: vi.fn().mockResolvedValue({ profileCompletedAt }),
    },
  } as unknown as PrismaService;
}

describe('ProfileCompletedGuard', () => {
  it('allows the request when the profile is completed', async () => {
    const prisma = createPrismaMock(new Date());
    const guard = new ProfileCompletedGuard(prisma);

    await expect(guard.canActivate(createContext({ sub: 'account-1' }))).resolves.toBe(true);
  });

  it('rejects when the profile is not completed', async () => {
    const prisma = createPrismaMock(null);
    const guard = new ProfileCompletedGuard(prisma);

    await expect(guard.canActivate(createContext({ sub: 'account-1' }))).rejects.toMatchObject({
      code: ProfileErrorCode.PROFILE_NOT_COMPLETE,
    });
  });

  it('throws a programmer error if used without JwtAuthGuard (req.user missing)', async () => {
    const prisma = createPrismaMock(null);
    const guard = new ProfileCompletedGuard(prisma);

    await expect(guard.canActivate(createContext(undefined))).rejects.toThrow(/JwtAuthGuard/);
  });
});
