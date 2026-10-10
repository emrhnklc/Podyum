import { Injectable } from "@nestjs/common";
import sharp, { type OverlayOptions } from "sharp";
import { ApiError } from "../../common/errors/api-error.js";
import type { BlurRegionDto } from "./dto/media.dto.js";
import { MEDIA_LIMITS } from "./media.constants.js";

const invalid = () => new ApiError(422, "INVALID_IMAGE", "Geçerli, tek kareli JPEG, PNG veya WebP fotoğrafı yükle.");
const formatMime: Record<string, string> = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

@Injectable()
export class ImageProcessor {
  async inspect(source: Buffer, declaredMime: string) {
    try {
      const meta = await sharp(source, { limitInputPixels: MEDIA_LIMITS.maxPixels, failOn: "warning" }).metadata();
      if (!meta.width || !meta.height || !meta.format || !formatMime[meta.format]
        || formatMime[meta.format] !== declaredMime || (meta.pages ?? 1) !== 1
        || meta.width > MEDIA_LIMITS.maxDimension || meta.height > MEDIA_LIMITS.maxDimension
        || meta.width * meta.height > MEDIA_LIMITS.maxPixels) throw invalid();
      return { width: meta.width, height: meta.height, mimeType: formatMime[meta.format] };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw invalid();
    }
  }

  async process(source: Buffer, purpose: "POLL" | "AVATAR" | "GAME", regions: BlurRegionDto[]) {
    try {
      // rotate() EXIF yönünü uygular. Yeni encode metadata/EXIF/GPS taşımaz.
      const normalized = await sharp(source, { limitInputPixels: MEDIA_LIMITS.maxPixels, failOn: "warning" })
        .rotate().flatten({ background: "#ffffff" }).toColourspace("srgb")
        .resize({ width: purpose === "AVATAR" ? 800 : MEDIA_LIMITS.displaySize, height: purpose === "AVATAR" ? 800 : MEDIA_LIMITS.displaySize, fit: "inside", withoutEnlargement: true })
        .png().toBuffer({ resolveWithObject: true });
      const { width, height } = normalized.info;
      const masks: OverlayOptions[] = [];
      const blurred = regions.length ? await sharp(normalized.data).blur(40).png().toBuffer() : null;
      for (const region of regions) {
        if (region.x + region.width > 1 || region.y + region.height > 1) {
          throw new ApiError(400, "INVALID_BLUR_REGION", "Bulanıklaştırma bölgesi fotoğraf sınırları içinde olmalı.");
        }
        const left = Math.min(width - 1, Math.floor(region.x * width));
        const top = Math.min(height - 1, Math.floor(region.y * height));
        const w = Math.min(width - left, Math.max(1, Math.ceil(region.width * width)));
        const h = Math.min(height - top, Math.max(1, Math.ceil(region.height * height)));
        // Örtüşen bölgelerin ikinci bir kesitle ilk maskeyi açmaması için her maske aynı
        // tamamen bulanık tabandan alınır; thumbnail da bu son görüntüden üretilir.
        const patch = await sharp(blurred!).extract({ left, top, width: w, height: h }).png().toBuffer();
        masks.push({ input: patch, left, top });
      }
      const display = await sharp(normalized.data).composite(masks).webp({ quality: 85 }).toBuffer();
      const thumbnail = await sharp(display).resize({ width: MEDIA_LIMITS.thumbnailSize, height: MEDIA_LIMITS.thumbnailSize, fit: "inside", withoutEnlargement: true }).webp({ quality: 75 }).toBuffer();
      return { display, thumbnail, width, height };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw invalid();
    }
  }
}
