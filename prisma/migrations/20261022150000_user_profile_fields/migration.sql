-- Add optional auth mapping for existing local users and scheduling/display defaults.
ALTER TABLE "User"
    ADD COLUMN "authSubject" TEXT,
    ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'UTC',
    ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'en';

CREATE UNIQUE INDEX "User_authSubject_key" ON "User"("authSubject");
