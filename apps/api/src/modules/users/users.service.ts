import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

type UpdateMeInput = {
  displayName?: string;
  avatarUrl?: string | null;
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        createdAt: true,
        isBanned: true,
        stripeSeller: {
          select: {
            accountId: true,
            chargesEnabled: true,
            payoutsEnabled: true,
            detailsSubmitted: true,
          },
        },
      },
    });

    if (!user) throw new NotFoundException("User not found");
    if (user.isBanned) throw new ForbiddenException("Account disabled");

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt.toISOString(),
      stripeSellerStatus: user.stripeSeller
        ? {
            hasAccount: true,
            chargesEnabled: user.stripeSeller.chargesEnabled,
            payoutsEnabled: user.stripeSeller.payoutsEnabled,
            detailsSubmitted: user.stripeSeller.detailsSubmitted,
          }
        : { hasAccount: false },
    };
  }

  async updateMe(userId: string, input: UpdateMeInput) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isBanned: true },
    });
    if (!user) throw new NotFoundException("User not found");
    if (user.isBanned) throw new ForbiddenException("Account disabled");

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
        ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        createdAt: true,
        stripeSeller: {
          select: {
            accountId: true,
            chargesEnabled: true,
            payoutsEnabled: true,
            detailsSubmitted: true,
          },
        },
      },
    });

    return {
      id: updated.id,
      email: updated.email,
      displayName: updated.displayName,
      avatarUrl: updated.avatarUrl,
      createdAt: updated.createdAt.toISOString(),
      stripeSellerStatus: updated.stripeSeller
        ? {
            hasAccount: true,
            chargesEnabled: updated.stripeSeller.chargesEnabled,
            payoutsEnabled: updated.stripeSeller.payoutsEnabled,
            detailsSubmitted: updated.stripeSeller.detailsSubmitted,
          }
        : { hasAccount: false },
    };
  }

  /**
   * Simple MVP summary:
   * - chats: number of chats the user participates in (last 7 days activity isn’t tracked yet)
   * - likes: favorites created in last 7 days
   * - orders: orders updated in last 7 days where user is buyer or seller
   */
  async getActivitySummary(userId: string) {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [recentChatsCount, recentLikesCount, recentOrdersCount] = await Promise.all([
      this.prisma.chatParticipant.count({ where: { userId } }),
      this.prisma.favorite.count({ where: { userId, createdAt: { gte: since } } }),
      this.prisma.order.count({
        where: {
          updatedAt: { gte: since },
          OR: [{ buyerId: userId }, { sellerId: userId }],
        },
      }),
    ]);

    return {
      recentChatsCount,
      recentLikesCount,
      recentOrdersCount,
    };
  }
}
