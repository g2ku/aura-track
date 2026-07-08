// AdminUsers — управление пользователями (только admin).
//
// Список зарегистрированных пользователей с возможностью:
//   • Назначить роль: admin / manager / curator
//   • Назначить филиал (для curator)
//   • Удалить пользователя

import { useEffect, useState } from "react";
import { listUsers, updateUserMeta, deleteUserMeta } from "../firebase.js";
import { BRANCHES, formatBranchName } from "../auth.jsx";
import { useToast } from "../ui";

const ROLES = [
  { value: "admin", label: "Админ", desc: "Полный доступ, главный" },
  { value: "manager", label: "Управляющий", desc: "Видит все филиалы" },
  { value: "curator", label: "Куратор точки", desc: "Только свой филиал" },
];

const selectStyle = {
  padding: "6px 10px",
  borderRadius: 6,
  border: "1px solid var(--border)",
  background: "var(--bg-card)",
  color: "var(--text-primary)",
  fontFamily: "inherit",
  fontSize: 13,
};

export default function AdminUsers() {
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // uid of user being edited

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const list = await listUsers();
      setUsers(list.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)));
    } catch (e) {
      toast({ tone: "error", message: "Ошибка загрузки: " + e.message });
    } finally {
      setLoading(false);
    }
  }

  async function changeRole(uid, newRole) {
    try {
      await updateUserMeta(uid, { role: newRole });
      if (newRole !== "curator") {
        await updateUserMeta(uid, { branch: null, spotName: null });
      }
      setUsers(prev => prev.map(u =>
        u.uid === uid
          ? { ...u, role: newRole, branch: newRole !== "curator" ? null : u.branch }
          : u
      ));
      toast({ tone: "success", message: "Роль обновлена" });
    } catch (e) {
      toast({ tone: "error", message: "Ошибка: " + e.message });
    }
  }

  async function changeBranch(uid, branchId) {
    const branch = BRANCHES[branchId];
    try {
      await updateUserMeta(uid, {
        branch: branchId,
        spotName: branch?.spotName || null,
      });
      setUsers(prev => prev.map(u =>
        u.uid === uid ? { ...u, branch: branchId, spotName: branch?.spotName } : u
      ));
      toast({ tone: "success", message: `Филиал: ${branch?.spotName || "—"}` });
    } catch (e) {
      toast({ tone: "error", message: "Ошибка: " + e.message });
    }
  }

  async function remove(uid, email) {
    if (!confirm(`Удалить пользователя ${email}?`)) return;
    try {
      await deleteUserMeta(uid);
      setUsers(prev => prev.filter(u => u.uid !== uid));
      toast({ tone: "success", message: "Пользователь удалён" });
    } catch (e) {
      toast({ tone: "error", message: "Ошибка: " + e.message });
    }
  }

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
            <i className="ti ti-users" aria-hidden="true" /> Пользователи
          </h1>
          <div className="view-sub">
            {users.length} зарегистрировано
          </div>
        </div>
        <button className="btn btn-out" onClick={load}>
          <i className="ti ti-refresh" aria-hidden="true" /> Обновить
        </button>
      </div>

      {users.length === 0 ? (
        <div className="card empty-state">
          <i className="ti ti-users" aria-hidden="true" />
          <div className="empty-state-title">Нет пользователей</div>
          <div className="empty-state-sub">Зарегистрируйтесь через /register</div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {users.map(u => (
            <div key={u.uid} className="card" style={{ padding: 14 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                {/* Имя + email */}
                <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {u.displayName || u.email}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {u.email}
                  </div>
                </div>

                {/* Роль */}
                <div style={{ flex: "0 0 auto" }}>
                  <select
                    value={u.role || "curator"}
                    onChange={e => changeRole(u.uid, e.target.value)}
                    style={selectStyle}
                  >
                    {ROLES.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>

                {/* Филиал (только для curator) */}
                {u.role === "curator" && (
                  <div style={{ flex: "0 0 auto" }}>
                    <select
                      value={u.branch || ""}
                      onChange={e => changeBranch(u.uid, e.target.value)}
                      style={selectStyle}
                    >
                      <option value="">— Выберите филиал —</option>
                      {Object.entries(BRANCHES).map(([id, cfg]) => (
                        <option key={id} value={id}>{cfg.spotName}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Текущий филиал (для curator) */}
                {u.role === "curator" && u.branch && (
                  <div style={{
                    fontSize: 12,
                    padding: "4px 8px",
                    borderRadius: 6,
                    background: "var(--text-accent)18",
                    color: "var(--text-accent)",
                  }}>
                    {formatBranchName(u.branch)}
                  </div>
                )}

                {/* Удалить */}
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => remove(u.uid, u.email)}
                  style={{ color: "var(--danger)", marginLeft: "auto" }}
                  title="Удалить"
                >
                  <i className="ti ti-trash" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
