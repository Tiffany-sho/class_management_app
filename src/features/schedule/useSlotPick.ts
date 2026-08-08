import { useState } from 'react';
import { useToast } from '@/components/ui';
import { ensureSchedule, toggleScheduleStudent, toggleScheduleEmployee } from '@/lib/queries';
import { toMessage } from '@/lib/supabase';
import type { RemoveTarget } from './RemovePickSheet';
import type { SlotGroup } from './useScheduleBoard';

type Kind = 'student' | 'employee';

/** 確認シートに出す内容と、確定したときに叩く対象をひとまとめにする */
type Removing = RemoveTarget & { group: SlotGroup };

/**
 * コマへの割り当て操作。
 *
 * **確認をはさむのは「確定済みのコマから外すとき」だけ。**
 * 確定済みは保護者・講師の画面にもう出ていて、講師なら給与にも効いている。
 * 見ているだけのつもりで触れて黙って消えるのは、そこが一番まずい。
 *
 * **下書きは今までどおり1クリックで出し入れできる。** 組み立てている最中は
 * 入れて外してを何度も繰り返すので、そこに確認を挟むと作業にならない。
 * まだ誰にも出していないので、間違えても押し直せば済む。
 *
 * 確認の状態はページに持たせずここに閉じ込める。ページはデータ取得と配置に徹する。
 */
export function useSlotPick(reload: () => void) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<Removing | null>(null);

  async function apply(kind: Kind, g: SlotGroup, id: string, isPicked: boolean, ok?: string) {
    setBusy(true);
    try {
      // 希望だけの状態ではコマの行がまだ無い。押したときに作る
      const scheduleId = g.scheduleId
        ?? (await ensureSchedule(g.businessId, g.sessionDate, g.slotNo));

      if (kind === 'student') {
        await toggleScheduleStudent(scheduleId, g.businessId, id, isPicked);
      } else {
        await toggleScheduleEmployee(scheduleId, g.businessId, id, isPicked);
      }
      setRemoving(null);
      if (ok) toast(ok);
      reload();
    } catch (e) {
      toast(toMessage(e));
    } finally {
      setBusy(false);
    }
  }

  /** チップを押したとき。確定済みのコマから外すときだけ確認シートを開く */
  function pick(kind: Kind, g: SlotGroup, id: string, businessName: string) {
    const isPicked = kind === 'student'
      ? g.pickedStudents.includes(id)
      : g.pickedEmployees.includes(id);

    if (!isPicked || g.status !== 'confirmed') { void apply(kind, g, id, isPicked); return; }

    const c = (kind === 'student' ? g.wantStudents : g.wantEmployees).find((x) => x.id === id);
    setRemoving({
      kind,
      id,
      name: c?.name ?? 'この人',
      businessName,
      sessionDate: g.sessionDate,
      slotNo: g.slotNo,
      overCapacity: g.isOverCapacity,
      lastEmployee: kind === 'employee' && g.pickedEmployees.length === 1,
      group: g,
    });
  }

  function confirmRemove() {
    const r = removing;
    if (!r) return;
    void apply(r.kind, r.group, r.id, true,
      r.kind === 'employee'
        ? `${r.name} を担当から外しました。このコマぶんの給与は付きません`
        : `${r.name} をこのコマの受講から外しました`);
  }

  return { busy, removing, pick, confirmRemove, cancelRemove: () => setRemoving(null) };
}
