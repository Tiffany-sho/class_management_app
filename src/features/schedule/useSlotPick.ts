import { useState } from 'react';
import { useToast } from '@/components/ui';
import { ensureSchedule, toggleScheduleStudent, toggleScheduleEmployee } from '@/lib/queries';
import { toMessage } from '@/lib/supabase';
import type { SlotGroup } from './useScheduleBoard';

type Kind = 'student' | 'employee';

/**
 * コマへの割り当て操作。
 *
 * **確定したコマはここでは動かせない。** 確定は保護者・講師の画面にもう出ていて、
 * 講師なら給与にも効いている。翌月を組んでいる途中に今月の実績が動くのは、
 * 同じ画面・同じ操作でできてしまうことが原因なので、**画面ごと分ける**。
 * 直すのは「当日の変更」（→ features/daychange）。
 *
 * 以前は確定済みでも確認シートを出せば外せるようにしていた。**確認では防げない** ――
 * 外すつもりで押した人は確認も通すので、止まるのは誤操作だけで、
 * 「そもそもここで直してはいけない」という区別は伝わらない。
 *
 * **下書きは1クリックで出し入れできる。** 組み立てている最中は入れて外してを
 * 何度も繰り返すので、そこに確認を挟むと作業にならない。
 * まだ誰にも出していないので、間違えても押し直せば済む。
 */
export function useSlotPick(reload: () => void) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function apply(kind: Kind, g: SlotGroup, id: string, isPicked: boolean) {
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
      reload();
    } catch (e) {
      toast(toMessage(e));
    } finally {
      setBusy(false);
    }
  }

  /** チップを押したとき。確定したコマは断る（チップも disabled にしてある） */
  function pick(kind: Kind, g: SlotGroup, id: string) {
    if (g.status === 'confirmed') {
      toast('確定したコマはここでは変えられません。「当日の変更」から直してください。');
      return;
    }
    const isPicked = kind === 'student'
      ? g.pickedStudents.includes(id)
      : g.pickedEmployees.includes(id);
    void apply(kind, g, id, isPicked);
  }

  return { busy, pick };
}
