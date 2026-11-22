import { Prisma } from '../../generated/prisma/client.js';
import {
  BenefitPackageCode,
  BenefitPackageStatus,
  LivingDaysDirection,
  LivingExchangeStatus,
  SettlementSource,
} from '../../generated/prisma/enums.js';
import { CommonErrorCode } from '../../common/constants/error-code.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { ProfileErrorCode } from '../customer-profile/constants/profile-error-code.js';
import { LivingDaysErrorCode } from './constants/living-days-error-code.js';
import { LivingDaysService } from './living-days.service.js';

interface PackageRow {
  id: string;
  accountId: string;
  code: BenefitPackageCode;
  status: BenefitPackageStatus;
}

interface DaysRow {
  accountId: string;
  balance: number;
}

interface ExchangeRow {
  id: string;
  guestAccountId: string;
  hostAccountId: string;
  selectedDays: number;
  settlementSource: SettlementSource;
  benefitPackageId: string | null;
  status: LivingExchangeStatus;
  actualDays: number | null;
  createdAt: Date;
  closedAt: Date | null;
}

interface LedgerRow {
  id: string;
  accountId: string;
  exchangeId: string;
  direction: LivingDaysDirection;
  amount: number;
}

interface AccountRow {
  phoneNumber: string;
  termsAgreedAt: Date | null;
}

interface ProfileRow {
  profileCompletedAt: Date | null;
}

