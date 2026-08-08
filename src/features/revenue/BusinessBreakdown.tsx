import { Panel, SectionLabel } from '@/components/ui';
import { yen } from '@/lib/format';
import type { Business, Student } from '@/types/domain';
import type { StudentFee } from '@/lib/queries';

interface Props {
  businesses: Business[];
  students: Student[];
  fees: Map<string, StudentFee>;
  /** 事業ごとの「コマから計算した基本給」。交通費・時間外は含まない */
  costByBusiness: Map<string, { amount: number }>;
}

/**
 * 事業別の内訳。
 *
 * ここに出す人件費は**コマから計算した基本給だけ**。交通費は出勤「日」に対する
 * 日額（日曜に2教室を掛け持ちしても1日ぶん）、時間外はシフト外の作業なので、
 * どちらも事業に割り振れない。按分の根拠が無いものを配ると、事業ごとの採算を誤る。
 */
export function BusinessBreakdown({ businesses, students, fees, costByBusiness }: Props) {
  return (
    <section className="mb-lg">
      <SectionLabel>事業別の内訳</SectionLabel>
      <Panel className="overflow-x-auto p-0">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-hairline text-ui-sm text-muted">
              <th className="px-md py-sm text-left font-medium">事業</th>
              <th className="px-md py-sm text-right font-medium">生徒</th>
              <th className="px-md py-sm text-right font-medium">月謝収入</th>
              <th className="px-md py-sm text-right font-medium">コマ人件費</th>
              <th className="px-md py-sm text-right font-medium">差引</th>
            </tr>
          </thead>
          <tbody>
            {businesses.map((b) => {
              const heads = students.filter((s) => s.businessId === b.id);
              const inc = heads.reduce((a, s) => a + (fees.get(s.id)?.amount ?? 0), 0);
              const cost = costByBusiness.get(b.id)?.amount ?? 0;
              return (
                <tr key={b.id} className="border-b border-hairline last:border-0">
                  <td className="px-md py-sm">
                    <span className="inline-flex items-center gap-[6px]">
                      <span
                        aria-hidden
                        className={`h-[9px] w-[9px] rounded-pill ${b.colorKey === 'forest' ? 'bg-forest' : 'bg-coral'}`}
                      />
                      {b.name}
                    </span>
                  </td>
                  <td className="px-md py-sm text-right tnum">{heads.length}名</td>
                  <td className="px-md py-sm text-right tnum">{yen(inc)}</td>
                  <td className="px-md py-sm text-right tnum">{yen(cost)}</td>
                  <td className="px-md py-sm text-right tnum text-ink">{yen(inc - cost)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>
      <p className="mt-sm text-ui-sm leading-relaxed text-muted">
        事業別の人件費は<strong className="text-ink">コマから計算した基本給だけ</strong>です。
        交通費は出勤「日」に対する日額（日曜に2教室を掛け持ちしても1日ぶん）、
        時間外はシフト外の作業なので、<strong className="text-ink">どちらも事業に割り振っていません</strong>。
        上の「人件費」はそれらを含んだ全体の金額です。
      </p>
    </section>
  );
}
