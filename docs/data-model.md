# データモデル

**書く場所**: テーブル・カラム・制約・RLS・マイグレーション運用と、**そのテーブル設計を選んだ理由**。SQL を書く／変える前に必ずここを読む。

関連: [CLAUDE.md](../CLAUDE.md) ／ [domain.md](domain.md) ／ [architecture.md](architecture.md) ／ [decisions.md](decisions.md)

---

## テーブル設計

### マスタ（管理者が編集する）

| テーブル | 主なカラム | 備考 |
|---------|-----------|------|
| `businesses` | id, name, color_key, students_per_employee, active | 2件。`students_per_employee` の既定は 3 |
| `business_slots` | id, business_id, weekday (0=日〜6=土), slot_no, start_time, end_time, active | 開催曜日とコマ時間。プログラミング=日曜×2件、イラスト=土日×2件＝計6件 |
| `courses` | id, business_id, grade_label, **grade_min, grade_max**, sessions_per_month, monthly_fee, is_default, sort_order, active | 料金表。2事業 × 3学年区分 × 2回数 = 12件。`grade_min`/`grade_max` で学年から該当コースを自動判定する |

### ユーザー・生徒

| テーブル | 主なカラム | 備考 |
|---------|-----------|------|
| `users` | id, name, email, role (admin/parent/employee), active | |
| `students` | id, name, parent_id, business_id, course_id, **enrollment_year**, active | 生徒は1事業のみ。保護者は複数の生徒を持ちうる。`enrollment_year` = 小1になった年度。**学年カラムは持たない**（計算する） |
| `employee_businesses` | employee_id, business_id | 従業員が担当できる事業（両方あり得るので多対多） |

### 希望・スケジュール

| テーブル | 主なカラム | 備考 |
|---------|-----------|------|
| `preferences` | id, student_id, year_month, session_date, slot_no | 受講希望 |
| `work_preferences` | id, employee_id, business_id, year_month, session_date, slot_no | 勤務希望。日曜は事業が並ぶので `business_id` が要る |
| `schedules` | id, business_id, session_date, slot_no, status (draft/confirmed) | 事業 × 日付 × コマ で一意 |
| `schedule_employees` | schedule_id, employee_id | 担当従業員（複数）。定員はこの件数で決まる |
| `schedule_students` | schedule_id, student_id, attendance_status (present/absent/late), marked_at, marked_by, **note, noted_at, noted_by** | 受講生徒 + 出席状態 + 授業記録。**出欠と記録は同じ1行**。`attendance_status` が null = 未マーク、`note` が null = 所見未記入 |
| `absence_reports` | id, student_id, schedule_id, reason, created_at, **handled_at, handled_by** | 欠席連絡。`handled_at` が null = 管理者が未確認（受信ボックスの「要対応」） |

### その他

| テーブル | 主なカラム |
|---------|-----------|
| `fees` | id, student_id, year_month, amount, status, paid_date, note ／ `amount` は生成時にコースの月額が入るが **管理者が上書きできる**。手入力した理由は `note` に残す |
| `announcements` | id, title, body, author_id, target_role, business_id (null=全体), created_at, **scheduled_at, sent_at** ／ 予約投稿用。`sent_at` が null かつ `scheduled_at` が未来 = 予約中で、対象者にはまだ見せない。送信は `pg_cron` で定期的に拾う |
| `deadline_rules` | id, type (parent/employee), day_of_month, time_of_day, active ／ **2行だけ**。「対象月の前月◯日◯時」の繰り返しルール。ここから `deadlines` を毎月生成する |
| `deadlines` | id, year_month, type (parent/employee), deadline_at, **active** ／ **事業共通**なので business_id は持たない。`deadline_rules` から**対象月の前月1日に自動生成**される。`active=false` = その月は受け付けない |
| `notifications` | id, user_id, type, title, body, read_at, created_at, **subject_table, subject_id** ／ 受信ボックスはこの2列から元データ（申請・欠席連絡など）を引いて、件名も状態もその場で組み立てる。**通知側に状態をコピーしない** |
| `push_tokens` | id, user_id, expo_push_token, platform |