function createWorld() {
  let sequence = 0;
  const nextId = () => `id-${++sequence}`;

  const accounts = new Map<string, AccountRow>();
  const realNames = new Map<string, { id: string; status: string }>();
  const profiles = new Map<string, ProfileRow>();
  const packages: PackageRow[] = [];
  const days = new Map<string, DaysRow>();
  const exchanges: ExchangeRow[] = [];
  const ledger: LedgerRow[] = [];

  function uniqueConflict(): Prisma.PrismaClientKnownRequestError {
    return new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      {
        code: 'P2002',
        clientVersion: 'test',
      },
    );
  }

  function applyBalance(
    current: number,
    balance: number | { increment?: number; decrement?: number },
  ): number {
    if (typeof balance === 'number') {
      return balance;
    }
    return current + (balance.increment ?? 0) - (balance.decrement ?? 0);
  }

  const prisma = {
    account: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        accounts.get(where.id) ?? null,
    },
    accountRealNameVerification: {
      findUnique: async ({ where }: { where: { accountId: string } }) =>
        realNames.get(where.accountId) ?? null,
    },
    customerProfile: {
      findUnique: async ({ where }: { where: { accountId: string } }) =>
        profiles.get(where.accountId) ?? null,
    },
    benefitPackage: {
      findUnique: async ({
        where,
      }: {
        where: {
          accountId_code: { accountId: string; code: BenefitPackageCode };
        };
      }) =>
        packages.find(
          (row) =>
            row.accountId === where.accountId_code.accountId &&
            row.code === where.accountId_code.code,
        ) ?? null,
      create: async ({
        data,
      }: {
        data: {
          accountId: string;
          code: BenefitPackageCode;
          status: BenefitPackageStatus;
        };
      }) => {
        if (
          packages.some(
            (row) => row.accountId === data.accountId && row.code === data.code,
          )
        ) {
          throw uniqueConflict();
        }
        const row: PackageRow = { id: nextId(), ...data };
        packages.push(row);
        return row;
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: { id: string; status: BenefitPackageStatus };
        data: { status: BenefitPackageStatus };
      }) => {
        const row = packages.find(
          (item) => item.id === where.id && item.status === where.status,
        );
        if (!row) {
          return { count: 0 };
        }
        row.status = data.status;
        return { count: 1 };
      },
    },
    livingDaysAccount: {
      findUnique: async ({ where }: { where: { accountId: string } }) =>
        days.get(where.accountId) ?? null,
      updateMany: async ({
        where,
        data,
      }: {
        where: { accountId: string; balance: { gte: number } };
        data: { balance: { decrement: number } };
      }) => {
        const row = days.get(where.accountId);
        if (!row || row.balance < where.balance.gte) {
          return { count: 0 };
        }
        row.balance = applyBalance(row.balance, data.balance);
        return { count: 1 };
      },
      update: async ({
        where,
        data,
      }: {
        where: { accountId: string };
        data: { balance: { increment: number } };
      }) => {
        const row = days.get(where.accountId);
        if (!row) {
          throw new Error('days account missing');
        }
        row.balance = applyBalance(row.balance, data.balance);
        return row;
      },
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { accountId: string };
        create: { accountId: string; balance: number };
        update: { balance: { increment: number } };
      }) => {
        const existing = days.get(where.accountId);
        if (!existing) {
          const row = { accountId: create.accountId, balance: create.balance };
          days.set(row.accountId, row);
          return row;
        }
        existing.balance = applyBalance(existing.balance, update.balance);
        return existing;
      },
    },
    livingExchange: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        exchanges.find((row) => row.id === where.id) ?? null,
      findFirst: async ({
        where,
      }: {
        where: {
          guestAccountId: string;
          status: LivingExchangeStatus;
          settlementSource: SettlementSource;
        };
      }) =>
        exchanges.find(
          (row) =>
            row.guestAccountId === where.guestAccountId &&
            row.status === where.status &&
            row.settlementSource === where.settlementSource,
        ) ?? null,
      aggregate: async ({
        where,
      }: {
        where: {
          guestAccountId: string;
          status: LivingExchangeStatus;
          settlementSource: SettlementSource;
        };
      }) => {
        const matched = exchanges.filter(
          (row) =>
            row.guestAccountId === where.guestAccountId &&
            row.status === where.status &&
            row.settlementSource === where.settlementSource,
        );
        return {
          _sum: {
            selectedDays:
              matched.length === 0
                ? null
                : matched.reduce((sum, row) => sum + row.selectedDays, 0),
          },
        };
      },
      create: async ({
        data,
      }: {
        data: Omit<ExchangeRow, 'id' | 'actualDays' | 'createdAt' | 'closedAt'>;
      }) => {
        const duplicateOpenBenefit = exchanges.some(
          (row) =>
            row.guestAccountId === data.guestAccountId &&
            row.status === LivingExchangeStatus.OPEN &&
            row.settlementSource === SettlementSource.BENEFIT_PACKAGE &&
            data.settlementSource === SettlementSource.BENEFIT_PACKAGE &&
            data.status === LivingExchangeStatus.OPEN,
        );
        if (duplicateOpenBenefit) {
          throw uniqueConflict();
        }
        const row: ExchangeRow = {
          id: nextId(),
          actualDays: null,
          createdAt: new Date(),
          closedAt: null,
          ...data,
        };
        exchanges.push(row);
        return row;
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: { id: string; status: LivingExchangeStatus };
        data: Partial<ExchangeRow>;
      }) => {
        const row = exchanges.find(
          (item) => item.id === where.id && item.status === where.status,
        );
        if (!row) {
          return { count: 0 };
        }
        for (const [key, value] of Object.entries(data)) {
          if (value !== undefined) {
            Object.assign(row, { [key]: value });
          }
        }
        return { count: 1 };
      },
    },
    livingDaysLedgerEntry: {
      create: async ({ data }: { data: Omit<LedgerRow, 'id'> }) => {
        if (
          ledger.some(
            (row) =>
              row.exchangeId === data.exchangeId &&
              row.accountId === data.accountId &&
              row.direction === data.direction,
          )
        ) {
          throw uniqueConflict();
        }
        const row: LedgerRow = { id: nextId(), ...data };
        ledger.push(row);
        return row;
      },
    },
    $queryRaw: async () => [],
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma),
  };

  function addEligibleAccount(
    accountId: string,
    profileCompleted = true,
  ): void {
    accounts.set(accountId, {
      phoneNumber: '13800138000',
      termsAgreedAt: new Date(),
    });
    realNames.set(accountId, { id: nextId(), status: 'PENDING' });
    profiles.set(accountId, {
      profileCompletedAt: profileCompleted ? new Date() : null,
    });
  }

  return {
    prisma: prisma as unknown as PrismaService,
    packages,
    days,
    exchanges,
    ledger,
    accounts,
    realNames,
    profiles,
    addEligibleAccount,
  };
}

function packageOf(world: ReturnType<typeof createWorld>, accountId: string) {
  return world.packages.find((row) => row.accountId === accountId);
}

