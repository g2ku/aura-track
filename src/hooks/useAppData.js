import { useMemo } from "react";
import { aggregateDocs, filterDocsByPeriod } from "../utils";
import { matchBranchInDocs } from "../auth.jsx";
import { periodToFilter } from "../store/useAppStore";

export function useAppData({ docs, userBranch, period }) {
  const branchFilter = useMemo(
    () => userBranch ? matchBranchInDocs(userBranch) : null,
    [userBranch]
  );

  const branchDocs = useMemo(() => {
    if (!branchFilter) return docs;
    return docs.filter(d => branchFilter(d.branches || []));
  }, [docs, branchFilter]);

  const agg = useMemo(() => aggregateDocs(branchDocs), [branchDocs]);

  const filteredDocs = useMemo(
    () => filterDocsByPeriod(branchDocs, periodToFilter(period)),
    [branchDocs, period]
  );

  const filteredAgg = useMemo(() => aggregateDocs(filteredDocs), [filteredDocs]);

  return { branchDocs, agg, filteredDocs, filteredAgg };
}
