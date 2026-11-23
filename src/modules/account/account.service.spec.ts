import type { PrismaService } from '../../prisma/prisma.service.js';
import { AccountService } from './account.service.js';

function createPrismaMock() {
  return {
    account: {
      update: vi.fn().mockResolvedValue({}),
    },
  } as unknown as PrismaService;
}

function storageMock() {
  return {
    enabled: false,
    put: vi.fn(),
    publicUrl: vi.fn(),
  } as unknown as import('../../common/storage/object-storage.service.js').ObjectStorageService;
}

describe('AccountService', () => {
  it('updates only the provided fields', async () => {
    const prisma = createPrismaMock();
    const service = new AccountService(prisma, storageMock());

    await service.updateWechatIdentity('account-1', { nickname: 'New Nick' });

    expect(prisma.account.update).toHaveBeenCalledWith({
      where: { id: 'account-1' },
      data: { nickname: 'New Nick' },
    });
  });

  it('updates both fields when both are provided', async () => {
    const prisma = createPrismaMock();
    const service = new AccountService(prisma, storageMock());

    await service.updateWechatIdentity('account-1', {
      nickname: 'New Nick',
      avatarUrl: 'https://example.com/a.png',
    });

    expect(prisma.account.update).toHaveBeenCalledWith({
      where: { id: 'account-1' },
      data: { nickname: 'New Nick', avatarUrl: 'https://example.com/a.png' },
    });
  });
});
