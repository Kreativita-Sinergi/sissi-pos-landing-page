"use client";

import React, { useId, useMemo, useState } from "react";
import Link from "next/link";
import { Cake, ChevronRight, Pencil, Plus, Trash2, UserRound, UsersRound } from "lucide-react";
import { ConfirmDialog, Modal } from "@/components/admin/ConfirmDialog";
import { ClearFiltersButton, FilterBar, FilterSelect } from "@/components/admin/FilterMenu";
import { SearchBox, useQueryState } from "@/components/admin/filters";
import { useToast } from "@/components/admin/toast";
import {
  Badge,
  btn,
  cardClass,
  EmptyState,
  ErrorBlock,
  errorMessage,
  Field,
  fieldErrors,
  focusRing,
  formatRupiah,
  iconBtn,
  inputClass,
  LoadingBar,
  Notice,
  PageHeader,
  Pagination,
  SkeletonList,
  Spinner,
  StatCard,
  Switch,
  tdClass,
  thClass,
  useLoad,
} from "@/components/admin/ui";
import { newId, ownerApi, pullAll } from "@/lib/owner/api";
import { addDays, MAX_DAYS } from "@/lib/owner/period";
import { CONFLICT_MESSAGE, deleteRecord, detailMap, hasFeature, saveErrorText, saveRecord } from "@/lib/owner/records";
import type { SaleListItem, SyncRecord } from "@/lib/owner/types";
import { zonedToday } from "@/lib/owner/tz";
import { useOwner } from "./OwnerShell";
import { formatStamp, SaleStatusBadge } from "./parts";
import { LockedCard, SyncNote } from "./ui";

// Pelanggan (Gratis & Pro): daftar dari GET /owner/data/customers, tambah/ubah/hapus lewat POST /owner/changes.
// Sisa kasbon (kunci `credit`) dihitung dari transaksi unpaid/partial 92 hari terakhir, dikelompokkan per nama
// pelanggan pada transaksi. Pelunasan kasbon hanya dari aplikasi.

type Customer = SyncRecord & {
  name: string;
  phone: string | null;
  email: string | null;
  notes: string;
  birthday: string | null;
  is_member: boolean;
};

type CreditInfo = { outstanding: number; count: number; sales: SaleListItem[] };
type CreditData = { byName: Record<string, CreditInfo>; total: number; count: number; truncated: boolean };

const PER_PAGE = 50;
const nameKey = (n: string | null | undefined) => (n ?? "").trim().toLocaleLowerCase("id-ID");

function creditRange() {
  const to = zonedToday();
  return { from: addDays(to, -(MAX_DAYS - 1)), to };
}

async function loadCredit(signal: AbortSignal): Promise<CreditData> {
  const api = await ownerApi();
  const { from, to } = creditRange();
  const rows: SaleListItem[] = [];
  let truncated = false;
  for (let page = 1; ; page++) {
    const r = await api.sales({ from, to, status: ["unpaid", "partial"], sort: "oldest", page, per_page: 100 }, signal);
    rows.push(...r.items);
    if (r.items.length === 0 || rows.length >= r.meta.total) break;
    if (page >= 20) {
      truncated = true;
      break;
    }
  }
  const byName: Record<string, CreditInfo> = {};
  let total = 0;
  for (const s of rows) {
    const rest = Math.max(0, s.total - s.paid_total);
    total += rest;
    const k = nameKey(s.customer_name);
    if (!k) continue;
    const cur = (byName[k] ??= { outstanding: 0, count: 0, sales: [] });
    cur.outstanding += rest;
    cur.count += 1;
    cur.sales.push(s);
  }
  return { byName, total, count: rows.length, truncated };
}

function formatBirthday(day: string | null): string {
  if (!day) return "—";
  const d = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return day;
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", timeZone: "UTC" }).format(d);
}

function displayPhone(p: string | null): string {
  if (!p) return "";
  return p.startsWith("+62") ? `0${p.slice(3)}` : p;
}

