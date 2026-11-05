import { useEffect } from "react";

// Sub-bagian halaman dasbor pemilik (disimpan di ?tab=). Satu sumber untuk sub-menu sidebar (desktop)
// dan Tabs di dalam halaman (HP/tablet), juga judul + deskripsi halaman. Item pertama = bawaan, tautannya tanpa ?tab=.

export const PRODUCT_SECTIONS = [
  { id: "produk", label: "Produk", description: "Menu yang dijual di kasir. Perubahan diterima kasir saat sinkron berikutnya." },
  { id: "kategori", label: "Kategori", description: "Kelompokkan produk agar mudah dicari di kasir." },
  { id: "modifier", label: "Modifier", description: "Pilihan tambahan saat memesan, mis. tingkat gula atau topping. Pasang ke produk lewat panel produk." },
  { id: "diskon", label: "Diskon", description: "Diskon otomatis langsung terpasang di kasir; diskon lain dipilih kasir saat transaksi." },
] as const;

export const STOCK_SECTIONS = [
  { id: "stock", label: "Stok saat ini", description: "Jumlah stok yang dilacak" },
  { id: "opname", label: "Opname", description: "Cocokkan stok fisik & sistem" },
  { id: "po", label: "Pembelian", description: "Pesanan pembelian (PO) ke supplier" },
  { id: "transfer", label: "Transfer", description: "Pindahkan stok antar outlet" },
  { id: "supplier", label: "Supplier", description: "Kontak pemasok untuk PO" },
] as const;

export const TEAM_SECTIONS = [
  { id: "karyawan", label: "Karyawan", description: "Akun dan PIN kasir karyawan. Perubahan diterima kasir saat sinkron berikutnya." },
  { id: "kehadiran", label: "Kehadiran", description: "Catatan absen masuk dan pulang karyawan." },
  { id: "jadwal", label: "Jadwal", description: "Susun jadwal shift karyawan." },
  { id: "pengajuan", label: "Pengajuan", description: "Pengajuan izin dan cuti dari karyawan." },
  { id: "gaji", label: "Gaji", description: "Ringkasan gaji dan slip karyawan per bulan." },
] as const;

export type SubSection = { readonly id: string; readonly label: string; readonly description: string };

/** Sub-menu per href navigasi utama. */
export const SUB_SECTIONS: Record<string, readonly SubSection[]> = {
  "/dasbor/produk": PRODUCT_SECTIONS,
  "/dasbor/stok": STOCK_SECTIONS,
  "/dasbor/tim": TEAM_SECTIONS,
};

/** Bagian aktif dari nilai ?tab=; nilai tak dikenal jatuh ke bagian pertama. */
export function activeSection(sections: readonly SubSection[], tab: string | null): string {
  return sections.some((s) => s.id === tab) ? tab! : sections[0].id;
}

export function sectionHref(base: string, sections: readonly SubSection[], id: string): string {
  return id === sections[0].id ? base : `${base}?tab=${encodeURIComponent(id)}`;
}

export function sectionOf<S extends SubSection>(sections: readonly S[], id: string): S {
  return sections.find((s) => s.id === id) ?? sections[0];
}

/**
 * Judul tab browser mengikuti sub-bagian, mis. "Kategori · Produk · Dasbor Sissi" (bagian pertama: "Produk · Dasbor Sissi").
 * Metadata halaman statis dan Next memasang ulang <title> setiap navigasi ?tab= (router.push), jadi judul dijaga dengan
 * MutationObserver selama path halaman masih sama. Bukan generateMetadata({ searchParams }): dengan cacheComponents itu
 * memaksa halaman dirender per permintaan.
 */
export function useSectionTitle(page: string, sections: readonly SubSection[], id: string) {
  const label = id === sections[0].id ? null : sectionOf(sections, id).label;
  useEffect(() => {
    const want = `${label ? `${label} · ` : ""}${page} · Dasbor Sissi`;
    const path = window.location.pathname;
    const apply = () => {
      if (window.location.pathname === path && document.title !== want) document.title = want;
    };
    apply();
    const obs = new MutationObserver(apply);
    obs.observe(document.head, { subtree: true, childList: true, characterData: true });
    return () => obs.disconnect();
  }, [page, label]);
}
