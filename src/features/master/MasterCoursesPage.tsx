import { useState } from 'react';
import { PageHeader } from '@/components/layout/AdminLayout';
import { Badge, Icon, Loading, ErrorNote, Note, Panel, useToast } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { fetchBusinesses, fetchCourses } from '@/lib/queries';
import { yen } from '@/lib/format';
import type { Course } from '@/types/domain';
import { CourseFeeSheet } from './CourseFeeSheet';

type Target = { businessName: string; gradeLabel: string; courses: Course[] };

/**
 * コース・料金。
 *
 * 料金と回数は**コードに一切埋め込んでいない**。ここ（マスタ）が唯一の値。
 * 変えても発行済みの月謝は動かない（請求額は発行時にコピーしているため）。
 *
 * **表の上では編集できない。** 行を押してドロワーを開いてから直す。
 * 一覧に入力欄を置くと、眺めている途中で触れて料金が変わってしまう。
 *
 * 5・6学年・中学生だけ標準が月3回で、月2回にすると安くなる（他学年と増減が逆）。
 * そのため画面で「追加料金」という言い方をしないこと。
 */
export function MasterCoursesPage() {
  const { toast } = useToast();
  const [target, setTarget] = useState<Target | null>(null);

  const state = useAsync(async () => {
    const [businesses, courses] = await Promise.all([fetchBusinesses(), fetchCourses()]);
    return { businesses, courses };
  }, []);

  if (state.loading && !state.data) return <Loading />;
  if (state.error && !state.data) return <ErrorNote message={state.error} onRetry={state.reload} />;
  const d = state.data;
  if (!d) return null;

  const feeCell = (c: Course | undefined) => {
    if (!c) return <span className="text-muted">—</span>;
    return (
      <span className="inline-flex items-center gap-xs">
        {c.isDefault ? <Badge tone="info">標準</Badge> : null}
        <span className="tnum text-ink">{yen(c.monthlyFee)}</span>
      </span>
    );
  };

  return (
    <div>
      <PageHeader title="コース・料金" description="料金は12件。行を押すと編集できます。" />

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
            <h3 className="mb-xs flex items-center gap-[6px] text-ui-md font-medium text-ink">
              <span
                aria-hidden
                className={`h-[10px] w-[10px] rounded-pill ${b.colorKey === 'forest' ? 'bg-forest' : 'bg-coral'}`}
              />
              {b.name}
            </h3>
            <Panel className="overflow-x-auto p-0">
              {/* DataTable と同じ扱い。枠に合わせて縮めると、セルの中で語が折れる */}
              <table className="w-max min-w-full border-collapse">
                <thead>
                  <tr className="border-b border-hairline text-ui-sm text-muted">
                    <th className="whitespace-nowrap px-md py-sm text-left font-medium">学年区分</th>
                    <th className="whitespace-nowrap px-md py-sm text-right font-medium">対象学年</th>
                    <th className="whitespace-nowrap px-md py-sm text-right font-medium">月2回</th>
                    <th className="whitespace-nowrap px-md py-sm text-right font-medium">月3回</th>
                    <th className="whitespace-nowrap w-[40px] px-md py-sm" />
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
                      <tr
                        key={label}
                        tabIndex={0}
                        role="button"
                        aria-label={`${label} の料金を編集`}
                        onClick={() => setTarget({ businessName: b.name, gradeLabel: label, courses: list })}
                        onKeyDown={(e) => {
                          if (e.key !== 'Enter' && e.key !== ' ') return;
                          e.preventDefault();
                          setTarget({ businessName: b.name, gradeLabel: label, courses: list });
                        }}
                        className="cursor-pointer border-b border-hairline last:border-0
                          hover:bg-surface-soft focus:bg-surface-soft focus:outline-none"
                      >
                        <td className="whitespace-nowrap px-md py-sm text-ink">{label}</td>
                        <td className="whitespace-nowrap px-md py-sm text-right text-ui-sm text-muted tnum">
                          {range ? `${range.gradeMin}〜${range.gradeMax}` : '—'}
                        </td>
                        <td className="whitespace-nowrap px-md py-sm text-right">{feeCell(two)}</td>
                        <td className="whitespace-nowrap px-md py-sm text-right">{feeCell(three)}</td>
                        <td className="whitespace-nowrap px-md py-sm text-right text-muted">
                          <Icon name="chevron-right" size={16} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Panel>
          </div>
        );
      })}

      <p className="text-ui-sm leading-relaxed text-muted">
        「標準」は各学年区分の既定コースです。
        <strong className="text-ink">5・6学年・中学生だけ標準が月3回</strong>で、月2回にすると安くなります
        （他の学年とは増減が逆になるため、「追加料金」という言い方はしないでください）。
      </p>

      <CourseFeeSheet
        target={target}
        onClose={() => setTarget(null)}
        onSaved={(m) => { toast(m); setTarget(null); state.reload(); }}
        onError={(m) => toast(m)}
      />
    </div>
  );
}