export function CustomersView() {
  const { session } = useOwner();
  const toast = useToast();
  const credit = hasFeature(session.subscription, "credit");
  const qs = useQueryState();
  const q = qs.get("q");
  const member = ["member", "non"].includes(qs.get("member")) ? qs.get("member") : "";
  const page = Math.max(1, Number(qs.get("page")) || 1);

  const { state, reload, setData } = useLoad<Customer[]>((signal) => pullAll<Customer>("customers", signal), []);
  const creditLoad = useLoad<CreditData | null>(async (signal) => (credit ? loadCredit(signal) : null), [credit ? 1 : 0]);
  const creditData = creditLoad.state.data ?? null;

  const [editing, setEditing] = useState<Customer | "new" | null>(null);
  const [detail, setDetail] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState<Customer | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const all = state.data;
  const filtered = useMemo(() => {
    if (!all) return [];
    const needle = q.trim().toLocaleLowerCase("id-ID");
    const digits = needle.replace(/\D/g, "");
    return all
      .filter((c) => (member === "member" ? c.is_member : member === "non" ? !c.is_member : true))
      .filter((c) => {
        if (!needle) return true;
        if (c.name.toLocaleLowerCase("id-ID").includes(needle)) return true;
        if (c.email && c.email.includes(needle)) return true;
        if (digits.length >= 3 && c.phone) {
          const p = c.phone.replace(/\D/g, "");
          const local = p.startsWith("62") ? `0${p.slice(2)}` : p;
          if (p.includes(digits) || local.includes(digits)) return true;
        }
        return false;
      })
      .sort((a, b) => a.name.localeCompare(b.name, "id-ID", { sensitivity: "base" }));
  }, [all, q, member]);
  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const curPage = Math.min(page, pages);
  const rows = filtered.slice((curPage - 1) * PER_PAGE, curPage * PER_PAGE);
  const filtering = !!q || !!member;

  const upsertLocal = (rec: SyncRecord) => {
    if (!all) return;
    const c = rec as Customer;
    const next = rec.deleted_at ? all.filter((x) => x.id !== c.id) : all.some((x) => x.id === c.id) ? all.map((x) => (x.id === c.id ? c : x)) : [...all, c];
    setData(next);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      const r = await deleteRecord("customers", deleting);
      if (r.status === "applied") {
        if (all) setData(all.filter((x) => x.id !== deleting.id));
        toast.success(`Pelanggan "${deleting.name}" dihapus.`);
      } else if (r.status === "conflict") {
        if (r.record) upsertLocal(r.record);
        toast.error(`${r.message} Periksa lalu hapus lagi bila perlu.`);
      } else {
        if (r.record) upsertLocal(r.record);
        toast.error(r.message);
      }
      setDeleting(null);
    } catch (err) {
      toast.error(saveErrorText(err, errorMessage));
    } finally {
      setDeleteBusy(false);
    }
  };

  const memberCount = all?.filter((c) => c.is_member).length ?? 0;

  return (
    <>
      <PageHeader
        title="Pelanggan"
        description="Data pelanggan dipakai bersama semua outlet dan perangkat kasir. Perubahan dari sini terkirim ke aplikasi saat perangkat sinkron."
        actions={
          <button type="button" className={btn.primary} onClick={() => setEditing("new")} disabled={!all}>
            <Plus size={17} aria-hidden /> Tambah pelanggan
          </button>
        }
      />

      {all && (
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Pelanggan" value={all.length} />
          <StatCard label="Member" value={memberCount} />
          {credit ? (
            <StatCard
              label="Sisa kasbon (92 hari)"
              value={creditData ? formatRupiah(creditData.total) : "…"}
              tone={creditData && creditData.total > 0 ? "warning" : "neutral"}
              hint={creditData ? `${creditData.count.toLocaleString("id-ID")} transaksi belum lunas` : creditLoad.state.status === "error" ? "Gagal memuat" : "Memuat…"}
            />
          ) : null}
        </div>
      )}

      <FilterBar>
        <SearchBox
          id="cari-pelanggan"
          label="Cari pelanggan"
          placeholder="Cari nama, nomor HP, atau email"
          value={q}
          onSearch={(v) => qs.update({ q: v || null }, "replace")}
          className="w-full sm:w-[320px]"
        />
        <FilterSelect
          label="Member"
          options={[
            { value: "member", label: "Member" },
            { value: "non", label: "Bukan member" },
          ]}
          selected={member ? [member] : []}
          onChange={(n) => qs.update({ member: n[0] ?? null })}
        />
        {filtering && <ClearFiltersButton onClick={() => qs.clear(["outlet"])} />}
      </FilterBar>

      {state.status === "error" && (
        <div className="mb-4">
          <ErrorBlock error={state.error} onRetry={reload} />
        </div>
      )}
      {!all && state.status === "loading" && <SkeletonList rows={8} label="Memuat pelanggan" />}
      {all && (
        <>
          <LoadingBar active={state.status === "loading"} />
          <section className={cardClass}>
            {filtered.length === 0 ? (
              filtering ? (
                <EmptyState icon={<UsersRound size={22} aria-hidden />} title="Tidak ada pelanggan yang cocok" action={<ClearFiltersButton onClick={() => qs.clear(["outlet"])} />}>
                  Coba kata kunci lain atau hapus filter.
                </EmptyState>
              ) : (
                <EmptyState
                  icon={<UsersRound size={22} aria-hidden />}
                  title="Belum ada pelanggan"
                  action={
                    <button type="button" className={btn.primary} onClick={() => setEditing("new")}>
                      <Plus size={17} aria-hidden /> Tambah pelanggan
                    </button>
                  }
                >
                  Pelanggan yang ditambahkan kasir di aplikasi juga muncul di sini.
                </EmptyState>
              )
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[320px] border-separate border-spacing-0 text-[14px]">
                  <thead>
                    <tr>
                      <th scope="col" className={thClass}>
                        Nama
                      </th>
                      <th scope="col" className={`${thClass} hidden md:table-cell`}>
                        Kontak
                      </th>
                      <th scope="col" className={`${thClass} hidden lg:table-cell`}>
                        Ulang tahun
                      </th>
                      {credit && (
                        <th scope="col" className={`${thClass} text-right`}>
                          Sisa kasbon
                        </th>
                      )}
                      <th scope="col" className={`${thClass} w-[1%] text-right`}>
                        <span className="sr-only">Aksi</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((c) => {
                      const k = creditData?.byName[nameKey(c.name)];
                      return (
                        <tr key={c.id} className="hover:bg-bg-muted/60">
                          <td className={`${tdClass} border-b border-border-subtle`}>
                            <button type="button" onClick={() => setDetail(c)} className={`group block rounded text-left ${focusRing}`}>
                              <span className="flex items-center gap-1.5 font-semibold text-text-heading group-hover:underline">
                                {c.name}
                                {c.is_member && <Badge tone="brand">Member</Badge>}
                              </span>
                              <span className="block text-[12.5px] text-text-muted md:hidden">{displayPhone(c.phone) || c.email || "Tanpa kontak"}</span>
                              {c.notes && <span className="line-clamp-1 block max-w-[360px] text-[12.5px] text-text-muted">{c.notes}</span>}
                            </button>
                          </td>
                          <td className={`${tdClass} hidden border-b border-border-subtle text-text-body md:table-cell`}>
                            <span className="block tabular-nums">{displayPhone(c.phone) || <span className="text-text-muted">—</span>}</span>
                            {c.email && <span className="block text-[12.5px] text-text-muted">{c.email}</span>}
                          </td>
                          <td className={`${tdClass} hidden border-b border-border-subtle text-text-body lg:table-cell`}>{formatBirthday(c.birthday)}</td>
                          {credit && (
                            <td className={`${tdClass} border-b border-border-subtle text-right tabular-nums whitespace-nowrap`}>
                              {k ? <span className="font-semibold text-warning">{formatRupiah(k.outstanding)}</span> : <span className="text-text-muted">—</span>}
                            </td>
                          )}
                          <td className={`${tdClass} border-b border-border-subtle`}>
                            <div className="flex justify-end gap-0.5">
                              <button type="button" className={iconBtn} onClick={() => setEditing(c)} aria-label={`Ubah ${c.name}`} title="Ubah">
                                <Pencil size={16} aria-hidden />
                              </button>
                              <button type="button" className={`${iconBtn} hover:text-danger`} onClick={() => setDeleting(c)} aria-label={`Hapus ${c.name}`} title="Hapus">
                                <Trash2 size={16} aria-hidden />
                              </button>
                              <button type="button" className={`${iconBtn} hidden sm:inline-flex`} onClick={() => setDetail(c)} aria-label={`Detail ${c.name}`} title="Detail">
                                <ChevronRight size={16} aria-hidden />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {filtered.length > PER_PAGE && (
              <div className="border-t border-border-subtle px-4 py-3 sm:px-5">
                <Pagination page={curPage} perPage={PER_PAGE} total={filtered.length} onPage={(p) => qs.update({ page: String(p) })} />
              </div>
            )}
          </section>
          {credit && creditData?.truncated && (
            <p className="mt-2 text-[12.5px] text-warning">Kasbon terlalu banyak untuk dihitung semuanya di web — angka di atas sebagian. Lihat lengkapnya di aplikasi.</p>
          )}
          <SyncNote className="mt-3" />
        </>
      )}

      <CustomerForm
        open={editing !== null}
        customer={editing === "new" ? null : editing}
        onClose={() => setEditing(null)}
        onSaved={(rec, created) => {
          upsertLocal(rec);
          toast.success(created ? `Pelanggan "${String(rec.name)}" ditambahkan.` : "Perubahan pelanggan disimpan.");
          setEditing(null);
        }}
        onConflict={(rec) => {
          upsertLocal(rec);
          setEditing(rec as Customer);
          toast.error(`${CONFLICT_MESSAGE} Periksa lalu simpan lagi.`);
        }}
      />

      <CustomerDetail
        customer={detail}
        credit={credit}
        creditInfo={detail && creditData ? creditData.byName[nameKey(detail.name)] ?? null : null}
        creditLoading={creditLoad.state.status === "loading"}
        onClose={() => setDetail(null)}
        onEdit={(c) => {
          setDetail(null);
          setEditing(c);
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        title="Hapus pelanggan?"
        confirmLabel="Hapus"
        tone="danger"
        busy={deleteBusy}
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      >
        <p>
          <strong className="font-semibold text-text-heading">{deleting?.name}</strong> akan dihapus dari daftar pelanggan di semua perangkat. Riwayat transaksi
          dan kasbon pelanggan ini tetap tersimpan.
        </p>
      </ConfirmDialog>
    </>
  );
}

// ——— Formulir tambah/ubah ———

type FormState = { name: string; phone: string; email: string; notes: string; birthday: string; is_member: boolean };

function toForm(c: Customer | null): FormState {
  return {
    name: c?.name ?? "",
    phone: displayPhone(c?.phone ?? null),
    email: c?.email ?? "",
    notes: c?.notes ?? "",
    birthday: c?.birthday ?? "",
    is_member: c?.is_member ?? false,
  };
}

function validate(f: FormState): Record<string, string> {
  const e: Record<string, string> = {};
  const name = f.name.trim();
  if (name.length < 2) e.name = "Nama minimal 2 huruf.";
  else if (name.length > 80) e.name = "Nama maksimal 80 huruf.";
  const phone = f.phone.trim();
  if (phone && !/^\+?[\d\s-]{6,20}$/.test(phone)) e.phone = "Nomor HP tidak valid.";
  const email = f.email.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Format email tidak valid.";
  if (f.notes.length > 300) e.notes = "Catatan maksimal 300 karakter.";
  if (f.birthday && (f.birthday < "1900-01-01" || f.birthday > zonedToday())) e.birthday = "Tanggal lahir tidak valid.";
  return e;
}

function CustomerForm({
  open,
  customer,
  onClose,
  onSaved,
  onConflict,
}: {
  open: boolean;
  customer: Customer | null;
  onClose: () => void;
  onSaved: (rec: SyncRecord, created: boolean) => void;
  onConflict: (rec: SyncRecord) => void;
}) {
  const formKey = open ? `${customer?.id ?? "new"}:${customer?.updated_at ?? ""}` : "closed";
  return (
    <Modal open={open} title={customer ? "Ubah pelanggan" : "Tambah pelanggan"} onClose={onClose} dismissible>
      {open && <CustomerFormBody key={formKey} customer={customer} onClose={onClose} onSaved={onSaved} onConflict={onConflict} />}
    </Modal>
  );
}

function CustomerFormBody({
  customer,
  onClose,
  onSaved,
  onConflict,
}: {
  customer: Customer | null;
  onClose: () => void;
  onSaved: (rec: SyncRecord, created: boolean) => void;
  onConflict: (rec: SyncRecord) => void;
}) {
  const uid = useId();
  const [form, setForm] = useState<FormState>(() => toForm(customer));
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<{ tone: "danger" | "warning"; text: string } | null>(null);
  const localErrors = validate(form);
  const errors = { ...(touched ? localErrors : {}), ...serverErrors };
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setServerErrors((e) => {
      if (!(k in e)) return e;
      const next = { ...e };
      delete next[k];
      return next;
    });
  };

  const submit = async () => {
    setTouched(true);
    if (Object.keys(localErrors).length) return;
    setBusy(true);
    setNotice(null);
    const patch = {
      name: form.name.trim(),
      phone: form.phone.trim() ? form.phone.replace(/[\s-]/g, "") : null,
      email: form.email.trim() ? form.email.trim().toLowerCase() : null,
      notes: form.notes.trim(),
      birthday: form.birthday || null,
      is_member: form.is_member,
    };
    try {
      const id = customer?.id ?? newId();
      const r = await saveRecord("customers", id, customer, patch);
      if (r.status === "applied") {
        onSaved(r.record ?? { ...(customer ?? {}), ...patch, id, updated_at: new Date().toISOString(), deleted_at: null }, !customer);
      } else if (r.status === "conflict") {
        if (r.record && !r.record.deleted_at) onConflict(r.record);
        else setNotice({ tone: "warning", text: "Pelanggan ini sudah dihapus di perangkat lain." });
      } else {
        setServerErrors(detailMap(r.details));
        setNotice({ tone: "danger", text: r.message });
      }
    } catch (err) {
      const fe = fieldErrors(err);
      setServerErrors(fe);
      setNotice({ tone: "danger", text: saveErrorText(err, errorMessage) });
    } finally {
      setBusy(false);
    }
  };

  const fid = (k: string) => `${uid}-${k}`;
  const describe = (k: string) => (errors[k] ? `${fid(k)}-error` : undefined);

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="flex flex-col gap-4"
    >
      {notice && (
        <Notice tone={notice.tone} role="alert">
          {notice.text}
        </Notice>
      )}
      <Field id={fid("name")} label="Nama" error={errors.name}>
        <input
          id={fid("name")}
          className={inputClass}
          value={form.name}
          maxLength={80}
          autoComplete="off"
          aria-invalid={!!errors.name || undefined}
          aria-describedby={describe("name")}
          onChange={(e) => set("name", e.target.value)}
          autoFocus
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={fid("phone")} label="Nomor HP (opsional)" error={errors.phone} hint="Contoh 0812 3456 7890">
          <input
            id={fid("phone")}
            type="tel"
            inputMode="tel"
            className={inputClass}
            value={form.phone}
            maxLength={20}
            autoComplete="off"
            aria-invalid={!!errors.phone || undefined}
            aria-describedby={describe("phone")}
            onChange={(e) => set("phone", e.target.value)}
          />
        </Field>
        <Field id={fid("email")} label="Email (opsional)" error={errors.email}>
          <input
            id={fid("email")}
            type="email"
            className={inputClass}
            value={form.email}
            maxLength={254}
            autoComplete="off"
            aria-invalid={!!errors.email || undefined}
            aria-describedby={describe("email")}
            onChange={(e) => set("email", e.target.value)}
          />
        </Field>
      </div>
      <Field id={fid("birthday")} label="Ulang tahun (opsional)" error={errors.birthday} hint="Dipakai untuk poin ulang tahun member.">
        <input
          id={fid("birthday")}
          type="date"
          className={`${inputClass} tabular-nums sm:max-w-[220px]`}
          value={form.birthday}
          min="1900-01-01"
          max={zonedToday()}
          aria-invalid={!!errors.birthday || undefined}
          aria-describedby={describe("birthday")}
          onChange={(e) => set("birthday", e.target.value)}
        />
      </Field>
      <Field id={fid("notes")} label="Catatan (opsional)" error={errors.notes} hint={`${form.notes.length}/300`}>
        <textarea
          id={fid("notes")}
          className={`${inputClass} min-h-[80px] py-2`}
          value={form.notes}
          maxLength={300}
          aria-invalid={!!errors.notes || undefined}
          aria-describedby={describe("notes")}
          onChange={(e) => set("notes", e.target.value)}
        />
      </Field>
      <Switch
        id={fid("member")}
        label="Member"
        description="Member mendapat poin loyalti saat transaksi lunas (bila loyalti aktif di Pengaturan)."
        checked={form.is_member}
        onChange={(v) => set("is_member", v)}
      />
      <div className="mt-1 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" className={btn.secondary} onClick={onClose} disabled={busy}>
          Batal
        </button>
        <button type="submit" className={btn.primary} disabled={busy}>
          {busy && <Spinner />}
          {customer ? "Simpan" : "Tambah"}
        </button>
      </div>
    </form>
  );
}

// ——— Detail ———

function CustomerDetail({
  customer,
  credit,
  creditInfo,
  creditLoading,
  onClose,
  onEdit,
}: {
  customer: Customer | null;
  credit: boolean;
  creditInfo: CreditInfo | null;
  creditLoading: boolean;
  onClose: () => void;
  onEdit: (c: Customer) => void;
}) {
  return (
    <Modal open={customer !== null} title={customer?.name ?? "Pelanggan"} onClose={onClose} icon={<UserRound size={20} aria-hidden className="text-brand-ink" />}>
      {customer && <CustomerDetailBody customer={customer} credit={credit} creditInfo={creditInfo} creditLoading={creditLoading} onEdit={onEdit} />}
    </Modal>
  );
}

function CustomerDetailBody({
  customer: c,
  credit,
  creditInfo,
  creditLoading,
  onEdit,
}: {
  customer: Customer;
  credit: boolean;
  creditInfo: CreditInfo | null;
  creditLoading: boolean;
  onEdit: (c: Customer) => void;
}) {
  const { withOutlet } = useOwner();
  const range = creditRange();
  const q = c.name.trim().slice(0, 60);
  const recent = useLoad<SaleListItem[]>(
    async (signal) => {
      const r = await (await ownerApi()).sales({ from: range.from, to: range.to, q, per_page: 50, sort: "newest" }, signal);
      // `q` mencocokkan potongan nama; ambil yang namanya sama persis.
      return r.items.filter((s) => nameKey(s.customer_name) === nameKey(c.name)).slice(0, 10);
    },
    [c.id, q]
  );

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[14px]">
        <dt className="text-text-muted">Nomor HP</dt>
        <dd className="tabular-nums">{displayPhone(c.phone) || "—"}</dd>
        <dt className="text-text-muted">Email</dt>
        <dd className="break-all">{c.email || "—"}</dd>
        <dt className="text-text-muted">Ulang tahun</dt>
        <dd className="flex items-center gap-1.5">
          {c.birthday && <Cake size={14} aria-hidden className="text-text-muted" />}
          {formatBirthday(c.birthday)}
        </dd>
        <dt className="text-text-muted">Status</dt>
        <dd>{c.is_member ? <Badge tone="brand">Member</Badge> : "Bukan member"}</dd>
        {c.notes && (
          <>
            <dt className="text-text-muted">Catatan</dt>
            <dd className="whitespace-pre-line">{c.notes}</dd>
          </>
        )}
      </dl>
      <button type="button" className={`${btn.secondary} self-start`} onClick={() => onEdit(c)}>
        <Pencil size={15} aria-hidden /> Ubah data
      </button>

      {credit ? (
        <div className="rounded-[12px] border border-border-subtle p-3.5">
          <p className="text-[13px] font-semibold text-text-heading">Sisa kasbon</p>
          {creditLoading && !creditInfo ? (
            <p className="mt-1 flex items-center gap-2 text-[13px] text-text-muted">
              <Spinner /> Menghitung…
            </p>
          ) : creditInfo ? (
            <>
              <p className="mt-0.5 text-[20px] font-bold tabular-nums text-warning">{formatRupiah(creditInfo.outstanding)}</p>
              <p className="text-[12.5px] text-text-muted">{creditInfo.count.toLocaleString("id-ID")} transaksi belum lunas (92 hari terakhir)</p>
              <ul className="mt-2 divide-y divide-border-subtle">
                {creditInfo.sales.slice(0, 5).map((s) => (
                  <li key={s.id}>
                    <Link href={withOutlet(`/dasbor/transaksi/${s.id}`)} className={`flex items-center gap-2 py-1.5 text-[13px] hover:underline ${focusRing}`}>
                      <span className="tabular-nums text-text-muted">{formatStamp(s.paid_at)}</span>
                      <span className="tabular-nums">{s.receipt_no}</span>
                      <span className="ml-auto font-semibold tabular-nums">{formatRupiah(s.total - s.paid_total)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-0.5 text-[13px] text-text-body">Tidak ada kasbon dalam 92 hari terakhir.</p>
          )}
          <p className="mt-2 text-[12.5px] text-text-muted">Pelunasan kasbon dicatat lewat aplikasi Sissi (menu Belum lunas), bukan dari web.</p>
        </div>
      ) : (
        <LockedCard title="Sisa kasbon" compact>
          Pantau kasbon pelanggan beserta pengingatnya dengan paket Pro.
        </LockedCard>
      )}

      <div>
        <p className="mb-1.5 text-[13px] font-semibold text-text-heading">Transaksi terakhir</p>
        {recent.state.status === "error" ? (
          <ErrorBlock error={recent.state.error} onRetry={recent.reload} />
        ) : !recent.state.data ? (
          <p className="flex items-center gap-2 text-[13px] text-text-muted">
            <Spinner /> Memuat…
          </p>
        ) : recent.state.data.length === 0 ? (
          <p className="text-[13px] text-text-muted">Belum ada transaksi atas nama ini dalam 92 hari terakhir.</p>
        ) : (
          <ul className="divide-y divide-border-subtle rounded-[12px] border border-border-subtle">
            {recent.state.data.map((s) => (
              <li key={s.id}>
                <Link href={withOutlet(`/dasbor/transaksi/${s.id}`)} className={`flex items-center gap-3 px-3 py-2 text-[13px] hover:bg-bg-muted/60 ${focusRing}`}>
                  <span className="min-w-0">
                    <span className="block font-semibold tabular-nums">{formatStamp(s.paid_at)}</span>
                    <span className="block truncate text-[12px] text-text-muted">
                      {s.receipt_no} · {s.outlet_name}
                    </span>
                  </span>
                  <span className="ml-auto text-right font-semibold tabular-nums">{formatRupiah(s.total)}</span>
                  <SaleStatusBadge status={s.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-1.5 text-[12px] text-text-muted">Dicocokkan dari nama pelanggan pada transaksi.</p>
      </div>
    </div>
  );
}
