import { useCallback, useEffect, useRef, useState } from 'react';
import { toMessage } from '@/lib/supabase';

interface State<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/**
 * 非同期の取得を「読み込み中 / エラー / データ」の3状態で扱う。
 *
 * 画面ごとに try/catch と useState を書くと、必ずどこかで
 * エラー表示が抜けて真っ白になるので、ここに寄せる。
 * 取得が終わる前にアンマウントされたら setState しない。
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): State<T> & { reload: () => void } {
  const [state, setState] = useState<State<T>>({ data: null, loading: true, error: null });
  const [nonce, setNonce] = useState(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  useEffect(() => {
    let current = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    fn()
      .then((data) => { if (current && alive.current) setState({ data, loading: false, error: null }); })
      .catch((e) => {
        if (current && alive.current) {
          setState((s) => ({ data: s.data, loading: false, error: toMessage(e) }));
        }
      });
    return () => { current = false; };
    // fn は毎回作り直されるので deps で制御する
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { ...state, reload };
}
