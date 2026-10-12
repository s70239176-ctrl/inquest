import { useState } from "react";
import { listBounties } from "../lib/chain.ts";
import { formatDeadline, formatGen, timeLeft } from "../lib/format.ts";
import { useLoad } from "../hooks.ts";
import { ErrorBox, Loading, Pill } from "../components/Ui.tsx";

const PAGE = 20;

export function Bounties() {
  const [offset, setOffset] = useState(0);
  const { data, error, loading, reload } = useLoad(() => listBounties(offset, PAGE), [offset]);
  return (
    <>
      <h1>Bounties</h1>
      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !data && <Loading what="bounties" />}
      {data && data.items.length === 0 && <p className="muted">No bounties yet. <a href="#/create">Create the first.</a></p>}
      {data && data.items.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th className="num">Pool (GEN)</th>
              <th className="num">High (GEN)</th>
              <th>Deadline</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((b) => (
              <tr className="row" key={b.id}>
                <td><a href={`#/b/${b.id}`}>{b.title}</a></td>
                <td className="num">{formatGen(b.pool)}</td>
                <td className="num">{formatGen(b.highPayout)}</td>
                <td className="muted">{formatDeadline(b.deadline)} · {timeLeft(b.deadline)}</td>
                <td><Pill value={b.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {data && data.total > PAGE && (
        <div className="actions">
          <button className="ghost" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>Newer</button>
          <button className="ghost" disabled={offset + PAGE >= data.total} onClick={() => setOffset(offset + PAGE)}>Older</button>
          <span className="muted">{data.total} total</span>
        </div>
      )}
    </>
  );
}
