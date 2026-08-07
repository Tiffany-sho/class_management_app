import { useState } from 'react';
import { Button, Field, Panel, Select, TextArea, TextInput, useToast } from '@/components/ui';
import { toMessage } from '@/lib/supabase';
import { createAnnouncement } from '@/lib/queries';
import type { Business } from '@/types/domain';

/**
 * お知らせの新規投稿。
 *
 * 日時を入れると予約になる。予約中は `sent_at` が空のままで、
 * **RLS が対象者に見せない**ので、先に読まれることはない。
 * 送信は pg_cron が5分おきに拾う（登録し忘れていると永遠に送られない）。
 */
export function AnnouncementForm({ businesses, onCreated }: {
  businesses: Business[];
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [target, setTarget] = useState<'all' | 'parent' | 'employee'>('all');
  const [biz, setBiz] = useState('all');
  const [scheduled, setScheduled] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!title.trim() || !body.trim()) {
      toast('タイトルと本文を入れてください。');
      return;
    }
    setBusy(true);
    try {
      await createAnnouncement({
        title: title.trim(),
        body: body.trim(),
        targetRole: target === 'all' ? null : target,
        businessId: biz === 'all' ? null : biz,
        // datetime-local はローカル時刻。Date に通して ISO に直す
        scheduledAt: scheduled ? new Date(scheduled).toISOString() : null,
      });
      toast(scheduled ? '予約しました。時刻になったら送信されます。' : '投稿しました。');
      setTitle(''); setBody(''); setScheduled('');
      onCreated();
    } catch (e) {
      toast(toMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel>
      <h3 className="mb-md text-[14px] font-medium text-ink">新規投稿</h3>

      <Field label="タイトル">
        <TextInput
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="例）9月の受講希望について"
        />
      </Field>

      <Field label="本文">
        <TextArea rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
      </Field>

      <Field label="宛先">
        <Select value={target} onChange={(e) => setTarget(e.target.value as typeof target)}>
          <option value="all">全員</option>
          <option value="parent">保護者のみ</option>
          <option value="employee">講師のみ</option>
        </Select>
      </Field>

      <Field label="教室">
        <Select value={biz} onChange={(e) => setBiz(e.target.value)}>
          <option value="all">全教室</option>
          {businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </Select>
      </Field>

      <Field
        label="予約送信"
        hint="空なら今すぐ送ります。日時を入れると、その時刻まで対象者には表示されません。"
      >
        <TextInput
          type="datetime-local"
          value={scheduled}
          onChange={(e) => setScheduled(e.target.value)}
        />
      </Field>

      <Button variant="primary" block disabled={busy} onClick={() => void submit()}>
        {scheduled ? '予約する' : '投稿する'}
      </Button>
    </Panel>
  );
}