### 給与（shift_manage_app から統合。未実装）

`schedule_employees` が勤務実績そのものなので、**シフトテーブルは作らない**。必要なのは金額まわりだけ。

| テーブル | 主なカラム | 備考 |
|---------|-----------|------|
| `wage_rates` | id, employee_id, business_id, job_label, hourly_rate, effective_from, active | 時給は「講師 × 業務」ごとに、**適用開始日つき**で持つ。昇給しても過去分がさかのぼって変わらないようにするため、古い行は消さず残す |
| `commute_allowances` | id, employee_id, daily_amount, effective_from | 交通費は日額固定。**出勤日数 × 日額**で、事業には割り振らない |
| `overtime_requests` | id, employee_id, business_id, work_date, description, hours, status (pending/approved/rejected), decided_by, decided_at | シフト外の作業。**承認した分だけ**給与に乗る。割増は付かない（法定残業とは別物） |
| `payrolls` | id, employee_id, year_month, days, hours, base, commute, overtime, total, status (draft/confirmed), confirmed_at, confirmed_by | **締め処理で確定額を書き込む**。確定後はロックし、以後の再計算で上書きしない（[domain.md](domain.md) ルール11） |

---

## 設計判断の理由

- **`courses` は「事業 × 学年区分 × 月回数」で1行**（12件）。正規化して回数別料金を別テーブルに切ると、管理画面が料金表として見せづらくなる。この規模なら12行のフラットな表が最も扱いやすい。
- **`schedules` に `business_id` が必要** — 日曜は2事業が同じ日・同じコマ番号で並行開催されるため、`(date, slot_no)` では一意にならない。
- **`schedule_students` に出席状態と授業記録の両方を持たせ、`attendance` / `lesson_notes` テーブルは作らない** — どちらも「1コマ × 1生徒」に1つしか存在しないため、テーブルを分けると join が増えるだけで、しかも**出欠だけある行と記録だけある行が別々にできて食い違う**。1行にまとめれば、出欠を直せば記録側の出欠も必ず一致する。
- **生徒の在籍は `students` に直接持つ**（中間テーブルにしない） — 1生徒1事業が確定しているため。将来併用を許すなら中間テーブルへの移行が必要。
- **学年カラムを持たず `enrollment_year` から計算する** — 学年を保存すると毎年4月に全生徒の一括更新が必須になり、**実行漏れが全生徒の料金誤りに直結する**。入学年度は後から変わらない事実なので保存に向く。管理画面の入力・表示は「小3」のような学年表記のままにし、保存時に変換する。
- **`deadlines` に `business_id` を持たせない** — 締め切りは事業共通と決定済み。将来分けるなら nullable な `business_id` を足す（null = 全事業共通）。
- **`deadline_rules` と `deadlines` を分ける（ルールから行を生成する）** — 判定側（`is_submission_open()` と RLS）は「その月の行があるか」だけを見れば済むまま変えずにおきたい。ルールを直接評価する作りにすると、特定月だけの変更や停止をルール側で表現する羽目になり、条件が複雑になる。**ルールは行を作るためだけに使い、判定は今までどおり行を見る。** 例外はできた行を直接いじって対応する。
- **`payrolls` は確定額をコピーして持つ（`fees.amount` と同じ考え方）** — 時給を改定したときに、過去に支給済みの金額まで再計算で書き変わってしまうのを防ぐ。締め前は計算、締めた後はコピーした値が正。
- **`fees.amount` はコースを参照せずコピーして持ち、上書きも許す** — 月謝は固定月額だが、月の途中のコース変更など例外は必ず起きる。加えて、常に `courses.monthly_fee` を join して表示する作りにすると、**料金改定したときに過去の請求額まで書き変わってしまう**。生成時にコピーし、以後は独立した値として扱う。
- **配列カラムを使わない** — 外部キー制約が効かず、RLS も書けなくなるため。
- **日付カラムは `session_date`**（`date` にしない） — `date` は型名と同じで、関数やビューの中で読みづらくなるため。
- **事業をまたぐ割り当ては複合外部キーで禁止** — 日曜は2事業が並行開催されるため、イラストのコマにプログラミングの生徒を入れる事故が起こりうる。`(id, business_id)` を参照する複合外部キーで DB レベルで防ぐ。従業員も同様に、担当できない事業には割り当てられない。

