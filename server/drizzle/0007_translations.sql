ALTER TABLE "submissions" ADD COLUMN "message_code" text;--> statement-breakpoint
ALTER TABLE "words" ADD COLUMN "translations" jsonb DEFAULT '{}'::jsonb NOT NULL;