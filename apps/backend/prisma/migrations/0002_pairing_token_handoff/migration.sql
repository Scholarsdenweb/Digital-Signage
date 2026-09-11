-- One-time device-token handoff columns on PairingRequest
ALTER TABLE "PairingRequest" ADD COLUMN "deviceToken" TEXT;
ALTER TABLE "PairingRequest" ADD COLUMN "tokenDeliveredAt" TIMESTAMP(3);
