ALTER TABLE "words" ADD COLUMN "enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "words" ADD COLUMN "min_confidence" real;