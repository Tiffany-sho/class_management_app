import { useState } from 'react';
import { Button, Field, Note, Select, Sheet, TextArea, TextInput, useToast } from '@/components/ui';
import { toMessage } from '@/lib/supabase';
import { createOvertimeRequest } from '@/lib/queries';
import { todayIso } from '@/lib/date';
import type { Business } from '@/types/domain';

/**
 * 時間外勤務の申請（講師）。
 *
 * シフト外に行った作業を出す。**承認された分だけが給与に加算される**。
 * 割増は付かない（1日8時間・週40時間超の法定残業とは別物）。
 * 自分では承認できないので、この画面から状態は選べない。
 */
export function OvertimeRequestSheet({ open, businesses, onClose, onSent }: {
  open: boolean;
  businesses: Business[];
  onClose: () => void;
  onSent: () => void;
}) {
  const { toast } = useToast();
  const [picked, setPicked] = useState('');
  const [date, setDate] = useState(todayIso());
  const [hours, setHours] = useState('1.0');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);

  /* 選んでいなければ先頭。**初期値を state に入れない** ―― このシートは
     データが届く前にも組み立てられるので、そのとき空で固定されてしまう */
  const businessId = picked || businesses[0]?.id || '';

  const submit = async () => {
    const h = Number(hours);
    if (!description.trim()) { toast('作業内容を入れてください。'); return; }
    if (!Number.isFinite(h) || h <= 0) { toast('時間は0より大きい数で入れてください。'); return; }
    if (!businessId) { toast('担当できる教室が設定されていません。'); return; }

    setBusy(true);
    try {
      await createOvertimeRequest(businessId, date, description.trim(), h);
      toast('申請しました。承認されると給与に加算されます。');
      setDescription('');
      onSent();
      onClose();
    } catch (e) {
      toast(toMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="時間外勤務の申請"
      subtitle="シフト外に行った作業を申請します"
      footer={
        <div className="flex gap-sm">
          <Button block onClick={onClose}>やめる</Button>
          <Button variant="primary" block disabled={busy} onClick={() => void submit()}>
            申請する
          </Button>
        </div>
      }
    >
      {/* 担当が1教室しかない人には選ばせない（選択肢が1つの選択欄は、
          読む手間だけ足して何も決めさせていない）。0件のときは理由を出す */}
      {businesses.length === 0 ? (
        <Note icon="warning">担当できる教室が設定されていません。管理者に設定を依頼してください。</Note>
      ) : businesses.length > 1 ? (
        <Field label="教室">
          <Select value={businessId} onChange={(e) => setPicked(e.target.value)}>
            {businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
        </Field>
      ) : null}

      <div className="grid grid-cols-2 gap-sm">
        <Field label="勤務日">
          <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="時間（h）">
          <TextInput
            inputMode="decimal"
            className="text-right tnum"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
          />
        </Field>
      </div>

      <Field label="作業内容" hint="何をしたかを具体的に。承認する人が判断できる粒度で。">
        <TextArea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="例）次回の教材準備と動作確認"
        />
      </Field>

      <Note>
        <strong className="text-ink">承認された分だけが給与に加算されます。</strong>
        加算単価はその日の通常時給で、割増は付きません
        （法定残業の25%割増とは別のしくみです）。
      </Note>
    </Sheet>
  );
}
