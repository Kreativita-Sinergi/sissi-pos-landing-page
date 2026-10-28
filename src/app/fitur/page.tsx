import React from "react";
import type { Metadata } from "next";
import Image from "next/image";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { AjakanSection } from "@/components/sections/AjakanSection";

export const metadata: Metadata = {
  title: "Fitur · Sissi POS",
  description:
    "Kasir offline, QRIS statis, printer Bluetooth & Wi-Fi, layar dapur, pesan lewat QR meja, impor produk Excel/CSV, varian dan HPP dari resep, stok bahan baku, PO dan opname, shift, laporan, absensi dan gaji, order servis, serta booking sewa. Semua di HP dan tablet Android.",
};

interface FeatureItem {
  title: string;
  description: string;
  soon?: boolean;
}

interface FeatureBlock {
  id: string;
  label: string;
  title: string;
  image: string;
  imageAlt: string;
  items: FeatureItem[];
}

const FEATURE_BLOCKS: FeatureBlock[] = [
  {
    id: "kasir-pembayaran",
    label: "Kasir & pembayaran",
    title: "Dari pilih menu sampai uang diterima.",
    image: "/images/app/bayar-tablet.webp",
    imageAlt: "Layar Pembayaran Sissi: total Rp117.810 dengan pilihan Tunai, QRIS, Kartu, Transfer, Kasbon.",
    items: [
      {
        title: "Cari, pilih kategori, atau pindai barcode",
        description: "Di tablet lewat scanner mode keyboard, di HP lewat kamera.",
      },
      {
        title: "Tunai, QRIS, kartu, transfer, atau dibagi",
        description: "Tombol uang pas dan nominal cepat, kembalian dihitung otomatis.",
      },
      {
        title: "QRIS statis tokomu",
        description: "Unggah gambar QRIS atau pindai stikernya; QR tampil di layar saat bayar.",
      },
      {
        title: "Kasbon",
        description: "Sisa tagihan tercatat per pelanggan dengan jatuh tempo, bisa dilunasi sebagian.",
      },
      {
        title: "Diskon, pajak & biaya layanan",
        description: "Diskon otomatis atau dipilih kasir, pajak per item, pembulatan.",
      },
      {
        title: "Void & refund dengan alasan",
        description: "Kasir butuh PIN pemilik; uang kembali dicatat per metode.",
      },
      {
        title: "Struk",
        description: "Cetak ke printer thermal Bluetooth atau Wi-Fi/LAN 58/80 mm, atau kirim lewat WhatsApp.",
      },
      {
        title: "Banyak printer, struk & dapur",
        description: "Satu printer untuk struk kasir, satu lagi khusus tiket dapur. Laci uang terbuka saat bayar tunai.",
      },
    ],
  },
  {
    id: "meja-dapur",
    label: "Meja & dapur",
    title: "Pesanan meja langsung muncul di dapur.",
    image: "/images/app/dapur-tablet.webp",
    imageAlt: "Layar dapur Sissi dengan tiket per meja di kolom Masuk, Dimasak, dan Siap.",
    items: [
      {
        title: "Meja & area",
        description: "Lihat meja kosong dan terisi, lama duduk, dan tagihannya.",
      },
      {
        title: "Pesanan berjalan",
        description: "Simpan dulu, tambah item kapan saja, bayar di akhir.",
      },
      {
        title: "Pisah pesanan",
        description: "Pindahkan sebagian item ke tagihan baru; tiket dapurnya ikut pindah.",
      },
      {
        title: "Layar dapur",
        description: "Tiket per ronde, status per item, tambahan ditandai TAMBAHAN.",
      },
      {
        title: "Pesan lewat QR di meja",
        description: "Pelanggan memindai QR, memesan dari HP-nya, lalu bayar di kasir; setelah lunas pesanan langsung masuk dapur.",
      },
    ],
  },
  {
    id: "produk-varian",
    label: "Produk, varian & HPP",
    title: "Tahu modal tiap cangkir, bukan kira-kira.",
    image: "/images/app/varian-tablet.webp",
    imageAlt: "Form produk Sissi: varian Ukuran (S, M, L) dan Suhu (Panas, Es) dengan daftar kombinasi.",
    items: [
      {
        title: "Impor produk dari Excel/CSV",
        description: "Isi template di Excel atau Google Sheets, periksa pratinjau, impor sampai 1.000 produk sekaligus.",
      },
      {
        title: "Varian multi-dimensi",
        description: "Sampai tiga pilihan, mis. Ukuran × Suhu; kombinasinya dibuat otomatis.",
      },
      {
        title: "Isi massal",
        description: "Isi harga, HPP, atau stok banyak varian sekaligus dengan pratinjau.",
      },
      {
        title: "HPP manual atau dari resep",
        description: "Per produk atau per varian; resep memakai bahan baku dengan satuan g/kg, ml/l.",
      },
      {
        title: "Modifier dengan HPP",
        description: "Topping atau level gula punya harga tambahan dan modal sendiri.",
      },
    ],
  },
  {
    id: "stok",
    label: "Stok & pembelian",
    title: "Stok berkurang sendiri setiap ada penjualan.",
    image: "/images/app/inventori-tablet.webp",
    imageAlt: "Halaman Inventori Sissi dengan stok barang, bahan baku, opname, pembelian, supplier, dan transfer stok.",
    items: [
      {
        title: "Stok barang & bahan baku",
        description: "Status habis, menipis, aman; riwayat masuk, limbah, dan koreksi.",
      },
      {
        title: "Stok opname",
        description: "Hitung fisik, pindai barcode, lihat lebih/kurang dan nilainya.",
      },
      {
        title: "Pembelian (PO) & supplier",
        description: "Draf PO, kirim lewat WhatsApp, terima sebagian.",
      },
      {
        title: "Saran belanja",
        description: "Dari stok yang menipis, langsung jadi draf PO per supplier.",
      },
      {
        title: "Transfer antar-outlet",
        description: "Pindahkan stok dari satu outlet ke outlet lain.",
      },
    ],
  },
  {
    id: "shift-kas",
    label: "Shift & kas",
    title: "Uang di laci cocok dengan catatan.",
    image: "/images/app/tutup-kasir-tablet.webp",
    imageAlt: "Layar Tutup Kasir Sissi dengan hitungan uang fisik dan ringkasan shift.",
    items: [
      {
        title: "Buka & tutup kasir",
        description: "Modal awal per perangkat, hitung akhir cukup ketik total.",
      },
      {
        title: "Kas masuk & keluar",
        description: "Uang belanja atau setoran di tengah shift ikut dihitung.",
      },
      {
        title: "Selisih kas",
        description: "Terlihat di laporan tutup kasir dan dikirim sebagai notifikasi ke HP pemilik.",
      },
    ],
  },
  {
    id: "laporan",
    label: "Laporan & riwayat",
    title: "Tahu kondisi toko tanpa menunggu malam.",
    image: "/images/app/laporan-tablet.webp",
    imageAlt: "Laporan Sissi tab Jam ramai dengan grafik transaksi per jam dan per hari.",
    items: [
      {
        title: "Ringkasan",
        description: "Omzet dibanding periode lalu, laba kotor, diskon, pajak, piutang.",
      },
      {
        title: "Produk terjual, jam ramai, per kasir",
        description: "Hari ini, 7 hari, 30 hari, atau rentang sendiri.",
      },
      {
        title: "Riwayat transaksi",
        description: "Cari dan saring, cetak ulang, lunasi kasbon, pesan ulang.",
      },
      {
        title: "Ekspor CSV",
        description: "Riwayat dan laporan bisa dibuka di spreadsheet.",
      },
    ],
  },
  {
    id: "tim",
    label: "Tim & absensi",
    title: "Setiap karyawan masuk dengan PIN sendiri.",
    image: "/images/app/kehadiran-tablet.webp",
    imageAlt: "Layar Kehadiran Sissi dengan jam besar dan tombol Absen masuk / Absen pulang.",
    items: [
      {
        title: "Peran pemilik, kasir, dapur",
        description: "Menu yang tampil mengikuti peran. PIN bekerja walau offline.",
      },
      {
        title: "Absensi",
        description: "Absen masuk dan pulang di perangkat kasir, aturan jam kerja, koreksi beralasan.",
      },
      {
        title: "Gaji & slip gaji",
        description: "Rekap per bulan dari kehadiran, slip bisa dicetak dan ditandai dibayar.",
      },
    ],
  },
  {
    id: "pelanggan",
    label: "Pelanggan & member",
    title: "Pelanggan tetap dikenali di kasir.",
    image: "/images/app/pelanggan-tablet.webp",
    imageAlt: "Detail pelanggan Sissi dengan total belanja, kunjungan, poin, dan tingkat member.",
    items: [
      {
        title: "Poin & tingkat member",
        description: "Poin per belanja, tukar poin saat bayar, diskon per tingkat.",
      },
      {
        title: "Kasbon per pelanggan",
        description: "Lunasi sekaligus, atau ingatkan lewat WhatsApp.",
      },
      {
        title: "Riwayat & ulang tahun",
        description: "Riwayat belanja dan pengingat ulang tahun member.",
      },
    ],
  },
  {
    id: "servis",
    label: "Untuk usaha jasa",
    title: "Order servis dari diterima sampai diambil.",
    image: "/images/app/servis-tablet.webp",
    imageAlt: "Antrean servis Sissi dengan kolom Diterima, Dikerjakan, dan Siap diambil.",
    items: [
      {
        title: "Antrean servis",
        description: "Diterima, dikerjakan, selesai, diambil. Yang terlambat tampil paling atas.",
      },
      {
        title: "Data per jenis jasa",
        description: "Plat nomor untuk bengkel, IMEI untuk servis HP, dan lainnya.",
      },
      {
        title: "Teknisi & estimasi selesai",
        description: "Penanggung jawab per order; estimasi dari durasi layanan.",
      },
      {
        title: "DP, pelunasan & nota ambil",
        description: "Kabari pelanggan lewat WhatsApp saat siap.",
      },
    ],
  },
  {
    id: "penyewaan",
    label: "Untuk usaha penyewaan",
    title: "Jadwal per unit, tanpa pesanan bentrok.",
    image: "/images/app/jadwal-sewa-tablet.webp",
    imageAlt: "Jadwal sewa Sissi: kisi unit lapangan dan meja biliar per jam.",
    items: [
      {
        title: "Unit & tarif",
        description: "Tarif per jam dengan jam ramai, atau paket.",
      },
      {
        title: "Booking",
        description: "Jam yang sudah terisi tidak bisa dipesan lagi. DP atau lunas di depan.",
      },
      {
        title: "Sesi berjalan",
        description: "Timer per unit, perpanjang, lalu hentikan dan tagih.",
      },
      {
        title: "Pesanan makanan & minuman",
        description: "Masuk ke tagihan sesi yang sama.",
      },
    ],
  },
  {
    id: "akun",
    label: "Akun & perangkat",
    title: "Hal kecil yang membuat tenang.",
    image: "/images/app/kasir-tablet.webp",
    imageAlt: "Layar Kasir Sissi di tablet.",
    items: [
      {
        title: "Offline-first",
        description: "Semua dicatat di perangkat dulu, lalu sinkron otomatis antarperangkat.",
      },
      {
        title: "Notifikasi ke HP pemilik",
        description: "Selisih kas, void/refund, dan login dari perangkat baru.",
      },
      {
        title: "Masuk dengan Google",
        description: "Daftar dan masuk tanpa membuat kata sandi baru.",
      },
      {
        title: "Pemberitahuan pembaruan",
        description: "Aplikasi memberi tahu saat versi baru tersedia.",
      },
      {
        title: "Hapus akun",
        description: "Pemilik bisa meminta akun dan data usahanya dihapus.",
      },
    ],
  },
];

