import { useEffect, useRef, useState } from "react";
import {
  API_BASE,
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  resetUserPassword,
  listUserPermissions,
  replaceUserPermissions,
  listProjects,
} from "../../api/guest.js";
import { CheckCircleIcon, TrashIcon } from "../../components/Icons.jsx";
import { useRealtimeRefresh } from "../../realtime/RealtimeContext.jsx";
import { consumeReloadState, reloadPage } from "../../utils/reload.js";
import ProfileAvatar from "../../components/ProfileAvatar.jsx";
import PasswordInput from "../../components/PasswordInput.jsx";

const FEATURES = [
  { key: "can_view", label: "প্রজেক্ট দেখা" },
  { key: "can_view_registrations", label: "Registrations দেখা/ডিলিট" },
  { key: "can_edit_event", label: "Event তথ্য এডিট" },
  { key: "can_edit_fields", label: "Form Fields এডিট" },
  { key: "can_publish", label: "Publish/Unpublish" },
  { key: "can_export", label: "CSV Export" },
  { key: "can_manage_tasks", label: "Task ম্যানেজ" },
];

const emptyForm = { name: "", username: "", email: "", phone: "", designation: "", center: "", password: "", role: "executive" };

export default function UsersPage({ onLoggedOut, currentUser }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [accessUserId, setAccessUserId] = useState(() => consumeReloadState()?.usersAccessUserId || null);
  const [editingUser, setEditingUser] = useState(null);
  const [search, setSearch] = useState("");
  const [viewingImageUser, setViewingImageUser] = useState(null);

  function load() {
    setLoading(true);
    listUsers()
      .then((res) => setUsers(res.data))
      .catch((err) => {
        if (err.response?.status === 401) onLoggedOut();
        else setError("ইউজার লোড করা যায়নি।");
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, []);
  useRealtimeRefresh(["users", "project_permissions"], load);

  useEffect(() => {
    window.addEventListener("qf:refresh-current-view", load);
    return () => window.removeEventListener("qf:refresh-current-view", load);
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    try {
      const res = await createUser(form);
      setUsers((u) => [res.data, ...u]);
      setForm(emptyForm);
      setCreating(false);
    } catch (err) {
      setError(err.response?.data?.detail || "অ্যাকাউন্ট তৈরি করা যায়নি।");
    }
  }

  async function toggleActive(u) {
    const res = await updateUser(u.id, { is_active: !u.is_active });
    setUsers((list) => list.map((x) => (x.id === u.id ? res.data : x)));
  }

  async function toggleCustomerAccess(u) {
    const res = await updateUser(u.id, { can_manage_customers: !u.can_manage_customers });
    setUsers((list) => list.map((x) => (x.id === u.id ? res.data : x)));
  }

  async function toggleManualLeadAccess(u) {
    const res = await updateUser(u.id, { can_manual_lead_entry: !u.can_manual_lead_entry });
    setUsers((list) => list.map((x) => (x.id === u.id ? res.data : x)));
  }

  async function toggleEventCreateAccess(u) {
    const res = await updateUser(u.id, { can_create_events: !u.can_create_events });
    setUsers((list) => list.map((x) => (x.id === u.id ? res.data : x)));
  }

  async function handleEditUser(userId, values) {
    const res = await updateUser(userId, values);
    setUsers((list) => list.map((user) => (user.id === userId ? res.data : user)));

    const storedUser = JSON.parse(sessionStorage.getItem("qf_current_user") || "null");
    if (storedUser?.id === userId) {
      sessionStorage.setItem("qf_current_user", JSON.stringify({ ...storedUser, ...res.data }));
      window.dispatchEvent(new Event("qf:current-user-updated"));
    }
    setEditingUser(null);
  }

  async function handleDelete(u) {
    if (!confirm(`"${u.name}" (${u.email}) অ্যাকাউন্টটি মুছে ফেলবেন?`)) return;
    await deleteUser(u.id);
    setUsers((list) => list.filter((x) => x.id !== u.id));
    if (accessUserId === u.id) setAccessUserId(null);
  }

  async function handleResetPassword(u) {
    const pw = prompt(`"${u.name}"-এর জন্য নতুন পাসওয়ার্ড দিন (কমপক্ষে ১০ অক্ষর, letter ও number):`);
    if (!pw) return;
    if (pw.length < 10 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return alert("পাসওয়ার্ডে কমপক্ষে ১০ অক্ষর, একটি letter ও একটি number থাকতে হবে।");
    await resetUserPassword(u.id, pw);
    alert("পাসওয়ার্ড রিসেট হয়েছে।");
  }

  const accessUser = users.find((u) => u.id === accessUserId);

  const query = search.trim().toLowerCase();
  const filteredUsers = query
    ? users.filter((u) =>
        [u.name, u.phone, u.email].some((v) => (v || "").toLowerCase().includes(query))
      )
    : users;

  return (
    <div className="mx-auto max-w-3xl px-3 py-3">
      <div className="mb-6">
        {/* <h1 className="font-display text-xl font-black text-[#101828]">Users & Access Control</h1> */}
        {/* <p className="text-xs text-[#667085]">Admin ও Communicator অ্যাকাউন্ট তৈরি করুন এবং প্রতিটি communicator কোন project-এ কী করতে পারবে সেটা নিয়ন্ত্রণ করুন।</p> */}
      </div>

      <div className="mb-4 relative">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]">
          <circle cx="9" cy="9" r="6" />
          <path d="M17 17l-4-4" strokeLinecap="round" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Name, phone অথবা email দিয়ে প্রোফাইল খুঁজুন…"
          className="w-full rounded-full border border-[#E4E7EC] bg-white py-2.5 pl-9 pr-4 text-xs outline-none focus:border-[#2554C7] focus:ring-2 focus:ring-[#EEF4FF]"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#98A2B3] hover:text-[#344054]"
            title="Clear"
          >
            ✕
          </button>
        )}
      </div>

      {creating ? (
        <form onSubmit={handleCreate} className="mb-5 grid grid-cols-2 gap-3 rounded-xl border border-[#E4E7EC] bg-white p-4">
          <Field label="Name">
            <input required className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </Field>
          <Field label="Username">
            <input required className="input" value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} />
          </Field>
          <Field label="Email">
            <input required type="email" className="input" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </Field>
          <Field label="Password">
            <PasswordInput required value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
          </Field>
          <Field label="Phone Number">
            <input required type="tel" className="input" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          </Field>
          <Field label="পদবী / Designation">
            <input className="input" value={form.designation} onChange={(e) => setForm((f) => ({ ...f, designation: e.target.value }))} />
          </Field>
          <Field label="Center">
            <input className="input" value={form.center} onChange={(e) => setForm((f) => ({ ...f, center: e.target.value }))} />
          </Field>
          <Field label="Role">
            <select className="input" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
              <option value="executive">Communicator</option>
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </Field>
          {error && <div className="col-span-2 rounded-lg bg-[#FEF3F2] px-3 py-2 text-xs text-[#D92D20]">{error}</div>}
          <div className="col-span-2 flex gap-2">
            <button type="submit" className="rounded-full bg-[#2554C7] px-4 py-2 text-xs font-bold text-white hover:bg-[#17368F]">
              Create Account
            </button>
            <button type="button" onClick={() => setCreating(false)} className="rounded-full border border-[#D0D5DD] px-4 py-2 text-xs font-semibold text-[#344054]">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="mb-5 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#D0D5DD] bg-white py-3 text-sm font-semibold text-[#2554C7] hover:border-[#2554C7] hover:bg-[#EEF4FF]"
        >
          + নতুন Admin/Communicator/User অ্যাকাউন্ট তৈরি করুন
        </button>
      )}

      {error && !creating && <div className="mb-4 rounded-lg bg-[#FEF3F2] px-3 py-2 text-xs text-[#D92D20]">{error}</div>}
      {loading && <div className="py-10 text-center text-sm text-[#667085]">লোড হচ্ছে…</div>}

      {!loading && filteredUsers.length === 0 && (
        <div className="py-10 text-center text-sm text-[#98A2B3]">কোনো প্রোফাইল পাওয়া যায়নি।</div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {filteredUsers.map((u) => (
          <UserCard
            key={u.id}
            user={u}
            onOpenProfile={() => setEditingUser(u)}
            onAccess={() => setAccessUserId(u.id)}
            onDelete={() => handleDelete(u)}
            onToggleActive={() => toggleActive(u)}
            onResetPassword={() => handleResetPassword(u)}
            onViewImage={() => setViewingImageUser(u)}
          />
        ))}
      </div>

      {accessUser && (
        <AccessModal
          user={accessUser}
          onToggleCustomerAccess={() => toggleCustomerAccess(accessUser)}
          onToggleManualLeadAccess={() => toggleManualLeadAccess(accessUser)}
          onToggleEventCreateAccess={() => toggleEventCreateAccess(accessUser)}
          onClose={() => setAccessUserId(null)}
        />
      )}
      {editingUser && (
        <EditUserModal
          user={editingUser}
          canChangeRole={Boolean(currentUser?.is_super_admin)}
          onSave={handleEditUser}
          onClose={() => setEditingUser(null)}
        />
      )}
      {viewingImageUser && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={() => setViewingImageUser(null)}>
          <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-white p-3 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setViewingImageUser(null)}
              className="absolute right-2 top-2 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold text-slate-600 shadow-sm"
            >
              ✕
            </button>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              {viewingImageUser.profile_image_url ? (
                <img
                  src={viewingImageUser.profile_image_url.startsWith("http") ? viewingImageUser.profile_image_url : `${API_BASE}${viewingImageUser.profile_image_url}`}
                  alt={viewingImageUser.name || "Profile"}
                  className="max-h-[70vh] w-full rounded-xl object-contain"
                />
              ) : (
                <div className="flex h-64 items-center justify-center rounded-xl bg-indigo-600 text-5xl font-black text-white">
                  {(viewingImageUser.name || "?").charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="mt-3 text-center">
              <div className="text-sm font-bold text-slate-900">{viewingImageUser.name || "Unnamed profile"}</div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{viewingImageUser.role || "user"}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function UserCard({ user: u, onOpenProfile, onAccess, onDelete, onToggleActive, onResetPassword, onViewImage }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [menuOpen]);

  return (
    <div
      onClick={(e) => { if (!e.target.closest("button,input,select,a")) onOpenProfile(); }}
      className="group relative flex cursor-pointer flex-col items-center rounded-xl border border-[#E4E7EC] bg-white p-4 text-center transition hover:border-blue-200 hover:bg-blue-50/30"
    >
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="absolute right-2 top-2 z-20 rounded-lg border border-[#E4E7EC] bg-white p-1.5 text-[#667085] opacity-0 transition hover:border-[#D92D20] hover:text-[#D92D20] group-hover:opacity-100"
        title="Delete"
      >
        <TrashIcon className="h-3 w-3" />
      </button>

      <div className="relative h-28 w-28">
        <ProfileAvatar name={u.name} imageUrl={u.profile_image_url} className="h-28 w-28 rounded-2xl border border-slate-200 shadow-sm" fallbackClassName="rounded-2xl bg-indigo-600" />
        <button
          onClick={(e) => { e.stopPropagation(); onViewImage(); }}
          className="absolute inset-0 flex items-end justify-center rounded-2xl bg-black/20 px-2 pb-2 text-[10px] font-bold uppercase tracking-wide text-white opacity-0 transition group-hover:opacity-100"
          title="View profile image"
        >
          View
        </button>

        <div ref={menuRef} className="absolute -bottom-2 -right-2 z-20">
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-[#E4E7EC] bg-white text-[#344054] shadow-md hover:border-[#2554C7] hover:text-[#2554C7]"
            title="More"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <circle cx="4" cy="10" r="1.6" />
              <circle cx="10" cy="10" r="1.6" />
              <circle cx="16" cy="10" r="1.6" />
            </svg>
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full z-30 mt-1.5 w-36 overflow-hidden rounded-lg border border-[#E4E7EC] bg-white text-left shadow-lg">
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onOpenProfile(); }}
                className="block w-full px-3 py-2 text-left text-[11px] font-semibold text-[#344054] hover:bg-[#F9FAFB]"
              >
                Edit
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onResetPassword(); }}
                className="block w-full px-3 py-2 text-left text-[11px] font-semibold text-[#344054] hover:bg-[#F9FAFB]"
              >
                Reset PW
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onToggleActive(); }}
                className="block w-full px-3 py-2 text-left text-[11px] font-semibold text-[#344054] hover:bg-[#F9FAFB]"
              >
                {u.is_active ? "Deactivate" : "Activate"}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-2.5 flex w-full min-w-0 flex-col items-center gap-1">
        <span className="w-full truncate text-sm font-semibold text-[#101828]">{u.name}</span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${u.role === "admin" ? "bg-[#EEF4FF] text-[#17368F]" : "bg-[#F1F2F4] text-[#667085]"}`}>
          {u.role === "admin" ? "admin" : u.role === "user" ? "user" : "communicator"}
        </span>
        <div className="flex flex-wrap items-center justify-center gap-1">
          {!u.is_active && <span className="rounded-full bg-[#FEF3F2] px-2 py-0.5 text-[10px] font-bold uppercase text-[#D92D20]">Deactivated</span>}
          {u.is_super_admin && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-800">Super Admin</span>}
        </div>
      </div>

      <div className="mt-3 flex w-full items-center justify-center gap-1.5">
        {["executive", "user"].includes(u.role) && (
          <button
            onClick={(e) => { e.stopPropagation(); onAccess(); }}
            className="rounded-full bg-[#EEF4FF] px-3 py-1.5 text-[11px] font-bold text-[#17368F] hover:bg-[#DBEAFE]"
          >
            Access
          </button>
        )}
      </div>
    </div>
  );
}

function EditUserModal({ user, canChangeRole, onSave, onClose }) {
  const [values, setValues] = useState({
    name: user.name || "", username: user.username || "", email: user.email || "", phone: user.phone || "",
    designation: user.designation || "", center: user.center || "", role: user.role || "executive",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSave(user.id, {
        name: values.name.trim(),
        username: values.username.trim(),
        email: values.email.trim(),
        phone: values.phone.trim(),
        designation: values.designation.trim(),
        center: values.center.trim(),
        ...(canChangeRole ? { role: values.role } : {}),
      });
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Account তথ্য update করা যায়নি।");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close edit account"
        className="absolute inset-0 bg-[#101828]/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <form onSubmit={handleSubmit} className="relative z-10 w-full max-w-md rounded-2xl border border-[#E4E7EC] bg-white p-5 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-black text-[#101828]">Account তথ্য পরিবর্তন</h2>
            <p className="mt-1 text-xs text-[#667085]">{user.role === "admin" ? "Admin" : "Communicator"} account-এর name ও email edit করুন।</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-[#667085] hover:bg-[#F2F4F7]">✕</button>
        </div>

        <div className="space-y-4">
          <Field label="Name">
            <input
              required
              autoFocus
              className="input"
              value={values.name}
              onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))}
            />
          </Field>
          <Field label="Email">
            <input
              required
              type="email"
              className="input"
              value={values.email}
              onChange={(event) => setValues((current) => ({ ...current, email: event.target.value }))}
            />
          </Field>
          <Field label="Username">
            <input
              required
              className="input"
              value={values.username}
              onChange={(event) => setValues((current) => ({ ...current, username: event.target.value }))}
            />
          </Field>
          <Field label="Phone Number">
            <input required type="tel" className="input" value={values.phone} onChange={(event) => setValues((current) => ({ ...current, phone: event.target.value }))} />
          </Field>
          <Field label="পদবী / Designation">
            <input className="input" value={values.designation} onChange={(event) => setValues((current) => ({ ...current, designation: event.target.value }))} />
          </Field>
          <Field label="Center">
            <input className="input" value={values.center} onChange={(event) => setValues((current) => ({ ...current, center: event.target.value }))} />
          </Field>
          {canChangeRole && (
            <Field label="Role">
              <select
                className="input"
                value={values.role}
                disabled={user.is_super_admin}
                onChange={(event) => setValues((current) => ({ ...current, role: event.target.value }))}
              >
                <option value="admin">Admin</option>
                <option value="executive">Communicator</option>
                <option value="user">User</option>
              </select>
            </Field>
          )}
        </div>

        {error && <div className="mt-4 rounded-lg bg-[#FEF3F2] px-3 py-2 text-xs font-semibold text-[#D92D20]">{error}</div>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-[#D0D5DD] px-4 py-2 text-xs font-semibold text-[#344054] hover:bg-[#F9FAFB]">
            Cancel
          </button>
          <button disabled={saving} type="submit" className="rounded-lg bg-[#2554C7] px-4 py-2 text-xs font-bold text-white hover:bg-[#17368F] disabled:opacity-60">
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}

function AccessModal({ user, onToggleCustomerAccess, onToggleManualLeadAccess, onToggleEventCreateAccess, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Blurred backdrop */}
      <div className="absolute inset-0 bg-[#101828]/40 backdrop-blur-sm" onClick={onClose} />

      {/* Card */}
      <div className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl">
        {/* Header: name + email */}
        <div className="flex items-start justify-between gap-3 border-b border-[#F1F2F4] px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-base font-black text-[#101828]">{user.name}</span>
              <span className="rounded-full bg-[#F1F2F4] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#667085]">{user.role === "admin" ? "admin" : "communicator"}</span>
            </div>
            <div className="truncate text-xs text-[#98A2B3]">{user.email}</div>
          </div>
          <button onClick={onClose} className="flex-shrink-0 rounded-full border border-[#E4E7EC] px-3 py-1.5 text-xs font-semibold text-[#667085] hover:border-[#2554C7] hover:text-[#2554C7]">
            Close
          </button>
        </div>

        {/* Global access control */}
        <div className="border-b border-[#F1F2F4] px-5 py-4">
          <div className="flex flex-col gap-3">
            <label className="flex w-fit items-center gap-2 text-xs font-semibold text-[#344054]">
              <input type="checkbox" checked={user.role === "user" || Boolean(user.can_manage_customers)} onChange={onToggleCustomerAccess} disabled={user.role === "user"} className="h-4 w-4" />
              Guest Profile তালিকা দেখতে পারবে (global)
            </label>
            <label className="flex w-fit items-center gap-2 text-xs font-semibold text-[#344054]">
              <input type="checkbox" checked={user.role === "user" || Boolean(user.can_manual_lead_entry)} onChange={onToggleManualLeadAccess} disabled={user.role === "user"} className="h-4 w-4" />
              Manual Lead Entry করতে পারবে (global)
            </label>
            {user.role === "user" && (
              <label className="flex w-fit items-center gap-2 text-xs font-semibold text-[#344054]">
                <input type="checkbox" checked={Boolean(user.can_create_events)} onChange={onToggleEventCreateAccess} className="h-4 w-4" />
                নতুন Event তৈরি করতে পারবে
              </label>
            )}
            <div className="rounded-lg bg-[#EEF4FF] px-3 py-2 text-xs font-semibold text-[#2554C7]">
              AI chat widget সব active user-এর জন্য available।
            </div>
          </div>
        </div>

        {/* Per-event access list */}
        <div className="px-5 py-4">
          <PermissionsEditor user={user} />
        </div>
      </div>
    </div>
  );
}

function PermissionsEditor({ user }) {
  const [projects, setProjects] = useState([]);
  const [permMap, setPermMap] = useState({}); // project_id -> {feature: bool}
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([listProjects(), listUserPermissions(user.id)])
      .then(([projRes, permRes]) => {
        setProjects(projRes.data);
        const map = {};
        permRes.data.forEach((p) => {
          map[p.project_id] = p;
        });
        setPermMap(map);
      })
      .finally(() => setLoading(false));
  }, [user.id]);

  function toggle(projectId, feature) {
    setSaved(false);
    setPermMap((prev) => {
      const current = prev[projectId] || { project_id: projectId };
      return { ...prev, [projectId]: { ...current, [feature]: !current[feature] } };
    });
  }

  function hasAnyPermission(projectId) {
    const p = permMap[projectId];
    return p && FEATURES.some((f) => p[f.key]);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = Object.values(permMap)
        .filter((p) => FEATURES.some((f) => p[f.key]))
        .map((p) => ({
          project_id: p.project_id,
          can_view: Boolean(p.can_view),
          can_view_registrations: Boolean(p.can_view_registrations),
          can_edit_event: Boolean(p.can_edit_event),
          can_edit_fields: Boolean(p.can_edit_fields),
          can_publish: Boolean(p.can_publish),
          can_export: Boolean(p.can_export),
          can_manage_tasks: Boolean(p.can_manage_tasks),
        }));
      await replaceUserPermissions(user.id, payload);
      setSaved(true);
      reloadPage({ usersAccessUserId: user.id });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="py-6 text-center text-xs text-[#98A2B3]">লোড হচ্ছে…</div>;

  return (
    <div>
      {projects.length === 0 ? (
        <div className="py-4 text-center text-xs text-[#98A2B3]">কোনো ইভেন্ট নেই।</div>
      ) : (
        <div className="flex flex-col gap-3">
          {projects.map((p) => (
            <div key={p.id} className={`rounded-lg border p-3 ${hasAnyPermission(p.id) ? "border-[#2554C7]/30 bg-[#EEF4FF]" : "border-[#E4E7EC]"}`}>
              <div className="mb-2 text-xs font-bold text-[#101828]">{p.name}</div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-3">
                {FEATURES.map((f) => (
                  <label key={f.key} className="flex items-center gap-1.5 text-[11px] text-[#344054]">
                    <input
                      type="checkbox"
                      checked={Boolean(permMap[p.id]?.[f.key])}
                      onChange={() => toggle(p.id, f.key)}
                    />
                    {f.label}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center gap-3">
        <button onClick={handleSave} disabled={saving} className="rounded-full bg-[#027A48] px-5 py-2 text-xs font-bold text-white hover:opacity-90 disabled:opacity-60">
          {saving ? "Saving…" : "Save Access"}
        </button>
        {saved && (
          <span className="flex items-center gap-1 text-xs font-semibold text-[#027A48]">
            <CheckCircleIcon className="h-3.5 w-3.5" /> Saved
          </span>
        )}
      </div>

      <style>{`
        .input { width: 100%; border: 1px solid #E4E7EC; border-radius: 8px; padding: 9px 11px; font-size: 13px; outline: none; }
        .input:focus { border-color: #2554C7; box-shadow: 0 0 0 3px #EEF4FF; }
      `}</style>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-bold uppercase tracking-wide text-[#667085]">{label}</span>
      {children}
      <style>{`
        .input { width: 100%; border: 1px solid #E4E7EC; border-radius: 8px; padding: 9px 11px; font-size: 13px; outline: none; }
        .input:focus { border-color: #2554C7; box-shadow: 0 0 0 3px #EEF4FF; }
      `}</style>
    </label>
  );
}
