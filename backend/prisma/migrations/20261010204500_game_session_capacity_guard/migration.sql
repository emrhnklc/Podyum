-- CHECK içindeki NULL, kapasite aralığı denetimini atlayamaz.
ALTER TABLE "GameSession" ADD CONSTRAINT "game_private_capacity_required"
  CHECK ("kind" <> 'PRIVATE' OR "maxMembers" IS NOT NULL);
ALTER TABLE "GameSession" ADD CONSTRAINT "game_theme_not_blank"
  CHECK (length(btrim("themeTitle")) > 0);
