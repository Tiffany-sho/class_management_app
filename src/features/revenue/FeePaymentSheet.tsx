import { useEffect, useState } from 'react';
import {
  Badge, Button, Field, Note, Sheet, TextArea, TextInput, useToast,
} from '@/components/ui';
import { isAdjusted, updateFee } from '@/lib/queries';
import { formatMonthJa, todayIso } from '@/lib/date';
import { yen } from '@/lib/format';
import { toMessage } from '@/lib/supabase';
import type { FeeStatus } from '@/types/domain';

export interface FeeTarget {
  studentId: string;
  studentName: string;
  parentName: string | null;
  yearMonth: string;
  amount: number;
  /** 発行時の額。動かさない列なので、ここに入れて画面から送り返さない */
  baseAmount: number;
  status: FeeStatus;
  paidDate: string | null;
  note: string | null;
}

interface Props {
  target: FeeTarget | null;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * 月謝の入金を記録する。
 *
 * **一覧の中で直接切り替えない。** 一覧は督促するときに眺める場所で、そこに
 * 切り替えが並んでいると、探している途中で別の生徒を支払い済みにしてしまう。
 * 月謝には変更履歴が無いので、**気づかないまま変わると誰も気づけない**
 * （マスタ編集と同じ理由 → docs/decisions.md）。
 *
 * **入金日は今日を既定にするが直せる。** 通帳を見ながら後からまとめて記録する
 * ことがあり、その日を勝手に今日にすると突き合わせられなくなる。
 *
 * 金額も直せる（ドメインルール10）。月の途中でコースが変わったときの差額は
 * 日割り計算に寄せず手で入れる、と決めているため。**直したら理由を残す** ――
 * 発行時の額から動かすと、保護者の画面に「金額を見直しました」が出る（→ FeeCard）。
 * メモを空のままにすると、そこに「教室にお問い合わせください」としか書けない。
 */
export function FeePaymentSheet({ target, onClose, onSaved }: Props) {
  const { toast } = useToast();
  const [paidDate, setPaidDate] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  /* 開くたびに今の値を入れ直す。前に開いた生徒の下書きが残ると、別の生徒に書き込む */
  useEffect(() => {
    setPaidDate(target?.paidDate ?? todayIso());
    setAmount(String(target?.amount ?? ''));
    setNote(target?.note ?? '');
  }, [target]);

  const save = async (status: FeeStatus) => {
    if (!target) return;
    const n = Number(amount);
    if (!Number.isFinite(n) || n < 0) { toast('金額は0以上の数で入れてください。'); return; }
    if (status === 'paid' && !paidDate) { toast('入金日を入れてください。'); return; }

    setBusy(true);
    try {
      await updateFee(target.studentId, target.yearMonth, {
        status,
        paidDate: paidDate || null,
        amount: n,
        note: note.trim() || null,
      });
      toast(status === 'paid'
        ? `${target.studentName} さんの入金を記録しました`
        : `${target.studentName} さんを未入金に戻しました`);
      onSaved();
      onClose();
    } catch (e) {
      toast(toMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const paid = target?.status === 'paid';
  /** 保存済みの状態。保護者の画面に「見直しました」が出ているかどうかと同じ判定 */
  const adjusted = target ? isAdjusted(target) : false;
  /**
   * **保存したらどうなるか**で警告する（今この場で変えたかどうかではない）。
   * 「前に金額だけ直してメモを消した」月を、次に開いたときも捕まえたい。
   */
  const willAdjust = target ? Number(amount) !== target.baseAmount : false;

  return (
    <Sheet
      open={target !== null}
      title={target ? `${target.studentName} さんの月謝` : '月謝'}
      subtitle={target
        ? `${formatMonthJa(target.yearMonth)}分 ・ 保護者 ${target.parentName ?? '—'}`
        : undefined}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>やめる</Button>
          <span className="flex-1" />
          {paid ? (
            <Button disabled={busy} onClick={() => void save('unpaid')}>未入金に戻す</Button>
          ) : null}
          <Button variant="primary" disabled={busy} onClick={() => void save('paid')}>
            {paid ? '入金の内容を保存' : '入金を記録する'}
          </Button>
        </>
      }
    >
      {target ? (
        <>
          <div className="mb-lg rounded-md border border-hairline bg-surface-soft px-md py-sm">
            <div className="flex items-center gap-sm">
              <span className="text-ui-2xl font-medium text-ink tnum">{yen(target.amount)}</span>
              <span className="flex-1" />
              <Badge tone={paid ? 'success' : 'danger'}>{paid ? '支払済' : '未払い'}</Badge>
            </div>
            {/* 発行時の額から動いている月だけ出す。**保護者の画面にも
                「金額を見直しました」と出ている**ので、どの月がそうなのかを
                記録する側が知らないままにしない（→ FeeCard） */}
            {adjusted ? (
              <div className="mt-[4px] text-ui-sm text-muted tnum">
                発行時 {yen(target.baseAmount)} から調整済み ・ 保護者にも「見直し」と表示中
              </div>
            ) : null}
          </div>

          <Field label="入金日" hint="通帳を見ながら後から記録するときは、実際の入金日に直してください。">
            <TextInput
              type="date"
              value={paidDate}
              onChange={(e) => setPaidDate(e.target.value)}
            />
          </Field>

          <Field
            label="請求額"
            hint="月の途中でコースが変わったときの差額はここで調整します（日割り計算はしません）。"
          >
            <TextInput
              inputMode="numeric"
              className="text-right tnum"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>

          <Field
            label="メモ"
            hint="保護者のマイページにそのまま出ます。金額を直したときは理由を残してください。"
          >
            <TextArea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="例）月途中のコース変更により差額調整"
            />
          </Field>

          {willAdjust && !note.trim() ? (
            <Note icon="warning">
              発行時の額（{yen(target.baseAmount)}）と違います。
              <strong className="text-ink">理由をメモに残してください。</strong>
              保護者の画面には<strong className="text-ink">「金額を見直しました」</strong>と出ます。
              メモが空だと「教室にお問い合わせください」としか出せず、そのまま問い合わせになります。
            </Note>
          ) : (
            <Note>
              月謝は<strong className="text-ink">固定月額</strong>です。
              欠席が多くても請求額は変わりません。
              入金の記録は<strong className="text-ink">保護者のマイページにすぐ反映されます。</strong>
            </Note>
          )}
        </>
      ) : null}
    </Sheet>
  );
}
