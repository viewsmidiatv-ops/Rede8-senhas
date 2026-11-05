import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const owner = sqliteTable('queue_owner', {
  key: integer('key').primaryKey(), userId: text('user_id').notNull(),
});
export const members = sqliteTable('queue_members', {
  email: text('email').primaryKey(), userId: text('user_id'),
  role: text('role').notNull(), enabled: integer('enabled').notNull().default(1),
});
export const queueState = sqliteTable('queue_state', {
  key: integer('key').primaryKey(), revision: integer('revision').notNull().default(0), payload: text('payload').notNull(),
});
