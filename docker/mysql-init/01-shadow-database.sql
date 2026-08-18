-- Prisma's local `prisma migrate dev` workflow needs a shadow database to
-- detect schema drift. The `home4u` application user is intentionally
-- scoped to only the `home4u` schema (see .env.example), so the shadow
-- database is created here and used only via the root-authenticated
-- SHADOW_DATABASE_URL for local development migrations.
CREATE DATABASE IF NOT EXISTS home4u_shadow;
