import { Body, Controller, Delete, Get, Headers, HttpCode, Param, Post, Put, Query, StreamableFile, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type {} from "multer";
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiCreatedResponse, ApiHeader, ApiOkResponse, ApiOperation, ApiProduces, ApiTags } from "@nestjs/swagger";
import type { AuthenticatedUser } from "../../common/http/request-context.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { AcceptPreviewDto, CompleteMediaDto, CreateUploadDto, MediaContentQueryDto, MediaIdParamsDto, SetAvatarDto } from "./dto/media.dto.js";
import { AvatarResponseDto, CreateUploadResponseDto, DeleteMediaResponseDto, MediaResponseDto } from "./dto/media-response.dto.js";
import { MEDIA_LIMITS } from "./media.constants.js";
import { MediaUploadGuard } from "./media-upload.guard.js";
import { MediaWorkInterceptor } from "./media-work.interceptor.js";
import { MediaService } from "./media.service.js";

@ApiTags("media")
@ApiBearerAuth()
@Controller()
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post("media/uploads")
  @ApiCreatedResponse({ type: CreateUploadResponseDto })
  @ApiOperation({ summary: "15 dakikalık, tek kullanımlık yerel yükleme izni oluştur" })
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateUploadDto) { return this.media.createUpload(user.userId, body); }

  @Post("media/:id/upload")
  @HttpCode(200)
  @UseGuards(MediaUploadGuard)
  @UseInterceptors(MediaWorkInterceptor, FileInterceptor("file", { limits: { fileSize: MEDIA_LIMITS.maxBytes, files: 1, fields: 0, parts: 1 } }))
  @ApiConsumes("multipart/form-data")
  @ApiHeader({ name: "X-Upload-Token", required: true })
  @ApiBody({ schema: { type: "object", required: ["file"], properties: { file: { type: "string", format: "binary" } } } })
  @ApiOkResponse({ type: MediaResponseDto })
  upload(@CurrentUser() user: AuthenticatedUser, @Param() params: MediaIdParamsDto,
    @Headers("x-upload-token") token: string, @UploadedFile() file?: Express.Multer.File) {
    return this.media.upload(user.userId, params.id, token, file);
  }

  @Post("media/:id/complete")
  @HttpCode(200)
  @UseInterceptors(MediaWorkInterceptor)
  @ApiOkResponse({ type: MediaResponseDto })
  @ApiOperation({ summary: "Tür/piksel/checksum doğrula; WebP ve thumbnail üret. Aynı parametreli tekrar güvenlidir." })
  complete(@CurrentUser() user: AuthenticatedUser, @Param() params: MediaIdParamsDto, @Body() body: CompleteMediaDto) {
    return this.media.complete(user.userId, params.id, body);
  }

  @Get("media/:id")
  @ApiOkResponse({ type: MediaResponseDto })
  @ApiOperation({ summary: "Yalnız sahibine işleme ve önizleme durumu" })
  get(@CurrentUser() user: AuthenticatedUser, @Param() params: MediaIdParamsDto) { return this.media.get(user.userId, params.id); }

  @Post("media/:id/accept-preview")
  @HttpCode(200)
  @ApiOkResponse({ type: MediaResponseDto })
  accept(@CurrentUser() user: AuthenticatedUser, @Param() params: MediaIdParamsDto, @Body() _body: AcceptPreviewDto) {
    return this.media.acceptPreview(user.userId, params.id);
  }

  @Get("media/:id/content")
  @ApiProduces("image/webp")
  @ApiOkResponse({ schema: { type: "string", format: "binary" }, description: "İşlenmiş fotoğraf; her istekte güncel erişim kontrolü, Cache-Control: no-store." })
  async content(@CurrentUser() user: AuthenticatedUser, @Param() params: MediaIdParamsDto, @Query() query: MediaContentQueryDto) {
    const buffer = await this.media.content(user.userId, params.id, query.variant);
    return new StreamableFile(buffer, { type: "image/webp", disposition: "inline", length: buffer.length });
  }

  @Delete("media/:id")
  @ApiOkResponse({ type: DeleteMediaResponseDto })
  delete(@CurrentUser() user: AuthenticatedUser, @Param() params: MediaIdParamsDto) { return this.media.delete(user.userId, params.id); }

  @Put("me/avatar")
  @ApiOkResponse({ type: AvatarResponseDto })
  @ApiOperation({ summary: "Kendi onaylanmış AVATAR fotoğrafını profile bağla" })
  avatar(@CurrentUser() user: AuthenticatedUser, @Body() body: SetAvatarDto) { return this.media.setAvatar(user.userId, body.mediaId); }

  @Delete("me/avatar")
  @ApiOkResponse({ type: AvatarResponseDto })
  removeAvatar(@CurrentUser() user: AuthenticatedUser) { return this.media.removeAvatar(user.userId); }
}