export default function FiturPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />

      <section className="bg-[#f1702c] pt-[110px] pb-14 sm:pb-20 text-white">
        <div className="max-w-[1200px] mx-auto px-6">
          <p className="text-[13px] font-mono font-medium text-[#fef1eb] tracking-wider uppercase mb-5">
            Fitur
          </p>
          <h1 className="text-[40px] sm:text-[56px] lg:text-[64px] font-semibold leading-[1.08] tracking-tight mb-5">
            Semua fitur Sissi
          </h1>
          <p className="text-[18px] sm:text-[19px] text-[#fef1eb] leading-relaxed max-w-[680px] mb-10">
            Dari meja kasir sampai laporan pemilik. Gambar di halaman ini
            adalah layar asli aplikasi.
          </p>

          <nav aria-label="Bagian fitur" className="flex items-center gap-2 flex-wrap">
            {FEATURE_BLOCKS.map((block) => (
              <a
                key={block.id}
                href={`#${block.id}`}
                className="px-4 py-2 rounded-full text-[14px] font-medium bg-white/15 hover:bg-white/25 text-white transition-colors"
              >
                {block.label}
              </a>
            ))}
          </nav>
        </div>
      </section>

      <main className="flex-1">
        {FEATURE_BLOCKS.map((block, idx) => (
          <section
            key={block.id}
            id={block.id}
            className={`py-16 sm:py-24 scroll-mt-20 border-b border-[#e4e9e7] ${
              idx % 2 === 1 ? "bg-[#f3f6f5]" : "bg-white"
            }`}
          >
            <div className="max-w-[1200px] mx-auto px-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-start">
                <div className="lg:col-span-5 flex flex-col">
                  <span className="text-[13px] font-mono font-medium text-[#be5823] tracking-wider uppercase mb-3">
                    {String(idx + 1).padStart(2, "0")} · {block.label}
                  </span>
                  <h2 className="text-[30px] sm:text-[40px] font-semibold text-[#292e31] leading-[1.15] tracking-tight mb-6">
                    {block.title}
                  </h2>

                  <dl className="flex flex-col divide-y divide-[#e4e9e7]">
                    {block.items.map((item) => (
                      <div key={item.title} className="py-4">
                        <dt className="flex items-center gap-2 flex-wrap text-[16px] font-semibold text-[#292e31]">
                          {item.title}
                          {item.soon && (
                            <span className="px-2 py-0.5 rounded-[4px] bg-[#292e31] text-[11px] font-mono font-medium text-white tracking-wider">
                              Segera hadir
                            </span>
                          )}
                        </dt>
                        <dd className="text-[15px] text-[#525866] mt-1 leading-relaxed">
                          {item.description}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>

                <div className="lg:col-span-7">
                  <div className="overflow-hidden rounded-[14px] border border-[#e4e9e7] bg-white shadow-[0_16px_44px_-20px_rgba(41,46,49,0.35)]">
                    <Image
                      src={block.image}
                      alt={block.imageAlt}
                      width={1280}
                      height={800}
                      className="block w-full h-auto"
                      sizes="(max-width: 1024px) 100vw, 680px"
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>
        ))}
      </main>

      <AjakanSection />
      <Footer />
    </div>
  );
}
