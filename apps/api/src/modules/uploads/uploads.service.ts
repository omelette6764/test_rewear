import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { env } from "../../config/env";
import crypto from "crypto";
import path from "path";
import fs from "fs/promises";
import type { Request } from "express";

type CreateImageUploadInput = {
  kind: "listing_photo" | "chat_image" | "avatar";
  fileName: string;
  contentType: string;
  sizeBytes: number;
};

type UploadTokenPayload = {
  userId: string;
  mediaId: string;
  expMs: number;
};

@Injectable()
export class UploadsService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------- Token helpers (presigned-style) ----------------

  private sign(payloadB64: string) {
    return crypto.createHmac("sha256", env().JWT_SECRET).update(payloadB64).digest("base64url");
  }

  private makeUploadToken(payload: UploadTokenPayload): string {
    const payloadJson = JSON.stringify(payload);
    const payloadB64 = Buffer.from(payloadJson, "utf8").toString("base64url");
    const sig = this.sign(payloadB64);
    return `${payloadB64}.${sig}`;
  }

  private verifyUploadToken(token: string): UploadTokenPayload {
    const [payloadB64, sig] = (token || "").split(".");
    if (!payloadB64 || !sig) throw new BadRequestException("Missing upload token");

    const expected = this.sign(payloadB64);
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      throw new ForbiddenException("Invalid upload token");
    }

    const payloadJson = Buffer.from(payloadB64, "base64url").toString("utf8");
    const payload = JSON.parse(payloadJson) as UploadTokenPayload;

    if (!payload?.userId || !payload?.mediaId || !payload?.expMs) {
      throw new ForbiddenException("Invalid upload token");
    }
    if (Date.now() > payload.expMs) {
      throw new ForbiddenException("Upload token expired");
    }
    return payload;
  }

  // ---------------- Create upload ----------------

  async createImageUpload(userId: string, input: CreateImageUploadInput) {
    const e = env();

    // Basic checks (you can add image-only allowlist later)
    if (input.sizeBytes > e.MAX_UPLOAD_BYTES) {
      throw new BadRequestException({
        error: { code: "UPLOAD_TOO_LARGE", message: `Max upload is ${e.MAX_UPLOAD_BYTES} bytes` },
      });
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { isBanned: true } });
    if (!user) throw new NotFoundException("User not found");
    if (user.isBanned) throw new ForbiddenException("Account disabled");

    // Create a Media row now. We'll set url once file is stored.
    const media = await this.prisma.media.create({
      data: {
        userId,
        kind: input.kind,
        url: `${e.APP_BASE_URL}/v1/uploads/media/${"pending"}`, // placeholder (we overwrite on upload)
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
      },
      select: { id: true },
    });

    const publicBase = e.UPLOAD_PUBLIC_BASE_URL || e.APP_BASE_URL;
    const publicUrl = `${publicBase}/v1/uploads/media/${media.id}`;

    // In dev-local mode, “uploadUrl” is our own API PUT endpoint with a signed token (presigned-like).
    const token = this.makeUploadToken({
      userId,
      mediaId: media.id,
      expMs: Date.now() + 15 * 60 * 1000, // 15 minutes
    });

    const uploadUrl = `${e.APP_BASE_URL}/v1/uploads/local/${media.id}?token=${encodeURIComponent(token)}`;

    return {
      mediaId: media.id,
      uploadUrl,
      publicUrl,
    };
  }

  // ---------------- Local PUT handler ----------------

  async handleLocalPut(args: { mediaId: string; token: string; req: Request; contentType: string }) {
    const e = env();
    const { mediaId, token, req, contentType } = args;

    const payload = this.verifyUploadToken(token);
    if (payload.mediaId !== mediaId) throw new ForbiddenException("Token does not match mediaId");

    const media = await this.prisma.media.findUnique({
      where: { id: mediaId },
      select: { id: true, userId: true, uploadedAt: true, kind: true },
    });
    if (!media) throw new NotFoundException("Media not found");
    if (media.userId !== payload.userId) throw new ForbiddenException("Not your media");

    // Idempotent: if already uploaded, return current state.
    if (media.uploadedAt) {
      const publicBase = e.UPLOAD_PUBLIC_BASE_URL || e.APP_BASE_URL;
      return {
        mediaId,
        uploadedAt: media.uploadedAt.toISOString(),
        publicUrl: `${publicBase}/v1/uploads/media/${mediaId}`,
      };
    }

    const bytes = await this.readRequestBody(req, e.MAX_UPLOAD_BYTES);
    const ext = this.guessExtension(contentType);
    const fileName = `${mediaId}${ext}`;
    const dir = path.resolve(process.cwd(), e.LOCAL_UPLOAD_DIR);
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, fileName);
    await fs.writeFile(filePath, bytes);

    // For dev: we store a file:// URL so you can verify where it is.
    // Later, when you add ServeStaticModule or CDN, you’ll change this to a public https URL.
    const storedUrl = `file://${filePath}`;

    const updated = await this.prisma.media.update({
      where: { id: mediaId },
      data: {
        url: storedUrl,
        contentType,
        sizeBytes: bytes.length,
        uploadedAt: new Date(),
      },
      select: { id: true, uploadedAt: true },
    });

    const publicBase = e.UPLOAD_PUBLIC_BASE_URL || e.APP_BASE_URL;
    return {
      mediaId,
      uploadedAt: updated.uploadedAt.toISOString(),
      publicUrl: `${publicBase}/v1/uploads/media/${mediaId}`,
    };
  }

  // ---------------- Complete (for S3/R2 later; idempotent) ----------------

  async complete(userId: string, mediaId: string) {
    const e = env();

    const media = await this.prisma.media.findUnique({
      where: { id: mediaId },
      select: { id: true, userId: true, uploadedAt: true, url: true },
    });
    if (!media) throw new NotFoundException("Media not found");
    if (media.userId !== userId) throw new ForbiddenException("Not your media");

    if (media.uploadedAt) {
      return {
        mediaId,
        uploadedAt: media.uploadedAt.toISOString(),
        publicUrl: `${(e.UPLOAD_PUBLIC_BASE_URL || e.APP_BASE_URL)}/v1/uploads/media/${mediaId}`,
      };
    }

    const updated = await this.prisma.media.update({
      where: { id: mediaId },
      data: { uploadedAt: new Date() },
      select: { uploadedAt: true },
    });

    return {
      mediaId,
      uploadedAt: updated.uploadedAt.toISOString(),
      publicUrl: `${(e.UPLOAD_PUBLIC_BASE_URL || e.APP_BASE_URL)}/v1/uploads/media/${mediaId}`,
    };
  }

  // ---------------- Helpers ----------------

  private async readRequestBody(req: Request, maxBytes: number): Promise<Buffer> {
    const chunks: Buffer[] = [];
    let total = 0;

    for await (const chunk of req) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      total += buf.length;
      if (total > maxBytes) {
        throw new BadRequestException({
          error: { code: "UPLOAD_TOO_LARGE", message: `Max upload is ${maxBytes} bytes` },
        });
      }
      chunks.push(buf);
    }
    return Buffer.concat(chunks);
  }

  private guessExtension(contentType: string) {
    const ct = contentType.toLowerCase();
    if (ct.includes("jpeg") || ct.includes("jpg")) return ".jpg";
    if (ct.includes("png")) return ".png";
    if (ct.includes("webp")) return ".webp";
    if (ct.includes("heic")) return ".heic";
    return "";
  }
}