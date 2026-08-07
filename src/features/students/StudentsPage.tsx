import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/layout/AdminLayout';
import {
  Badge, Button, Chip, DataTable, Icon, Loading, ErrorNote, Note, TextInput, type Column,
} from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import {
  fetchAllUsers, fetchBusinesses, fetchCourses, fetchStudents, fetchFees, type StudentFee,
} from '@/lib/queries';
import { currentMonthKey, gradeLabel } from '@/lib/date';
import { FEE_LABEL } from '@/lib/format';
import type { Student } from '@/types/domain';
import { StudentSheet } from './StudentSheet';
import { StudentForm } from './StudentForm';

type SortKey = 'name' | 'business' | 'grade' | 'sessions' | 'fee';

interface Row extends Student {
  fee?: StudentFee;
  businessName: string;
  businessColor: 'forest' | 'coral';
}

/**
 * 生徒一覧。
 * 「今月の月謝」は金額を出さず、支払済/未払いと入金日だけにする。
 * ここで見たいのは「誰が払っていないか」で、いくらかはコースを見れば分かる。
 * 出席率も出さない（月2〜3回では1回休むと 67% になり実態より悪く見える）。
 */
export function StudentsPage() {
  const month = currentMonthKey();
  const [query, setQuery] = useState('');
  const [biz, setBiz] = useState('all');
  const [unpaidOnly, setUnpaidOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [asc, setAsc] = useState(true);
  const [selected, setSelected] = useState<Row | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);

  const state = useAsync(async () => {
    const [businesses, students, fees, courses, users] = await Promise.all([
      fetchBusinesses(), fetchStudents(), fetchFees(month), fetchCourses(), fetchAllUsers(),
    ]);
    return { businesses, students, fees, courses, users };
  }, [month]);

  const rows = useMemo<Row[]>(() => {
    const d = state.data;
    if (!d) return [];
    const bizMap = new Map(d.businesses.map((b) => [b.id, b]));

    let list: Row[] = d.students.map((s) => ({
      ...s,
      fee: d.fees.get(s.id),
      businessName: bizMap.get(s.businessId)?.name ?? '—',
      businessColor: bizMap.get(s.businessId)?.colorKey ?? 'forest',
    }));

    if (query) {
      const q = query.trim();
      list = list.filter((s) => s.name.includes(q) || (s.parentName ?? '').includes(q));
    }
    if (biz !== 'all') list = list.filter((s) => s.businessId === biz);
    if (unpaidOnly) list = list.filter((s) => s.fee?.status !== 'paid');

    const value = (s: Row): string | number => {
      switch (sortKey) {
        case 'name': return s.name;
        case 'business': return s.businessName;
        case 'grade': return s.grade;
        case 'sessions': return s.sessionsPerMonth;
        // 未払いが先。督促する側が見たい順にする
        case 'fee': return (s.fee?.status === 'paid' ? 1e7 : 0) + s.monthlyFee;
      }
    };
    return [...list].sort((a, b) => {
      const x = value(a); const y = value(b);
      const c = typeof x === 'string' ? x.localeCompare(String(y), 'ja') : Number(x) - Number(y);
      return (asc ? c : -c) || a.name.localeCompare(b.name, 'ja');
    });
  }, [state.data, query, biz, unpaidOnly, sortKey, asc]);

  function onSort(key: string) {
    if (key === sortKey) setAsc((v) => !v);
    else { setSortKey(key as SortKey); setAsc(true); }
  }

  const columns: Column<Row>[] = [
    { key: 'name', header: '生徒', sortable: true, render: (s) => (
      <div>
        <div className="text-ink">{s.name}</div>
        <div className="text-[12px] text-muted">{s.parentName ?? '—'}</div>
      </div>
    ) },
    { key: 'business', header: '教室', sortable: true, render: (s) => (
      <Badge tone={s.businessColor === 'forest' ? 'prog' : 'illust'}>
        {s.businessName.replace('教室', '')}
      </Badge>
    ) },
    { key: 'grade', header: '学年', numeric: true, sortable: true, render: (s) => gradeLabel(s.grade) },
    { key: 'course', header: 'コース', render: (s) => (
      <div>
        <div>{s.gradeLabel}</div>
        <div className="text-[12px] text-muted">月{s.sessionsPerMonth}回</div>
      </div>
    ) },
    { key: 'fee', header: '今月の月謝', sortable: true, render: (s) => {
      if (!s.fee) return <Badge tone="neutral">請求前</Badge>;
      const paid = s.fee.status === 'paid';
      return (
        <div className="whitespace-nowrap">
          <Badge tone={paid ? 'success' : 'danger'}>{FEE_LABEL[s.fee.status]}</Badge>
          <div className="mt-[3px] text-[12px] text-muted tnum">
            {paid && s.fee.paidDate ? `入金 ${s.fee.paidDate.slice(5)}` : '入金待ち'}
          </div>
        </div>
      );
    } },
    { key: 'go', header: '', render: () => <Icon name="chevron-right" size={16} className="text-border-strong" /> },
  ];

  if (state.loading && !state.data) return <Loading />;
  if (state.error && !state.data) return <ErrorNote message={state.error} onRetry={state.reload} />;
  const d = state.data;
  if (!d) return null;

  const unpaidCount = rows.filter((s) => s.fee && s.fee.status !== 'paid').length;

  return (
    <div>
      <PageHeader
        title="生徒"
        description={
          rows.length === d.students.length
            ? `${d.students.length}名`
            : `${rows.length} / ${d.students.length}名`
        }
        actions={
          <Button variant="primary" size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Icon name="plus" size={16} /> 生徒を登録
          </Button>
        }
      />

      <div className="mb-md flex flex-wrap items-center gap-sm">
        <div className="relative max-w-[240px] flex-1">
          <Icon
            name="search"
            size={16}
            className="pointer-events-none absolute left-[10px] top-1/2 -translate-y-1/2 text-muted"
          />
          <TextInput
            className="pl-[32px]"
            placeholder="生徒・保護者を検索"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-xs">
          <Chip active={biz === 'all'} onClick={() => setBiz('all')}>すべて</Chip>
          {d.businesses.map((b) => (
            <Chip key={b.id} active={biz === b.id} onClick={() => setBiz(b.id)}>
              <span
                aria-hidden
                className={`h-[9px] w-[9px] rounded-pill ${b.colorKey === 'forest' ? 'bg-forest' : 'bg-coral'}`}
              />
              {b.name.replace('教室', '')}
            </Chip>
          ))}
        </div>
        <Chip active={unpaidOnly} onClick={() => setUnpaidOnly((v) => !v)}>
          未払いのみ{unpaidCount ? ` ${unpaidCount}` : ''}
        </Chip>
      </div>

      <Note>
        生徒の<strong className="text-ink">新規登録は「ユーザー・招待」から</strong>行います（保護者と同時に登録）。
        この画面は在籍中の生徒の<strong className="text-ink">確認と変更</strong>用です。
      </Note>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(s) => s.id}
        onRowClick={setSelected}
        sortKey={sortKey}
        sortAsc={asc}
        onSort={onSort}
        empty="該当する生徒がいません"
      />

      <p className="mt-sm text-[12px] leading-relaxed text-muted">
        学年は保存していません。<strong className="text-ink">入学年度から毎回計算</strong>しています
        （毎年4月の一括更新が不要になり、更新漏れによる料金誤りが起きません）。
      </p>

      <StudentSheet
        student={selected}
        month={month}
        onClose={() => setSelected(null)}
        onEdit={(s) => { setSelected(null); setEditing(s); setFormOpen(true); }}
      />

      <StudentForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={state.reload}
        businesses={d.businesses}
        courses={d.courses}
        parents={d.users.filter((u) => u.role === 'parent' && u.active)}
        student={editing}
      />
    </div>
  );
}
