import { Body, Controller, Param, Post, Put, Query, Req, Res, UseGuards } from "@nestjs/common";
import type { Request, Response } from "express";
import { JwtAuthGuard } from "../../common/auth/auth.guard";
import { CurrentUserId } from "../../common/auth/auth.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";

import { ZCreateUploadImageInput, ZUploadCompleteInput } from "@rewear/shared";
import { UploadsService } from "./uploads.service";

@Controller("uploads")
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  /**
   * Create a Media row + return an uploadUrl that the client can PUT bytes to.
   * This mirrors “presigned URL” style, but in dev we point to our own API.
   */
  @Post("images")
  @UseGuards(JwtAuthGuard)
  async createImage(
    @CurrentUserId() userId: string,
    @Body(new ZodValidationPipe(ZCreateUploadImageInput)) body: any,
  ) {
    return await this.uploads.createImageUpload(userId, body);
  }

  /**
   * Dev-local upload endpoint. The mobile app can:
   * - fetch(uploadUrl, { method:"PUT", headers:{ "Content-Type": ... }, body: fileBytes })
   *
   * Auth is via token (like a presigned URL), not JWT.
   */
  @Put("local/:mediaId")
  async localPut(
    @Param("mediaId") mediaId: string,
    @Query("token") token: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const contentType = req.headers["content-type"]?.toString() || "application/octet-stream";
    const result = await this.uploads.handleLocalPut({ mediaId, token, req, contentType });
    return res.status(200).json(result);
  }

  /**
   * For S3/R2 flows later: the client uploads to object storage, then calls complete.
   * For local PUT, we also allow calling this (idempotent).
   */
  @Post("complete")
  @UseGuards(JwtAuthGuard)
  async complete(
    @CurrentUserId() userId: string,
    @Body(new ZodValidationPipe(ZUploadCompleteInput)) body: any,
  ) {
    return await this.uploads.complete(userId, body.mediaId);
  }
}