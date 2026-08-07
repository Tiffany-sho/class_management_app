import { useState } from 'react';
import { PageHeader } from '@/components/layout/AdminLayout';
import { Badge, Loading, ErrorNote, Note, Panel, TextInput, useToast } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { toMessage } from '@/lib/supabase';
import { fetchBusinesses, fetchCourses, updateCourse } from '@/lib/queries';
import { yen } from '@/lib/format';
import type { Course } from '@/types/domain';

/**
 * コース・料金。
 *
 * 料金と回数は**コードに一切埋め込んでいない**。ここ（マスタ）が唯一の値。
 * 変えても発行済みの月謝は動かない（請求額は発行時にコピーしているため）。
 *
 * 5・6学年・中学生だけ標準が月3回で、月2回にすると安くなる（他学年と増減が逆）。
 * そのため画面で「追加料金」という言い方をしないこと。
 */
export function MasterCoursesPage() {
  const { toast } = useToast();
  const [draft, setDraft] = useState<Record<string, string>>({});

  const state = useAsync(async () => {
    const [businesses, courses] = await Promise.all([fetchBusinesses(), fetchCourses()]);
    return { businesses, courses };
  }, []);

  const save = async (c: Course, raw: string) => {
    const value = Number(raw.replace(/[^\d]/g, ''));
    if (!Number.isFinite(value) || value < 0 || value === c.monthlyFee) return;
    try {
      await updateCourse(c.id, { monthlyFee: value });
      toast(`${c.gradeLabel} 月${c.sessionsPerMonth}回 を ${yen(value)} に変更しました`);
      state.reload();
    } catch (e) {
      toast(toMessage(e));
    }
  };

  if (state.loading && !state.data) return <Loading />;
  if (state.error && !state.data) return <ErrorNote message={state.error} onRetry={state.reload} />;
  const d = state.data;
  if (!d) return null;

  const feeCell = (c: Course | undefined) => {
    if (!c) return <span className="text-muted">—</span>;
    return (
      <div className="flex items-center justify-end gap-xs">
        {c.isDefault ? <Badge tone="info">標準</Badge> : null}
        <TextInput
          className="w-[100px] text-right tnum"
          inputMode="numeric"
          value={draft[c.id] ?? String(c.monthlyFee)}
          onChange={(e) => setDraft((p) => ({ ...p, [c.id]: e.target.value }))}
          onBlur={(e) => void save(c, e.target.value)}
          aria-label={`${c.gradeLabel} 月${c.sessionsPerMonth}回の月額`}
        />
      </div>
    );
  };

  return (
    <div>
      <PageHeader title="コース・料金" description="料金は12件。金額欄を直接書き換えられます。" />

      <Note>
        料金・回数は<strong className="text-ink">コードに埋め込んでいません</strong>。この表が唯一の値です。
        変更しても<strong className="text-ink">すでに発行した月謝は変わりません</strong>（請求額は発行時にコピーしているため）。
        変わるのは次に生成される月からです。
      </Note>

      {d.businesses.map((b) => {
        const rows = [...new Set(
          d.courses.filter((c) => c.businessId === b.id).map((c) => c.gradeLabel),
        )];
        return (
          <div key={b.id} className="mb-lg">
            <h3 className="mb-xs flex items-center gap-[6px] text-[14px] font-medium text-ink">
              <span
                aria-hidden
                className={`h-[10px] w-[10px] rounded-pill ${b.colorKey === 'forest' ? 'bg-forest' : 'bg-coral'}`}
              />
              {b.name}
            </h3>
            <Panel className="overflow-x-auto p-0">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-hairline text-[12px] text-muted">
                    <th className="px-md py-sm text-left font-medium">学年区分</th>
                    <th className="px-md py-sm text-right font-medium">対象学年</th>
                    <th className="px-md py-sm text-right font-medium">月2回</th>
                    <th className="px-md py-sm text-right font-medium">月3回</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((label) => {
                    const list = d.courses.filter(
                      (c) => c.businessId === b.id && c.gradeLabel === label,
                    );
                    const two = list.find((c) => c.sessionsPerMonth === 2);
                    const three = list.find((c) => c.sessionsPerMonth === 3);
                    const range = two ?? three;
                    return (
                      <tr key={label} className="border-b border-hairline last:border-0">
                        <td className="px-md py-sm text-ink">{label}</td>
                        <td className="px-md py-sm text-right text-[12px] text-muted tnum">
                          {range ? `${range.gradeMin}〜${range.gradeMax}` : '—'}
                        </td>
                        <td className="px-md py-sm text-right">{feeCell(two)}</td>
                        <td className="px-md py-sm text-right">{feeCell(three)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Panel>
          </div>
        );
      })}

      <p className="text-[12px] leading-relaxed text-muted">
        「標準」は各学年区分の既定コースです。
        <strong className="text-ink">5・6学年・中学生だけ標準が月3回</strong>で、月2回にすると安くなります
        （他の学年とは増減が逆になるため、「追加料金」という言い方はしないでください）。
      </p>
    </div>
  );
}