---

## DB 側で担保しているドメインルール

**アプリ側の実装で重複させないこと。**

| ルール | 実装 |
|--------|------|
| 受講回数の上限 | `preferences` の AFTER トリガー |
| 開催していない曜日・コマは選べない | `preferences` / `work_preferences` / `schedules` のトリガー |
| 事業をまたぐ割り当ての禁止 | 複合外部キー |
| 締め切り後は保護者・従業員が編集不可 | RLS（`is_submission_open()`） |
| 定員 = 担当従業員数 × 係数 | ビュー `schedule_capacity` |
| 進級でコース変更が要る生徒の検出 | ビュー `students_needing_course_change` |

**締め切り行が無い年月は提出できない。** `is_submission_open()` が false を返し、RLS が保護者・従業員の書き込みを弾く。**その月の締め切り行ができることで受付が開く**という設計。

---

## マイグレーション

スキーマは `supabase/migrations/` にある。**番号順に適用すること。**

| ファイル | 内容 |
|---------|------|
| `20260806100000_schema.sql` | 列挙型・全テーブル・複合外部キー |
| `20260806100100_functions_and_views.sql` | 学年計算・締め切り判定・整合性トリガー・ビュー |
| `20260806100200_rls_policies.sql` | RLS ポリシーと権限付与 |
| `20260806100300_seed_master_data.sql` | 事業2件・開催枠6件・コース12件 |

適用手順（Supabase CLI は未インストール）:

```bash
npm i -D supabase
npx supabase init            # config.toml を生成。既存の migrations は上書きされない
npx supabase link --project-ref <ref>
npx supabase db push
```

ローカル実行には Docker が要る（未インストール）。無い場合はダッシュボードの SQL Editor に4ファイルを順に貼って実行する。

**マスタデータはローカル専用の `seed.sql` ではなくマイグレーションに入れてある。** アプリはこれが無いと動かないため、本番にも必ず流す必要があるから。

**最初の管理者の作り方**: 招待時の metadata に `{"name":"...","role":"admin"}` を入れる。role を入れ忘れると `parent` として作られ、`is_admin()` が false になって管理機能が一切使えない。その場合はダッシュボードから `public.users.role` を直接 `admin` に変える。

型定義は `npx supabase gen types typescript --linked > src/types/database.ts` で生成する。**手書きしない。**

### 適用状況

**4ファイルとも上の設計を反映済み。まだ本番に流していない。**
未適用なので、追加ファイルを重ねずに本体を書き換えてある。**一度適用したら、以後の変更は必ず新しいファイルを足すこと。**

### `pg_cron` で回すもの（適用後に設定する）

マイグレーションには入れていない。プロジェクトで `pg_cron` を有効にしてから登録する。

| いつ | 何を | なぜ |
|------|------|------|
| 毎月1日 00:05 | `select public.generate_deadlines();` | 翌月ぶんの締め切り行を作る。行ができて初めて受付が開く |
| 5分おき | `select public.send_due_announcements();` | 予約投稿の `sent_at` を埋める。埋まると RLS の条件を満たして対象者に見える |

```sql
select cron.schedule('generate-deadlines', '5 0 1 * *', $$select public.generate_deadlines()$$);
select cron.schedule('send-announcements', '*/5 * * * *', $$select public.send_due_announcements()$$);
```

**この2つを登録し忘れると、翌月の受付が開かず、予約投稿も飛ばない。** どちらも「動いていないことに気づきにくい」種類の失敗なので、適用直後に手で1回実行して確認すること。
