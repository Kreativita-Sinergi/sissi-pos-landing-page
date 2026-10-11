import React from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Container } from "@/components/shared/Container";
import { ACCOUNT_DELETION_GRACE_DAYS } from "@/constants/accountDeletion";
import { AccountDeletionForm } from "./AccountDeletionForm";

export const metadata = {
  title: "Hapus Akun · Sissi",
  description:
    "Panduan dan pengajuan penghapusan akun serta data usaha Sissi secara permanen.",
};

export default function HapusAkunPage() {
  return (
    <div className="flex min-h-screen flex-col w-full bg-[#f3f6f5]">
      {/* Subpage White Navbar */}
      <Navbar isLight />

      <main className="flex-1 pt-28 pb-20 sm:pb-24">
        <Container>
          <div className="max-w-[720px] mx-auto">
            {/* Header */}
            <div className="mb-10 text-left">
              <span className="text-[12px] font-medium font-mono tracking-wider uppercase text-[#f1702c] mb-2 block">
                BANTUAN / HAPUS AKUN
              </span>
              <h1 className="text-3xl sm:text-[44px] font-semibold text-[#292e31] tracking-tight leading-tight mb-3">
                Hapus akun Sissi
              </h1>
              <p className="text-base sm:text-[17px] text-[#525866] leading-relaxed">
                Akun dan semua data usaha akan dihapus permanen. Selama masa
                tunggu {ACCOUNT_DELETION_GRACE_DAYS} hari kamu masih bisa
                membatalkan dengan masuk kembali ke aplikasi. Setelah itu,
                langkah ini tidak bisa dibatalkan.
              </p>
            </div>

            {/* Card 1: Dari Aplikasi */}
            <div className="bg-white rounded-[16px] border border-[#e4e9e7] p-6 sm:p-8 shadow-2xs mb-6">
              <h2 className="text-[19px] font-semibold text-[#292e31] mb-5">
                Dari aplikasi
              </h2>
              <div className="flex flex-col gap-4">
                <div className="flex items-start gap-3.5">
                  <span className="w-6 h-6 rounded-full bg-[#f3f6f5] border border-[#e4e9e7] text-xs font-mono font-bold text-[#292e31] flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </span>
                  <p className="text-[15px] text-[#525866] leading-relaxed">
                    Buka menu <strong className="text-[#292e31] font-semibold">Atur</strong> di aplikasi.
                  </p>
                </div>
                <div className="flex items-start gap-3.5">
                  <span className="w-6 h-6 rounded-full bg-[#f3f6f5] border border-[#e4e9e7] text-xs font-mono font-bold text-[#292e31] flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </span>
                  <p className="text-[15px] text-[#525866] leading-relaxed">
                    Pilih <strong className="text-[#292e31] font-semibold">Akun & Keamanan</strong>.
                  </p>
                </div>
                <div className="flex items-start gap-3.5">
                  <span className="w-6 h-6 rounded-full bg-[#f3f6f5] border border-[#e4e9e7] text-xs font-mono font-bold text-[#292e31] flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </span>
                  <p className="text-[15px] text-[#525866] leading-relaxed">
                    Ketuk <strong className="text-[#292e31] font-semibold">Hapus Akun</strong>, lalu masukkan kode OTP yang dikirimkan.
                  </p>
                </div>
              </div>
            </div>

            {/* Card 2: Form Kirim Permintaan */}
            <div className="bg-white rounded-[16px] border border-[#e4e9e7] p-6 sm:p-8 shadow-2xs mb-6">
              <h2 className="text-[19px] font-semibold text-[#292e31] mb-2">
                Hapus lewat web
              </h2>
              <p className="text-[15px] text-[#525866] leading-relaxed mb-6">
                Tidak bisa masuk ke aplikasi, atau sudah menghapusnya dari HP?
                Ajukan di sini. Untuk memastikan kamu pemilik akun, kami
                mengirim kode verifikasi ke email akun.
              </p>

              <AccountDeletionForm />
            </div>

            {/* Card 3: Yang Dihapus */}
            <div className="bg-white rounded-[16px] border border-[#e4e9e7] p-6 sm:p-8 shadow-2xs">
              <h3 className="text-[17px] font-semibold text-[#292e31] mb-4">
                Yang dihapus
              </h3>
              <ul className="flex flex-col gap-2.5 text-[15px] text-[#525866]">
                <li className="flex items-center gap-2.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#f1702c]" />
                  <span>Data akun dan outlet</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#f1702c]" />
                  <span>Produk, transaksi, dan laporan penjualan</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#f1702c]" />
                  <span>Data karyawan, termasuk data wajah presensi</span>
                </li>
              </ul>
              <div className="mt-5 pt-4 border-t border-[#e4e9e7] text-[13px] text-[#7d8986] leading-relaxed">
                Setelah masa tunggu {ACCOUNT_DELETION_GRACE_DAYS} hari berakhir, data dihapus dari sistem aktif paling lambat 7 hari kerja, dan dari cadangan paling lambat 30 hari setelahnya.
                <br />
                Hanya pemilik usaha yang dapat menghapus akun usaha. Akun karyawan (kasir dan dapur) dihapus oleh pemilik dari menu Karyawan di aplikasi.
              </div>
            </div>
          </div>
        </Container>
      </main>

      <Footer />
    </div>
  );
}
