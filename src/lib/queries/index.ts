/**
 * DB へのアクセスはすべてこの配下に集める。画面は snake_case を知らなくて済むよう、
 * ここで camelCase に直す。**画面から supabase を直接呼ばないこと。**
 *
 * 行の絞り込みは RLS が DB 側で行うので、ここで「自分の子かどうか」等を
 * 条件に足さない。二重に書くと、片方だけ直したときに食い違う。
 *
 * ファイルは扱う対象で分ける（1ファイル 300行を超えさせない）。
 *   master.ts   事業・開催枠・コース・締め切り
 *   students.ts 生徒・月謝
 *   schedule.ts コマ・希望・出席・授業記録
 *   staff.ts    講師・時給・交通費・給与
 *   requests.ts 時間外勤務・欠席連絡・進級
 *   announcements.ts お知らせ
 *   notifications.ts 通知（読むだけ。作るのは DB のトリガー）
 */

export * from './master';
export * from './students';
export * from './schedule';
export * from './staff';
export * from './requests';
export * from './announcements';
export * from './notifications';
