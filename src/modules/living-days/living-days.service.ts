import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, type LivingExchange } from '../../generated/prisma/client.js';
import {
  BenefitPackageCode,
  BenefitPackageStatus,
  LivingDaysDirection,
  LivingExchangeStatus,
  SettlementSource,
} from '../../generated/prisma/enums.js';
import { CommonErrorCode } from '../../common/constants/error-code.js';
import { BusinessException } from '../../common/exceptions/business.exception.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ProfileErrorCode } from '../customer-profile/constants/profile-error-code.js';
import { LivingDaysErrorCode } from './constants/living-days-error-code.js';

type Tx = Prisma.TransactionClient;

export interface LivingDaysView {
  balance: number;
  benefitPackage: {
    code: BenefitPackageCode;
    status: BenefitPackageStatus;
  } | null;
}

export interface OpenExchangeInput {
  guestAccountId: string;
  hostAccountId: string;
  selectedDays: number;
  settlementSource: SettlementSource;
}

function isUniqueConflict(
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

/**
 * Living Days 余额与首次交换权益包。
 * 结算方法只给后续交换模块在服务端调用，不挂会员 HTTP 路由。
 */
@Injectable()
export class LivingDaysService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 四项条件都满足时发放一张 FIRST_LIVING_EXCHANGE。
   * 已有这张包（无论可用还是已使用）则不再发放，也不创建天数账户。
   */
  async grantIfEligible(accountId: string, tx?: Tx): Promise<void> {
    if (tx) {
      await this.grantInTransaction(accountId, tx);
      return;
    }

    await this.prisma.$transaction((inner) =>
      this.grantInTransaction(accountId, inner),
    );
  }

  async getView(accountId: string): Promise<LivingDaysView> {
    const [daysAccount, benefitPackage] = await Promise.all([
      this.prisma.livingDaysAccount.findUnique({
        where: { accountId },
      }),
      this.prisma.benefitPackage.findUnique({
        where: {
          accountId_code: {
            accountId,
            code: BenefitPackageCode.FIRST_LIVING_EXCHANGE,
          },
        },
      }),
    ]);

    return {
      balance: daysAccount?.balance ?? 0,
      benefitPackage: benefitPackage
        ? { code: benefitPackage.code, status: benefitPackage.status }
        : null,
    };
  }

  async openExchange(input: OpenExchangeInput): Promise<LivingExchange> {
    const { guestAccountId, hostAccountId, selectedDays, settlementSource } =
      input;

    if (guestAccountId === hostAccountId) {
      throw new BusinessException(
        CommonErrorCode.VALIDATION_ERROR,
        '客人与房主不能是同一账号',
        HttpStatus.BAD_REQUEST,
      );
    }

    const profile = await this.prisma.customerProfile.findUnique({
      where: { accountId: guestAccountId },
      select: { profileCompletedAt: true },
    });
    if (!profile?.profileCompletedAt) {
      throw new BusinessException(
        ProfileErrorCode.PROFILE_NOT_COMPLETE,
        '请先完成个人资料编辑',
        HttpStatus.FORBIDDEN,
      );
    }

    if (settlementSource === SettlementSource.BENEFIT_PACKAGE) {
      return this.openBenefitExchange(
        guestAccountId,
        hostAccountId,
        selectedDays,
      );
    }

    if (settlementSource === SettlementSource.LIVING_DAYS) {
      return this.openLivingDaysExchange(
        guestAccountId,
        hostAccountId,
        selectedDays,
      );
    }

    throw this.notApplicable();
  }

  async rejectExchange(exchangeId: string): Promise<void> {
    await this.closeWithoutSettlement(
      exchangeId,
      LivingExchangeStatus.REJECTED,
    );
  }

  async cancelExchange(exchangeId: string): Promise<void> {
    await this.closeWithoutSettlement(
      exchangeId,
      LivingExchangeStatus.CANCELLED,
    );
  }

  async completeExchange(
    exchangeId: string,
    actualDays: number,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const exchange = await this.lockOpenExchange(tx, exchangeId);

      if (
        !Number.isInteger(actualDays) ||
        actualDays < 0 ||
        actualDays > exchange.selectedDays
      ) {
        throw this.actualDaysExceedSelected();
      }

      if (actualDays === 0) {
        await this.markClosed(tx, exchangeId, {
          status: LivingExchangeStatus.NOT_COMPLETED,
          actualDays: 0,
        });
        return;
      }

      if (exchange.settlementSource === SettlementSource.BENEFIT_PACKAGE) {
        await this.settleBenefitPackage(tx, exchange, actualDays);
      } else {
        await this.settleLivingDays(tx, exchange, actualDays);
      }

      await this.markClosed(tx, exchangeId, {
        status: LivingExchangeStatus.COMPLETED,
        actualDays,
      });
    });
  }

  private async grantInTransaction(accountId: string, tx: Tx): Promise<void> {
    const existing = await tx.benefitPackage.findUnique({
      where: {
        accountId_code: {
          accountId,
          code: BenefitPackageCode.FIRST_LIVING_EXCHANGE,
        },
      },
      select: { id: true },
    });
    if (existing) {
      return;
    }

    const account = await tx.account.findUnique({
      where: { id: accountId },
      select: { phoneNumber: true, termsAgreedAt: true },
    });
    if (!account?.phoneNumber || !account.termsAgreedAt) {
      return;
    }

    const realName = await tx.accountRealNameVerification.findUnique({
      where: { accountId },
      select: { id: true },
    });
    if (!realName) {
      return;
    }

    const profile = await tx.customerProfile.findUnique({
      where: { accountId },
      select: { profileCompletedAt: true },
    });
    if (!profile?.profileCompletedAt) {
      return;
    }

    try {
      await tx.benefitPackage.create({
        data: {
          accountId,
          code: BenefitPackageCode.FIRST_LIVING_EXCHANGE,
          status: BenefitPackageStatus.AVAILABLE,
        },
      });
    } catch (error) {
      if (isUniqueConflict(error)) {
        return;
      }
      throw error;
    }
  }

  private async openBenefitExchange(
    guestAccountId: string,
    hostAccountId: string,
    selectedDays: number,
  ): Promise<LivingExchange> {
    if (selectedDays !== 1 && selectedDays !== 2) {
      throw this.notApplicable();
    }

    return this.prisma.$transaction(async (tx) => {
      await this.lockBenefitPackage(tx, guestAccountId);
      const benefitPackage = await tx.benefitPackage.findUnique({
        where: {
          accountId_code: {
            accountId: guestAccountId,
            code: BenefitPackageCode.FIRST_LIVING_EXCHANGE,
          },
        },
      });
      if (
        !benefitPackage ||
        benefitPackage.status !== BenefitPackageStatus.AVAILABLE
      ) {
        throw this.notApplicable();
      }

      const alreadyOpen = await tx.livingExchange.findFirst({
        where: {
          guestAccountId,
          status: LivingExchangeStatus.OPEN,
          settlementSource: SettlementSource.BENEFIT_PACKAGE,
        },
        select: { id: true },
      });
      if (alreadyOpen) {
        throw this.alreadyOpen();
      }

      try {
        return await tx.livingExchange.create({
          data: {
            guestAccountId,
            hostAccountId,
            selectedDays,
            settlementSource: SettlementSource.BENEFIT_PACKAGE,
            benefitPackageId: benefitPackage.id,
            status: LivingExchangeStatus.OPEN,
          },
        });
      } catch (error) {
        if (isUniqueConflict(error)) {
          throw this.alreadyOpen();
        }
        throw error;
      }
    });
  }

  private async openLivingDaysExchange(
    guestAccountId: string,
    hostAccountId: string,
    selectedDays: number,
  ): Promise<LivingExchange> {
    if (!Number.isInteger(selectedDays) || selectedDays < 1) {
      throw this.insufficient();
    }

    return this.prisma.$transaction(async (tx) => {
      await this.lockLivingDaysAccount(tx, guestAccountId);
      const daysAccount = await tx.livingDaysAccount.findUnique({
        where: { accountId: guestAccountId },
      });
      const held = await tx.livingExchange.aggregate({
        where: {
          guestAccountId,
          status: LivingExchangeStatus.OPEN,
          settlementSource: SettlementSource.LIVING_DAYS,
        },
        _sum: { selectedDays: true },
      });
      const available =
        (daysAccount?.balance ?? 0) - (held._sum.selectedDays ?? 0);
      if (selectedDays > available) {
        throw this.insufficient();
      }

      return tx.livingExchange.create({
        data: {
          guestAccountId,
          hostAccountId,
          selectedDays,
          settlementSource: SettlementSource.LIVING_DAYS,
          benefitPackageId: null,
          status: LivingExchangeStatus.OPEN,
        },
      });
    });
  }

  private async closeWithoutSettlement(
    exchangeId: string,
    status:
      | typeof LivingExchangeStatus.REJECTED
      | typeof LivingExchangeStatus.CANCELLED,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const exchange = await this.lockOpenExchange(tx, exchangeId);
      if (exchange.settlementSource === SettlementSource.BENEFIT_PACKAGE) {
        await this.lockBenefitPackage(tx, exchange.guestAccountId);
      } else {
        await this.lockLivingDaysAccount(tx, exchange.guestAccountId);
      }
      await this.markClosed(tx, exchangeId, { status });
    });
  }

  private async settleBenefitPackage(
    tx: Tx,
    exchange: LivingExchange,
    actualDays: number,
  ): Promise<void> {
    if (!exchange.benefitPackageId) {
      throw this.notApplicable();
    }

    await this.lockBenefitPackage(tx, exchange.guestAccountId);
    const consumed = await tx.benefitPackage.updateMany({
      where: {
        id: exchange.benefitPackageId,
        status: BenefitPackageStatus.AVAILABLE,
      },
      data: { status: BenefitPackageStatus.USED },
    });
    if (consumed.count !== 1) {
      throw this.notApplicable();
    }

    await this.creditHost(tx, exchange.hostAccountId, actualDays, exchange.id);
  }

  private async settleLivingDays(
    tx: Tx,
    exchange: LivingExchange,
    actualDays: number,
  ): Promise<void> {
    await this.lockLivingDaysAccount(tx, exchange.guestAccountId);
    const debited = await tx.livingDaysAccount.updateMany({
      where: {
        accountId: exchange.guestAccountId,
        balance: { gte: actualDays },
      },
      data: { balance: { decrement: actualDays } },
    });
    if (debited.count !== 1) {
      throw this.insufficient();
    }

    await tx.livingDaysLedgerEntry.create({
      data: {
        accountId: exchange.guestAccountId,
        exchangeId: exchange.id,
        direction: LivingDaysDirection.SPENT,
        amount: actualDays,
      },
    });
    await this.creditHost(tx, exchange.hostAccountId, actualDays, exchange.id);
  }

  private async creditHost(
    tx: Tx,
    hostAccountId: string,
    amount: number,
    exchangeId: string,
  ): Promise<void> {
    try {
      await tx.livingDaysAccount.upsert({
        where: { accountId: hostAccountId },
        create: { accountId: hostAccountId, balance: amount },
        update: { balance: { increment: amount } },
      });
    } catch (error) {
      if (!isUniqueConflict(error)) {
        throw error;
      }
      await tx.livingDaysAccount.update({
        where: { accountId: hostAccountId },
        data: { balance: { increment: amount } },
      });
    }

    await tx.livingDaysLedgerEntry.create({
      data: {
        accountId: hostAccountId,
        exchangeId,
        direction: LivingDaysDirection.EARNED,
        amount,
      },
    });
  }

  private async lockOpenExchange(
    tx: Tx,
    exchangeId: string,
  ): Promise<LivingExchange> {
    await tx.$queryRaw`
      SELECT "id" FROM "living_exchanges" WHERE "id" = ${exchangeId} FOR UPDATE
    `;
    const exchange = await tx.livingExchange.findUnique({
      where: { id: exchangeId },
    });
    if (!exchange || exchange.status !== LivingExchangeStatus.OPEN) {
      throw this.notOpen();
    }
    return exchange;
  }

  private async markClosed(
    tx: Tx,
    exchangeId: string,
    data: {
      status: LivingExchangeStatus;
      actualDays?: number;
    },
  ): Promise<void> {
    const updated = await tx.livingExchange.updateMany({
      where: { id: exchangeId, status: LivingExchangeStatus.OPEN },
      data: {
        status: data.status,
        actualDays: data.actualDays,
        closedAt: new Date(),
      },
    });
    if (updated.count !== 1) {
      throw this.notOpen();
    }
  }

  private async lockBenefitPackage(tx: Tx, accountId: string): Promise<void> {
    await tx.$queryRaw`
      SELECT "id" FROM "benefit_packages"
      WHERE "account_id" = ${accountId}
        AND "code"::text = 'FIRST_LIVING_EXCHANGE'
      FOR UPDATE
    `;
  }

  private async lockLivingDaysAccount(
    tx: Tx,
    accountId: string,
  ): Promise<void> {
    await tx.$queryRaw`
      SELECT "account_id" FROM "living_days_accounts"
      WHERE "account_id" = ${accountId}
      FOR UPDATE
    `;
  }

  private notApplicable(): BusinessException {
    return new BusinessException(
      LivingDaysErrorCode.BENEFIT_PACKAGE_NOT_APPLICABLE,
      '当前不能使用首次交换权益包',
      HttpStatus.BAD_REQUEST,
    );
  }

  private alreadyOpen(): BusinessException {
    return new BusinessException(
      LivingDaysErrorCode.BENEFIT_PACKAGE_ALREADY_OPEN,
      '已有进行中的权益包订单',
      HttpStatus.CONFLICT,
    );
  }

  private insufficient(): BusinessException {
    return new BusinessException(
      LivingDaysErrorCode.INSUFFICIENT_LIVING_DAYS,
      '可用 Living Days 不足',
      HttpStatus.CONFLICT,
    );
  }

  private notOpen(): BusinessException {
    return new BusinessException(
      LivingDaysErrorCode.EXCHANGE_NOT_OPEN,
      '订单不在进行中',
      HttpStatus.CONFLICT,
    );
  }

  private actualDaysExceedSelected(): BusinessException {
    return new BusinessException(
      LivingDaysErrorCode.ACTUAL_DAYS_EXCEED_SELECTED,
      '实际天数不能超过所选天数',
      HttpStatus.BAD_REQUEST,
    );
  }
}
