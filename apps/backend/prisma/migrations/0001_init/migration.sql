-- CreateEnum
CREATE TYPE "RoleName" AS ENUM ('ADMIN', 'HANDLER');

-- CreateEnum
CREATE TYPE "ScreenStatus" AS ENUM ('UNREGISTERED', 'ACTIVE', 'MAINTENANCE', 'DISABLED');

-- CreateEnum
CREATE TYPE "Orientation" AS ENUM ('LANDSCAPE', 'PORTRAIT');

-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('IMAGE', 'VIDEO');

-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('TIMETABLE', 'ACHIEVEMENT', 'GENERAL', 'BIRTHDAY');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'LIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PlaylistStage" AS ENUM ('DRAFT', 'LIVE');

-- CreateEnum
CREATE TYPE "HistoryReason" AS ENUM ('REPLACED', 'REMOVED');

-- CreateEnum
CREATE TYPE "CommandStatus" AS ENUM ('PENDING', 'DELIVERED', 'ACKED', 'EXPIRED');

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" "RoleName" NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Screen" (
    "id" TEXT NOT NULL,
    "screenKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "orientation" "Orientation" NOT NULL DEFAULT 'LANDSCAPE',
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "devicePixelRatio" DOUBLE PRECISION,
    "status" "ScreenStatus" NOT NULL DEFAULT 'ACTIVE',
    "maintenanceUntil" TIMESTAMP(3),
    "screenGroupId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Screen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScreenHandler" (
    "id" TEXT NOT NULL,
    "screenId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScreenHandler_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScreenGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScreenGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PairingRequest" (
    "id" TEXT NOT NULL,
    "pairingCode" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "devicePixelRatio" DOUBLE PRECISION,
    "orientation" "Orientation" NOT NULL,
    "userAgent" TEXT,
    "platform" TEXT,
    "claimed" BOOLEAN NOT NULL DEFAULT false,
    "screenId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PairingRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceCredential" (
    "id" TEXT NOT NULL,
    "screenId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastAuthAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaObject" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "kind" "MediaKind" NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "durationSec" DOUBLE PRECISION,
    "checksum" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaObject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Content" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "ContentType" NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "defaultDurationSec" INTEGER NOT NULL DEFAULT 15,
    "ownerId" TEXT NOT NULL,
    "mediaObjectId" TEXT NOT NULL,
    "birthdayInstanceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Content_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Playlist" (
    "id" TEXT NOT NULL,
    "screenId" TEXT NOT NULL,
    "liveVersion" INTEGER NOT NULL DEFAULT 0,
    "livePublishedAt" TIMESTAMP(3),
    "draftUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Playlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlaylistItem" (
    "id" TEXT NOT NULL,
    "playlistId" TEXT NOT NULL,
    "stage" "PlaylistStage" NOT NULL,
    "position" INTEGER NOT NULL,
    "durationSec" INTEGER NOT NULL,
    "contentId" TEXT NOT NULL,

    CONSTRAINT "PlaylistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentHistory" (
    "id" TEXT NOT NULL,
    "originalContentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "ContentType" NOT NULL,
    "ownerId" TEXT NOT NULL,
    "mediaObjectId" TEXT NOT NULL,
    "screenId" TEXT NOT NULL,
    "durationSec" INTEGER NOT NULL,
    "reason" "HistoryReason" NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "restoredAt" TIMESTAMP(3),

    CONSTRAINT "ContentHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "studentCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dateOfBirth" DATE NOT NULL,
    "batch" TEXT,
    "course" TEXT,
    "photoMediaId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "birthMonth" INTEGER NOT NULL,
    "birthDay" INTEGER NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BirthdayTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "design" JSONB NOT NULL,
    "defaultDurationSec" INTEGER NOT NULL DEFAULT 10,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BirthdayTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BirthdayInstance" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "forDate" DATE NOT NULL,
    "screenId" TEXT,
    "screenGroupId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BirthdayInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceHeartbeat" (
    "id" TEXT NOT NULL,
    "screenId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "currentContent" TEXT,
    "playerVersion" TEXT,
    "resolution" TEXT,
    "orientation" TEXT,
    "cacheBytes" INTEGER,
    "cachedItems" INTEGER,
    "online" BOOLEAN NOT NULL DEFAULT true,
    "wsConnected" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceHeartbeat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceCommand" (
    "id" TEXT NOT NULL,
    "screenId" TEXT NOT NULL,
    "command" TEXT NOT NULL,
    "payload" JSONB,
    "status" "CommandStatus" NOT NULL DEFAULT 'PENDING',
    "issuedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    "ackedAt" TIMESTAMP(3),

    CONSTRAINT "DeviceCommand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorType" TEXT NOT NULL DEFAULT 'USER',
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "metadata" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_roleId_idx" ON "User"("roleId");

-- CreateIndex
CREATE INDEX "User_active_idx" ON "User"("active");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Screen_screenKey_key" ON "Screen"("screenKey");

-- CreateIndex
CREATE INDEX "Screen_screenKey_idx" ON "Screen"("screenKey");

-- CreateIndex
CREATE INDEX "Screen_status_idx" ON "Screen"("status");

-- CreateIndex
CREATE INDEX "Screen_screenGroupId_idx" ON "Screen"("screenGroupId");

-- CreateIndex
CREATE INDEX "ScreenHandler_userId_idx" ON "ScreenHandler"("userId");

-- CreateIndex
CREATE INDEX "ScreenHandler_screenId_idx" ON "ScreenHandler"("screenId");

-- CreateIndex
CREATE UNIQUE INDEX "ScreenHandler_screenId_userId_key" ON "ScreenHandler"("screenId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ScreenGroup_name_key" ON "ScreenGroup"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PairingRequest_pairingCode_key" ON "PairingRequest"("pairingCode");

-- CreateIndex
CREATE INDEX "PairingRequest_pairingCode_idx" ON "PairingRequest"("pairingCode");

-- CreateIndex
CREATE INDEX "PairingRequest_expiresAt_idx" ON "PairingRequest"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceCredential_screenId_key" ON "DeviceCredential"("screenId");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceCredential_tokenHash_key" ON "DeviceCredential"("tokenHash");

-- CreateIndex
CREATE INDEX "DeviceCredential_tokenHash_idx" ON "DeviceCredential"("tokenHash");

-- CreateIndex
CREATE INDEX "MediaObject_storageKey_idx" ON "MediaObject"("storageKey");

-- CreateIndex
CREATE UNIQUE INDEX "Content_birthdayInstanceId_key" ON "Content"("birthdayInstanceId");

-- CreateIndex
CREATE INDEX "Content_ownerId_idx" ON "Content"("ownerId");

-- CreateIndex
CREATE INDEX "Content_status_idx" ON "Content"("status");

-- CreateIndex
CREATE INDEX "Content_type_idx" ON "Content"("type");

-- CreateIndex
CREATE UNIQUE INDEX "Playlist_screenId_key" ON "Playlist"("screenId");

-- CreateIndex
CREATE INDEX "Playlist_screenId_idx" ON "Playlist"("screenId");

-- CreateIndex
CREATE INDEX "PlaylistItem_playlistId_stage_idx" ON "PlaylistItem"("playlistId", "stage");

-- CreateIndex
CREATE INDEX "PlaylistItem_contentId_idx" ON "PlaylistItem"("contentId");

-- CreateIndex
CREATE UNIQUE INDEX "PlaylistItem_playlistId_stage_position_key" ON "PlaylistItem"("playlistId", "stage", "position");

-- CreateIndex
CREATE INDEX "ContentHistory_ownerId_idx" ON "ContentHistory"("ownerId");

-- CreateIndex
CREATE INDEX "ContentHistory_expiresAt_idx" ON "ContentHistory"("expiresAt");

-- CreateIndex
CREATE INDEX "ContentHistory_screenId_idx" ON "ContentHistory"("screenId");

-- CreateIndex
CREATE INDEX "ContentHistory_originalContentId_idx" ON "ContentHistory"("originalContentId");

-- CreateIndex
CREATE UNIQUE INDEX "Student_studentCode_key" ON "Student"("studentCode");

-- CreateIndex
CREATE INDEX "Student_birthMonth_birthDay_idx" ON "Student"("birthMonth", "birthDay");

-- CreateIndex
CREATE INDEX "Student_active_idx" ON "Student"("active");

-- CreateIndex
CREATE INDEX "BirthdayInstance_forDate_idx" ON "BirthdayInstance"("forDate");

-- CreateIndex
CREATE INDEX "BirthdayInstance_studentId_idx" ON "BirthdayInstance"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "BirthdayInstance_studentId_forDate_screenId_screenGroupId_key" ON "BirthdayInstance"("studentId", "forDate", "screenId", "screenGroupId");

-- CreateIndex
CREATE INDEX "DeviceHeartbeat_screenId_createdAt_idx" ON "DeviceHeartbeat"("screenId", "createdAt");

-- CreateIndex
CREATE INDEX "DeviceCommand_screenId_status_idx" ON "DeviceCommand"("screenId", "status");

-- CreateIndex
CREATE INDEX "ActivityLog_actorId_idx" ON "ActivityLog"("actorId");

-- CreateIndex
CREATE INDEX "ActivityLog_action_idx" ON "ActivityLog"("action");

-- CreateIndex
CREATE INDEX "ActivityLog_entityType_entityId_idx" ON "ActivityLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Screen" ADD CONSTRAINT "Screen_screenGroupId_fkey" FOREIGN KEY ("screenGroupId") REFERENCES "ScreenGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreenHandler" ADD CONSTRAINT "ScreenHandler_screenId_fkey" FOREIGN KEY ("screenId") REFERENCES "Screen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreenHandler" ADD CONSTRAINT "ScreenHandler_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceCredential" ADD CONSTRAINT "DeviceCredential_screenId_fkey" FOREIGN KEY ("screenId") REFERENCES "Screen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Content" ADD CONSTRAINT "Content_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Content" ADD CONSTRAINT "Content_mediaObjectId_fkey" FOREIGN KEY ("mediaObjectId") REFERENCES "MediaObject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Content" ADD CONSTRAINT "Content_birthdayInstanceId_fkey" FOREIGN KEY ("birthdayInstanceId") REFERENCES "BirthdayInstance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Playlist" ADD CONSTRAINT "Playlist_screenId_fkey" FOREIGN KEY ("screenId") REFERENCES "Screen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaylistItem" ADD CONSTRAINT "PlaylistItem_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "Playlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaylistItem" ADD CONSTRAINT "PlaylistItem_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentHistory" ADD CONSTRAINT "ContentHistory_mediaObjectId_fkey" FOREIGN KEY ("mediaObjectId") REFERENCES "MediaObject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BirthdayInstance" ADD CONSTRAINT "BirthdayInstance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BirthdayInstance" ADD CONSTRAINT "BirthdayInstance_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "BirthdayTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BirthdayInstance" ADD CONSTRAINT "BirthdayInstance_screenId_fkey" FOREIGN KEY ("screenId") REFERENCES "Screen"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BirthdayInstance" ADD CONSTRAINT "BirthdayInstance_screenGroupId_fkey" FOREIGN KEY ("screenGroupId") REFERENCES "ScreenGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceHeartbeat" ADD CONSTRAINT "DeviceHeartbeat_screenId_fkey" FOREIGN KEY ("screenId") REFERENCES "Screen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceCommand" ADD CONSTRAINT "DeviceCommand_screenId_fkey" FOREIGN KEY ("screenId") REFERENCES "Screen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

