// IPGroupsAdmin — управление группами ИП (только admin).
//
// Позволяет:
//   • Создавать/удалять группы ИП
//   • Назначать филиалы в группы
//   • Переименовывать группы

import { useState, useEffect } from "react";
import { loadIPGroups, saveIPGroups, clearIPGroupsCache } from "../ipGroups";
import { BRANCHES, formatBranchName } from "../auth.jsx";
import { useToast } from "../ui";

const ALL_BRANCH_IDS = Object.keys(BRANCHES);

export default function IPGroupsAdmin() {
  const toast = useToast();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await loadIPGroups();
      setGroups(data.groups || []);
    } catch (e) {
      toast({ tone: "error", message: "Ошибка загрузки: " + e.message });
    } finally {
      setLoading(false);
    }
  }

  async function save(newGroups) {
    try {
      await saveIPGroups({ groups: newGroups });
      setGroups(newGroups);
      clearIPGroupsCache();
      toast({ tone: "success", message: "Сохранено" });
    } catch (e) {
      toast({ tone: "error", message: "Ошибка сохранения: " + e.message });
    }
  }

  function addGroup() {
    const name = newName.trim();
    if (!name) return;
    const id = "ip_" + Date.now();
    save([...groups, { id, name, branches: [] }]);
    setNewName("");
    setEditingId(id);
  }

  function removeGroup(id) {
    if (!confirm("Удалить группу?")) return;
    save(groups.filter(g => g.id !== id));
  }

  function toggleBranch(groupId, branchId) {
    const updated = groups.map(g => {
      if (g.id !== groupId) return g;
      const has = g.branches.includes(branchId);
      return {
        ...g,
        branches: has
          ? g.branches.filter(b => b !== branchId)
          : [...g.branches, branchId],
      };
    });
    save(updated);
  }

  function renameGroup(id, newName) {
    const updated = groups.map(g => g.id === id ? { ...g, name: newName } : g);
    save(updated);
  }

  // Branches not assigned to any group
  const assignedBranches = new Set(groups.flatMap(g => g.branches));
  const unassigned = ALL_BRANCH_IDS.filter(b => !assignedBranches.has(b));

  if (loading) {
    return (
      <div className="view-wrap">
        <div className="card empty-state">
          <i className="ti ti-loader-2" style={{ fontSize: 24, animation: "spin 1s linear infinite" }} />
          <div className="empty-state-sub">Загрузка…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="view-wrap">
      <div className="view-header">
        <div>
          <h1 className="view-title">
            <i className="ti ti-building" aria-hidden="true" /> Группы ИП
          </h1>
          <div className="view-sub">
            Распределение филиалов между ИП
          </div>
        </div>
      </div>

      {/* Добавление группы */}
      <div className="card" style={{ padding: 14, marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            className="login-input"
            style={{ flex: 1, padding: "8px 12px" }}
            placeholder="Название ИП (напр. ИП Смагул)"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addGroup()}
          />
          <button className="btn" onClick={addGroup} disabled={!newName.trim()}>
            <i className="ti ti-plus" /> Добавить
          </button>
        </div>
      </div>

      {/* Группы */}
      {groups.length === 0 && (
        <div className="card empty-state">
          <i className="ti ti-building" aria-hidden="true" />
          <div className="empty-state-title">Нет групп</div>
          <div className="empty-state-sub">Создайте первую группу ИП выше</div>
        </div>
      )}

      <div style={{ display: "grid", gap: 12 }}>
        {groups.map(group => (
          <div key={group.id} className="card" style={{ padding: 0, overflow: "hidden" }}>
            {/* Header */}
            <div style={{
              padding: "10px 16px",
              background: "var(--bg-elevated)",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}>
              <i className="ti ti-building" style={{ color: "var(--text-accent)" }} />
              {editingId === group.id ? (
                <input
                  autoFocus
                  className="login-input"
                  style={{ flex: 1, padding: "4px 8px", fontSize: 14, fontWeight: 600 }}
                  value={group.name}
                  onChange={e => renameGroup(group.id, e.target.value)}
                  onBlur={() => setEditingId(null)}
                  onKeyDown={e => e.key === "Enter" && setEditingId(null)}
                />
              ) : (
                <span
                  style={{ fontWeight: 600, fontSize: 14, cursor: "pointer", flex: 1 }}
                  onClick={() => setEditingId(group.id)}
                  title="Нажмите чтобы переименовать"
                >
                  {group.name}
                </span>
              )}
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {group.branches.length} филиалов
              </span>
              <button
                className="btn btn-ghost btn-sm"
                style={{ color: "var(--danger)" }}
                onClick={() => removeGroup(group.id)}
                title="Удалить группу"
              >
                <i className="ti ti-trash" />
              </button>
            </div>

            {/* Branches */}
            <div style={{ padding: "8px 12px", display: "flex", flexWrap: "wrap", gap: 6 }}>
              {ALL_BRANCH_IDS.map(branchId => {
                const inGroup = group.branches.includes(branchId);
                return (
                  <button
                    key={branchId}
                    onClick={() => toggleBranch(group.id, branchId)}
                    style={{
                      padding: "5px 10px",
                      borderRadius: 6,
                      border: `1px solid ${inGroup ? "var(--text-accent)" : "var(--border)"}`,
                      background: inGroup ? "var(--bg-accent)" : "transparent",
                      color: inGroup ? "var(--text-accent)" : "var(--text-secondary)",
                      fontSize: 12,
                      fontWeight: inGroup ? 600 : 400,
                      cursor: "pointer",
                      transition: "all 0.12s",
                    }}
                  >
                    {BRANCHES[branchId]?.spotName || branchId}
                    {inGroup && <i className="ti ti-check" style={{ marginLeft: 4, fontSize: 11 }} />}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Unassigned */}
      {unassigned.length > 0 && (
        <div className="card" style={{ marginTop: 12, padding: 14 }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8, fontWeight: 600 }}>
            <i className="ti ti-alert-circle" style={{ color: "var(--warning)" }} /> Без группы ({unassigned.length})
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {unassigned.map(branchId => (
              <span
                key={branchId}
                style={{
                  padding: "4px 10px",
                  borderRadius: 6,
                  border: "1px solid var(--warning)",
                  background: "var(--warning)12",
                  color: "var(--warning)",
                  fontSize: 12,
                }}
              >
                {BRANCHES[branchId]?.spotName || branchId}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
