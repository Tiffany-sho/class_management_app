import { Badge, Button, Loading, ErrorNote, Note, Sheet } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { fetchStaffDetail } from '@/lib/queries';
import { formatDayJa, formatMonthJa } from '@/lib/date';
import type { DetailMode } from '@/features/students/StudentDetailSheet';

interface Props {
  employeeId: string | null;
  /** 自分の id。'employee' のとき「一緒に入るコマ」を絞るのに使う */
  meId?: string | null;
  mode: DetailMode;
  month: string;
  onClose: () => void;
}

/**
 * 講師詳細。**どの画面からでも講師名を押せば開く。**
 *
 * 講師どうしでは**労働条件を一切出さない**。時給・交通費・支給額・出勤日数は
 * 本人と管理者だけ（ドメインルール12）。連絡先も出さない ―― 教室の連絡は
 * 管理者を通す運用なので、講師名簿として配る必要がない。
 *
 * ★ DB 側は完全には守っていない。`employee_monthly_pay` は他人の行も返してしまう
 * （時給が読めないので金額は 0 になるだけ）。**0円と出るのは誤情報**なので、
 * 画面には最初から出さない。金額そのものが漏れているわけではない。
 *
 * 管理者向けの時給・交通費・給与実績は StaffSheet（講師一覧から開く方）にある。
 * こちらは「名前を押して素性を確かめる」ための軽い方で、役割を分けている。
 */
export function StaffDetailSheet({ employeeId, meId, mode, month, onClose }: Props) {
  const state = useAsync(
    async () => (employeeId ? fetchStaffDetail(employeeId, month) : null),
    [employeeId ?? '', month],
  );
  const d = state.data;

  /* 講師が見るときは「自分と同じコマ」だけに絞る。他人の勤務表を眺める画面にはしない */
  const slots = (d?.slots ?? []).filter(
    (s) => mode === 'admin' || !meId || s.withNames.length > 0,
  );

  return (
    <Sheet
      open={employeeId !== null}
      title={d?.name ?? '講師'}
      /* 講師どうしで開くのは同じコマに入る相手なので、教室は自明。管理者だけに出す */
      subtitle={d ? (
        <span className="flex flex-wrap items-center gap-xs">
          {mode === 'admin'
            ? (d.businesses.map((b) => b.name).join(' ・ ') || '担当教室なし')
            : null}
          <Badge tone={d.active ? 'success' : 'neutral'}>{d.active ? '在籍' : '退職'}</Badge>
        </span>
      ) : undefined}
      onClose={onClose}
      footer={<Button block onClick={onClose}>閉じる</Button>}
    >
      {state.loading && !d ? <Loading /> : null}
      {state.error ? <ErrorNote message={state.error} onRetry={state.reload} /> : null}

      {d ? (
        <>
          <Section title="基本情報">
            <dl className="grid grid-cols-2 gap-md">
              {mode === 'admin' ? (
                <KV k="担当教室" v={d.businesses.map((b) => b.name).join(' ・ ') || '—'} />
              ) : null}
              <KV k="在籍状態" v={d.active ? '在籍中' : '退職'} />
              {mode === 'admin' ? <KV k="メールアドレス" v={d.email ?? '—'} /> : null}
            </dl>
          </Section>

          <Section title={mode === 'admin'
            ? `${formatMonthJa(month)}の担当（${d.slots.length}コマ）`
            : '一緒に入るコマ'}>
            {slots.length === 0 ? (
              <p className="text-[13px] text-muted">
                {mode === 'admin'
                  ? 'この月の担当はありません。'
                  : '同じコマに入る予定はありません。'}
              </p>
            ) : (
              <ul className="flex flex-col gap-xs">
                {slots.slice(0, 12).map((s) => (
                  <li key={s.scheduleId} className="flex flex-wrap items-center gap-xs rounded-md border border-hairline px-sm py-xs">
                    <span className="text-[13px] text-ink">
                      {formatDayJa(s.sessionDate)} 第{s.slotNo}コマ
                    </span>
                    <span className="flex-1" />
                    {s.withNames.length > 0 ? (
                      <span className="text-[12px] text-muted">
                        {s.withNames.join('・')} と{s.withNames.length + 1}名体制
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {mode === 'admin' ? (
            <Note>
              時給・交通費・支給額は<strong className="text-ink">「講師」ページ</strong>で見られます。
              確定したコマがそのまま勤務実績になるので、上の担当コマがそのまま給与の根拠です。
            </Note>
          ) : (
            <Note icon="lock">
              時給・交通費・支給額・出勤日数は<strong className="text-ink">講師どうしでは見られません</strong>。
              本人と管理者だけが見られます。連絡先も出していません（教室の連絡は管理者を通します）。
            </Note>
          )}
        </>
      ) : null}
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-lg">
      <h4 className="mb-xs border-b border-hairline pb-xs text-[11px] font-medium tracking-[0.08em] text-muted">
        {title}
      </h4>
      {children}
    </section>
  );
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[12px] text-muted">{k}</dt>
      <dd className="mt-[3px] text-[14px] text-ink">{v}</dd>
    </div>
  );
}
