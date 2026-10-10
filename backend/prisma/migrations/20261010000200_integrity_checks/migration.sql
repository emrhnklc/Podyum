-- Prisma şemasının ifade edemediği satır içi kurallar.
ALTER TABLE "Friendship" ADD CONSTRAINT "friendship_canonical_pair"
  CHECK ("userAId" < "userBId");
ALTER TABLE "Friendship" ADD CONSTRAINT "friendship_requester_in_pair"
  CHECK ("requesterId" IN ("userAId", "userBId"));
ALTER TABLE "Block" ADD CONSTRAINT "block_not_self"
  CHECK ("blockerId" <> "blockedId");
ALTER TABLE "Poll" ADD CONSTRAINT "poll_duration_supported"
  CHECK ("durationSeconds" IN (1800, 7200, 86400));
ALTER TABLE "Poll" ADD CONSTRAINT "poll_published_deadline"
  CHECK ("status" NOT IN ('OPEN', 'CLOSED') OR
    ("publishedAt" IS NOT NULL AND "closesAt" IS NOT NULL AND "closesAt" > "publishedAt"));
ALTER TABLE "Poll" ADD CONSTRAINT "poll_version_nonnegative" CHECK ("version" >= 0);
ALTER TABLE "PollOption" ADD CONSTRAINT "poll_option_position_range"
  CHECK ("position" BETWEEN 1 AND 4);
ALTER TABLE "ProductTag" ADD CONSTRAINT "product_price_nonnegative"
  CHECK ("priceMinor" IS NULL OR "priceMinor" >= 0);
ALTER TABLE "MediaAsset" ADD CONSTRAINT "media_positive_dimensions"
  CHECK (("width" IS NULL OR "width" > 0) AND
         ("height" IS NULL OR "height" > 0) AND
         ("byteSize" IS NULL OR "byteSize" > 0));
ALTER TABLE "MediaAsset" ADD CONSTRAINT "media_ready_has_display"
  CHECK ("status" <> 'READY' OR "displayKey" IS NOT NULL);
ALTER TABLE "GameRoom" ADD CONSTRAINT "room_player_bounds"
  CHECK ("minPlayers" >= 3 AND "maxPlayers" <= 8 AND "minPlayers" <= "maxPlayers");
ALTER TABLE "GameRoom" ADD CONSTRAINT "room_durations_positive"
  CHECK ("preparationSeconds" > 0 AND "roundSeconds" > 0 AND "processingSeconds" > 0);
ALTER TABLE "GameRoom" ADD CONSTRAINT "room_qualified_bounds"
  CHECK ("qualifiedCount" BETWEEN 0 AND "maxPlayers");
ALTER TABLE "GameRoom" ADD CONSTRAINT "room_version_nonnegative" CHECK ("version" >= 0);
ALTER TABLE "GameRoom" ADD CONSTRAINT "room_active_phase_has_deadline"
  CHECK ("status" NOT IN ('PREPARING', 'PROCESSING', 'VOTING') OR "phaseEndsAt" IS NOT NULL);
ALTER TABLE "GameRound" ADD CONSTRAINT "round_position_range" CHECK ("position" BETWEEN 1 AND 8);
ALTER TABLE "GameRound" ADD CONSTRAINT "round_open_deadline"
  CHECK ("status" = 'PENDING' OR
    ("opensAt" IS NOT NULL AND "closesAt" IS NOT NULL AND "closesAt" > "opensAt"));
ALTER TABLE "GameRating" ADD CONSTRAINT "rating_stars_range" CHECK ("stars" BETWEEN 1 AND 5);
ALTER TABLE "GameRating" ADD CONSTRAINT "rating_not_self" CHECK ("voterId" <> "targetUserId");
ALTER TABLE "GameResult" ADD CONSTRAINT "result_counts_consistent"
  CHECK ("ratingCount" >= 0 AND "ratingSum" BETWEEN "ratingCount" AND 5 * "ratingCount"
    AND "themeYesCount" BETWEEN 0 AND "ratingCount"
    AND (NOT "quorumMet" OR "ratingCount" > 0)
    AND ("rank" IS NULL OR "rank" > 0));
ALTER TABLE "PointsLedger" ADD CONSTRAINT "points_delta_nonzero" CHECK ("delta" <> 0);
ALTER TABLE "OutboxEvent" ADD CONSTRAINT "outbox_counts_nonnegative"
  CHECK ("aggregateVersion" >= 0 AND "attempts" >= 0);
ALTER TABLE "IdempotencyRecord" ADD CONSTRAINT "idempotency_success_response"
  CHECK ("responseCode" BETWEEN 200 AND 299);
