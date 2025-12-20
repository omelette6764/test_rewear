import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

type CreateAddressInput = {
  name: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string | null;
  makeDefault?: boolean;
};

type UpdateAddressInput = Partial<CreateAddressInput>;

@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, input: CreateAddressInput) {
    return await this.prisma.$transaction(async (tx) => {
      const makeDefault = !!input.makeDefault;

      if (makeDefault) {
        await tx.address.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        });
      }

      // If user has no addresses yet, force default.
      const existingCount = await tx.address.count({ where: { userId } });
      const isDefault = makeDefault || existingCount === 0;

      const addr = await tx.address.create({
        data: {
          userId,
          name: input.name,
          line1: input.line1,
          line2: input.line2 ?? null,
          city: input.city,
          state: input.state,
          postalCode: input.postalCode,
          country: input.country,
          phone: input.phone ?? null,
          isDefault,
        },
      });

      return this.toDto(addr);
    });
  }

  async list(userId: string) {
    const addrs = await this.prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });
    return addrs.map((a) => this.toDto(a));
  }

  async update(userId: string, id: string, input: UpdateAddressInput) {
    const addr = await this.prisma.address.findUnique({ where: { id } });
    if (!addr) throw new NotFoundException("Address not found");
    if (addr.userId !== userId) throw new ForbiddenException("Not your address");

    // We do not allow setting default via PATCH; use /default endpoint for clarity.
    const updated = await this.prisma.address.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.line1 !== undefined ? { line1: input.line1 } : {}),
        ...(input.line2 !== undefined ? { line2: input.line2 ?? null } : {}),
        ...(input.city !== undefined ? { city: input.city } : {}),
        ...(input.state !== undefined ? { state: input.state } : {}),
        ...(input.postalCode !== undefined ? { postalCode: input.postalCode } : {}),
        ...(input.country !== undefined ? { country: input.country } : {}),
        ...(input.phone !== undefined ? { phone: input.phone ?? null } : {}),
      },
    });

    return this.toDto(updated);
  }

  async remove(userId: string, id: string) {
    const addr = await this.prisma.address.findUnique({ where: { id } });
    if (!addr) throw new NotFoundException("Address not found");
    if (addr.userId !== userId) throw new ForbiddenException("Not your address");

    return await this.prisma.$transaction(async (tx) => {
      const wasDefault = addr.isDefault;

      await tx.address.delete({ where: { id } });

      // If they deleted the default, promote the newest remaining address to default.
      if (wasDefault) {
        const newest = await tx.address.findFirst({
          where: { userId },
          orderBy: { createdAt: "desc" },
        });
        if (newest) {
          await tx.address.update({ where: { id: newest.id }, data: { isDefault: true } });
        }
      }

      return { ok: true as const };
    });
  }

  async setDefault(userId: string, id: string) {
    const addr = await this.prisma.address.findUnique({ where: { id } });
    if (!addr) throw new NotFoundException("Address not found");
    if (addr.userId !== userId) throw new ForbiddenException("Not your address");

    return await this.prisma.$transaction(async (tx) => {
      await tx.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });

      const updated = await tx.address.update({
        where: { id },
        data: { isDefault: true },
      });

      return this.toDto(updated);
    });
  }

  private toDto(a: any) {
    return {
      id: a.id,
      userId: a.userId,
      name: a.name,
      line1: a.line1,
      line2: a.line2,
      city: a.city,
      state: a.state,
      postalCode: a.postalCode,
      country: a.country,
      phone: a.phone,
      isDefault: a.isDefault,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    };
  }
}