describe('LivingDaysService', () => {
  it('只完成资料不发放权益包，也不创建天数账户', async () => {
    const world = createWorld();
    world.accounts.set('guest', {
      phoneNumber: '13800138000',
      termsAgreedAt: new Date(),
    });
    world.profiles.set('guest', { profileCompletedAt: new Date() });
    const service = new LivingDaysService(world.prisma);

    await service.grantIfEligible('guest');

    expect(world.packages).toHaveLength(0);
    expect(world.days.size).toBe(0);
  });

  it('四项齐备后发放可用权益包，余额仍为 0；待核验也发放；重复调用不产生第二张', async () => {
    const world = createWorld();
    world.addEligibleAccount('guest');
    const service = new LivingDaysService(world.prisma);

    await service.grantIfEligible('guest');
    await service.grantIfEligible('guest');

    expect(packageOf(world, 'guest')?.status).toBe(
      BenefitPackageStatus.AVAILABLE,
    );
    expect(world.packages).toHaveLength(1);
    expect(world.realNames.get('guest')?.status).toBe('PENDING');
    expect(world.days.size).toBe(0);
    await expect(service.getView('guest')).resolves.toEqual({
      balance: 0,
      benefitPackage: {
        code: BenefitPackageCode.FIRST_LIVING_EXCHANGE,
        status: BenefitPackageStatus.AVAILABLE,
      },
    });
  });

  it('没有记录时查询余额为 0、权益包为 null', async () => {
    const world = createWorld();
    const service = new LivingDaysService(world.prisma);

    await expect(service.getView('nobody')).resolves.toEqual({
      balance: 0,
      benefitPackage: null,
    });
  });

  it('并发发放撞上唯一约束时视为已经发放', async () => {
    const tx = {
      benefitPackage: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockRejectedValue(
          new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
            code: 'P2002',
            clientVersion: 'test',
          }),
        ),
      },
      account: {
        findUnique: vi.fn().mockResolvedValue({
          phoneNumber: '13800138000',
          termsAgreedAt: new Date(),
        }),
      },
      accountRealNameVerification: {
        findUnique: vi.fn().mockResolvedValue({ id: 'real-name' }),
      },
      customerProfile: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ profileCompletedAt: new Date() }),
      },
    };
    const prisma = {
      $transaction: async (fn: (inner: typeof tx) => Promise<unknown>) =>
        fn(tx),
    } as unknown as PrismaService;
    const service = new LivingDaysService(prisma);

    await expect(service.grantIfEligible('guest')).resolves.toBeUndefined();
  });

  describe('结算', () => {
    function setup() {
      const world = createWorld();
      world.addEligibleAccount('guest');
      world.packages.push({
        id: 'package-1',
        accountId: 'guest',
        code: BenefitPackageCode.FIRST_LIVING_EXCHANGE,
        status: BenefitPackageStatus.AVAILABLE,
      });
      const service = new LivingDaysService(world.prisma);
      return { world, service };
    }

    it('客人与房主是同一账号时拒绝', async () => {
      const { service } = setup();

      await expect(
        service.openExchange({
          guestAccountId: 'guest',
          hostAccountId: 'guest',
          selectedDays: 1,
          settlementSource: SettlementSource.BENEFIT_PACKAGE,
        }),
      ).rejects.toMatchObject({ code: CommonErrorCode.VALIDATION_ERROR });
    });

    it('资料未完成时拒绝开立', async () => {
      const world = createWorld();
      world.addEligibleAccount('guest', false);
      const service = new LivingDaysService(world.prisma);

      await expect(
        service.openExchange({
          guestAccountId: 'guest',
          hostAccountId: 'host',
          selectedDays: 1,
          settlementSource: SettlementSource.LIVING_DAYS,
        }),
      ).rejects.toMatchObject({ code: ProfileErrorCode.PROFILE_NOT_COMPLETE });
      expect(world.exchanges).toHaveLength(0);
    });

    it('权益包订单只能选 1 或 2 天，同时只能有一笔进行中的', async () => {
      const { world, service } = setup();

      await expect(
        service.openExchange({
          guestAccountId: 'guest',
          hostAccountId: 'host',
          selectedDays: 3,
          settlementSource: SettlementSource.BENEFIT_PACKAGE,
        }),
      ).rejects.toMatchObject({
        code: LivingDaysErrorCode.BENEFIT_PACKAGE_NOT_APPLICABLE,
      });
      expect(world.exchanges).toHaveLength(0);

      const opened = await service.openExchange({
        guestAccountId: 'guest',
        hostAccountId: 'host',
        selectedDays: 2,
        settlementSource: SettlementSource.BENEFIT_PACKAGE,
      });
      await expect(
        service.openExchange({
          guestAccountId: 'guest',
          hostAccountId: 'host',
          selectedDays: 1,
          settlementSource: SettlementSource.BENEFIT_PACKAGE,
        }),
      ).rejects.toMatchObject({
        code: LivingDaysErrorCode.BENEFIT_PACKAGE_ALREADY_OPEN,
      });
      expect(world.exchanges).toHaveLength(1);
      expect(opened.benefitPackageId).toBe('package-1');
      expect(packageOf(world, 'guest')?.status).toBe(
        BenefitPackageStatus.AVAILABLE,
      );
    });

    it('拒绝、取消、实际天数为 0 都不消耗权益包，房主不加天数', async () => {
      const { world, service } = setup();

      const rejected = await service.openExchange({
        guestAccountId: 'guest',
        hostAccountId: 'host',
        selectedDays: 2,
        settlementSource: SettlementSource.BENEFIT_PACKAGE,
      });
      await service.rejectExchange(rejected.id);

      const cancelled = await service.openExchange({
        guestAccountId: 'guest',
        hostAccountId: 'host',
        selectedDays: 1,
        settlementSource: SettlementSource.BENEFIT_PACKAGE,
      });
      await service.cancelExchange(cancelled.id);

      const missed = await service.openExchange({
        guestAccountId: 'guest',
        hostAccountId: 'host',
        selectedDays: 2,
        settlementSource: SettlementSource.BENEFIT_PACKAGE,
      });
      await service.completeExchange(missed.id, 0);

      expect(packageOf(world, 'guest')?.status).toBe(
        BenefitPackageStatus.AVAILABLE,
      );
      expect(world.days.has('host')).toBe(false);
      expect(world.days.has('guest')).toBe(false);
      expect(world.ledger).toHaveLength(0);
      expect(world.exchanges.map((row) => row.status)).toEqual([
        LivingExchangeStatus.REJECTED,
        LivingExchangeStatus.CANCELLED,
        LivingExchangeStatus.NOT_COMPLETED,
      ]);
    });

    it('住满和未住满都把权益包标成已使用，按实际天数给房主，客人余额不变', async () => {
      const { world, service } = setup();
      const partial = await service.openExchange({
        guestAccountId: 'guest',
        hostAccountId: 'host',
        selectedDays: 2,
        settlementSource: SettlementSource.BENEFIT_PACKAGE,
      });
      await service.completeExchange(partial.id, 1);

      expect(packageOf(world, 'guest')?.status).toBe(BenefitPackageStatus.USED);
      expect(world.days.get('host')?.balance).toBe(1);
      expect(world.days.has('guest')).toBe(false);
      expect(world.ledger).toEqual([
        expect.objectContaining({
          accountId: 'host',
          direction: LivingDaysDirection.EARNED,
          amount: 1,
        }),
      ]);

      const worldFull = createWorld();
      worldFull.addEligibleAccount('guest');
      worldFull.packages.push({
        id: 'package-full',
        accountId: 'guest',
        code: BenefitPackageCode.FIRST_LIVING_EXCHANGE,
        status: BenefitPackageStatus.AVAILABLE,
      });
      const fullService = new LivingDaysService(worldFull.prisma);
      const full = await fullService.openExchange({
        guestAccountId: 'guest',
        hostAccountId: 'host',
        selectedDays: 2,
        settlementSource: SettlementSource.BENEFIT_PACKAGE,
      });
      await fullService.completeExchange(full.id, 2);

      expect(packageOf(worldFull, 'guest')?.status).toBe(
        BenefitPackageStatus.USED,
      );
      expect(worldFull.days.get('host')?.balance).toBe(2);
      expect(worldFull.days.has('guest')).toBe(false);
      await expect(fullService.getView('guest')).resolves.toEqual({
        balance: 0,
        benefitPackage: {
          code: BenefitPackageCode.FIRST_LIVING_EXCHANGE,
          status: BenefitPackageStatus.USED,
        },
      });
    });

    it('权益包仍可用时，用 Living Days 住 3 天只扣余额', async () => {
      const { world, service } = setup();
      world.days.set('guest', { accountId: 'guest', balance: 5 });

      const opened = await service.openExchange({
        guestAccountId: 'guest',
        hostAccountId: 'host',
        selectedDays: 3,
        settlementSource: SettlementSource.LIVING_DAYS,
      });

      expect(opened.benefitPackageId).toBeNull();
      expect(opened.settlementSource).toBe(SettlementSource.LIVING_DAYS);
      expect(packageOf(world, 'guest')?.status).toBe(
        BenefitPackageStatus.AVAILABLE,
      );
      await expect(service.getView('guest')).resolves.toMatchObject({
        balance: 5,
      });

      await service.completeExchange(opened.id, 3);

      expect(world.days.get('guest')?.balance).toBe(2);
      expect(world.days.get('host')?.balance).toBe(3);
      expect(packageOf(world, 'guest')?.status).toBe(
        BenefitPackageStatus.AVAILABLE,
      );
      expect(world.ledger).toEqual([
        expect.objectContaining({
          accountId: 'guest',
          direction: LivingDaysDirection.SPENT,
          amount: 3,
        }),
        expect.objectContaining({
          accountId: 'host',
          direction: LivingDaysDirection.EARNED,
          amount: 3,
        }),
      ]);
    });

    it('未住满时只扣实际天数，占用随订单离开进行中而释放', async () => {
      const { world, service } = setup();
      world.days.set('guest', { accountId: 'guest', balance: 5 });
      const opened = await service.openExchange({
        guestAccountId: 'guest',
        hostAccountId: 'host',
        selectedDays: 3,
        settlementSource: SettlementSource.LIVING_DAYS,
      });
      await service.completeExchange(opened.id, 1);

      expect(world.days.get('guest')?.balance).toBe(4);
      expect(world.days.get('host')?.balance).toBe(1);

      const next = await service.openExchange({
        guestAccountId: 'guest',
        hostAccountId: 'host',
        selectedDays: 4,
        settlementSource: SettlementSource.LIVING_DAYS,
      });
      expect(next.selectedDays).toBe(4);
    });

    it('进行中的占用会减少可用余额，余额不足时两边都不变', async () => {
      const { world, service } = setup();
      world.days.set('guest', { accountId: 'guest', balance: 5 });
      const held = await service.openExchange({
        guestAccountId: 'guest',
        hostAccountId: 'host',
        selectedDays: 3,
        settlementSource: SettlementSource.LIVING_DAYS,
      });

      await expect(
        service.openExchange({
          guestAccountId: 'guest',
          hostAccountId: 'host',
          selectedDays: 3,
          settlementSource: SettlementSource.LIVING_DAYS,
        }),
      ).rejects.toMatchObject({
        code: LivingDaysErrorCode.INSUFFICIENT_LIVING_DAYS,
      });

      expect(
        world.exchanges.filter(
          (row) => row.status === LivingExchangeStatus.OPEN,
        ),
      ).toEqual([held]);
      expect(world.days.get('guest')?.balance).toBe(5);
      expect(world.days.has('host')).toBe(false);
      expect(packageOf(world, 'guest')?.status).toBe(
        BenefitPackageStatus.AVAILABLE,
      );
    });

    it('实际天数超过所选天数或为负数时不改任何余额', async () => {
      const { world, service } = setup();
      world.days.set('guest', { accountId: 'guest', balance: 5 });
      const opened = await service.openExchange({
        guestAccountId: 'guest',
        hostAccountId: 'host',
        selectedDays: 2,
        settlementSource: SettlementSource.LIVING_DAYS,
      });

      await expect(
        service.completeExchange(opened.id, 3),
      ).rejects.toMatchObject({
        code: LivingDaysErrorCode.ACTUAL_DAYS_EXCEED_SELECTED,
      });
      await expect(
        service.completeExchange(opened.id, -1),
      ).rejects.toMatchObject({
        code: LivingDaysErrorCode.ACTUAL_DAYS_EXCEED_SELECTED,
      });

      expect(world.exchanges[0]?.status).toBe(LivingExchangeStatus.OPEN);
      expect(world.days.get('guest')?.balance).toBe(5);
      expect(world.ledger).toHaveLength(0);
    });

    it('同一笔订单不能结算两次', async () => {
      const { world, service } = setup();
      world.days.set('guest', { accountId: 'guest', balance: 5 });
      const opened = await service.openExchange({
        guestAccountId: 'guest',
        hostAccountId: 'host',
        selectedDays: 2,
        settlementSource: SettlementSource.LIVING_DAYS,
      });
      await service.completeExchange(opened.id, 2);

      await expect(
        service.completeExchange(opened.id, 2),
      ).rejects.toMatchObject({
        code: LivingDaysErrorCode.EXCHANGE_NOT_OPEN,
      });
      await expect(service.rejectExchange(opened.id)).rejects.toMatchObject({
        code: LivingDaysErrorCode.EXCHANGE_NOT_OPEN,
      });

      expect(world.days.get('guest')?.balance).toBe(3);
      expect(world.days.get('host')?.balance).toBe(2);
      expect(world.ledger).toHaveLength(2);
    });
  });
});
