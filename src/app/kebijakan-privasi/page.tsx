import React from "react";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Container } from "@/components/shared/Container";

export const metadata = {
  title: "Kebijakan Privasi · Sissi",
  description:
    "Kebijakan privasi dan perlindungan data pribadi pengguna aplikasi kasir Sissi.",
};

const TOC_ITEMS = [
  { id: "pengendali", title: "1. Pengendali Data" },
  { id: "data-dikumpulkan", title: "2. Data yang Kami Kumpulkan" },
  { id: "izin-aplikasi", title: "3. Izin Aplikasi" },
  { id: "data-wajah", title: "4. Data Presensi Wajah" },
  { id: "pihak-ketiga", title: "5. Pihak Ketiga & Pemrosesan" },
  { id: "penyimpanan", title: "6. Penyimpanan dan Retensi" },
  { id: "keamanan", title: "7. Keamanan Data" },
  { id: "hak-anda", title: "8. Hak Pengguna" },
  { id: "perubahan", title: "9. Perubahan Kebijakan" },
  { id: "kontak", title: "10. Kontak Petugas Privasi" },
];

export default function KebijakanPrivasiPage() {
  return (
    <div className="flex min-h-screen flex-col w-full bg-white">
      {/* Subpage White Navbar */}
      <Navbar isLight />

      <main className="flex-1 pt-28 pb-20">
        <Container>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
            {/* Left Sticky Table of Contents */}
            <aside className="lg:col-span-4 hidden lg:block sticky top-28 bg-[#f3f6f5] p-6 rounded-[16px] border border-[#e4e9e7]">
              <span className="text-[12px] font-semibold font-mono tracking-wider uppercase text-[#7d8986] mb-4 block">
                DAFTAR ISI
              </span>
              <nav className="flex flex-col gap-2.5">
                {TOC_ITEMS.map((item) => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    className="text-[14px] text-[#525866] hover:text-[#f1702c] transition-colors leading-relaxed"
                  >
                    {item.title}
                  </a>
                ))}
              </nav>
            </aside>

            {/* Right Document Content */}
            <article className="lg:col-span-8 max-w-[780px]">
              {/* Breadcrumb & Title */}
              <div className="border-b border-[#e4e9e7] pb-8 mb-10">
                <span className="text-[12px] font-medium font-mono tracking-wider uppercase text-[#f1702c] mb-3 block">
                  BERANDA / KEBIJAKAN PRIVASI
                </span>
                <h1 className="text-3xl sm:text-[40px] font-semibold text-[#292e31] tracking-tight leading-[1.14]">
                  Kebijakan Privasi Sissi
                </h1>
                <div className="mt-3 inline-flex items-center px-2.5 py-1 rounded-[6px] bg-[#f3f6f5] text-[13px] font-mono text-[#7d8986]">
                  Versi 1.0 · Berlaku sejak Oktober 2026
                </div>
                <p className="mt-6 text-[16px] sm:text-[17px] text-[#525866] leading-relaxed">
                  Kebijakan ini menjelaskan data apa yang dikumpulkan aplikasi Sissi, untuk apa data itu dipakai, berapa lama disimpan, dan hak Anda atas data tersebut dengan mengacu pada Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi.
                </p>
              </div>

              {/* Sections */}
              <div className="flex flex-col gap-10 text-[15px] sm:text-[16px] text-[#525866] leading-relaxed">
                <section id="pengendali" className="scroll-mt-28">
                  <h2 className="text-[20px] font-semibold text-[#292e31] mb-3">
                    1. Pengendali Data
                  </h2>
                  <p>
                    Layanan Sissi dioperasikan oleh tim pengembang resmi Sissi Kasir (&quot;Kami&quot;). Anda sebagai pemilik usaha bertindak sebagai Pengendali Data atas data pelanggan dan staf Anda, dan kami bertindak sebagai Prosesor Data terpercaya Anda.
                  </p>
                </section>

                <section id="data-dikumpulkan" className="scroll-mt-28">
                  <h2 className="text-[20px] font-semibold text-[#292e31] mb-3">
                    2. Data yang Kami Kumpulkan
                  </h2>
                  <ul className="flex flex-col gap-2.5">
                    <li>
                      <strong className="text-[#292e31]">Informasi Akun:</strong> Nama pemilik, nama usaha, nomor WhatsApp, dan alamat email.
                    </li>
                    <li>
                      <strong className="text-[#292e31]">Data Operasional:</strong> Katalog produk, harga, denah meja, inventaris, dan catatan transaksi harian.
                    </li>
                    <li>
                      <strong className="text-[#292e31]">Informasi Perangkat:</strong> Model tablet/ponsel Android dan alamat Bluetooth printer thermal untuk keperluan koneksi.
                    </li>
                  </ul>
                </section>

                <section id="izin-aplikasi" className="scroll-mt-28">
                  <h2 className="text-[20px] font-semibold text-[#292e31] mb-3">
                    3. Izin Aplikasi
                  </h2>
                  <p>
                    Aplikasi Sissi hanya meminta izin perangkat yang mutlak diperlukan untuk operasi toko:
                  </p>
                  <ul className="mt-2.5 flex flex-col gap-2">
                    <li>• <strong>Bluetooth & Lokasi Dekat:</strong> Untuk memindai dan mencetak struk ke printer thermal Bluetooth.</li>
                    <li>• <strong>Kamera:</strong> Untuk memindai kode barcode produk dan QRIS secara cepat.</li>
                    <li>• <strong>Penyimpanan Lokal:</strong> Untuk menyimpan database transaksi offline saat internet mati.</li>
                  </ul>
                </section>

                <section id="data-wajah" className="scroll-mt-28">
                  <h2 className="text-[20px] font-semibold text-[#292e31] mb-3">
                    4. Data Presensi Wajah Karyawan
                  </h2>
                  <p>
                    Jika Anda mengaktifkan fitur presensi selfie karyawan, foto wajah hanya digunakan untuk verifikasi kehadiran jam kerja dan disimpan dengan enkripsi khusus. Data ini tidak pernah dibagikan ke pihak ketiga mana pun.
                  </p>
                </section>

                <section id="pihak-ketiga" className="scroll-mt-28">
                  <h2 className="text-[20px] font-semibold text-[#292e31] mb-3">
                    5. Pihak Ketiga & Pemrosesan
                  </h2>
                  <p>
                    Kami bekerja sama dengan penyedia gateway pembayaran berizin Bank Indonesia untuk memproses transaksi QRIS dinamis. Kami tidak pernah menyimpan data nomor kartu kredit atau PIN perbankan pelanggan Anda.
                  </p>
                </section>

                <section id="penyimpanan" className="scroll-mt-28">
                  <h2 className="text-[20px] font-semibold text-[#292e31] mb-3">
                    6. Penyimpanan dan Retensi
                  </h2>
                  <p>
                    Data usaha Anda disimpan selama akun Anda aktif. Jika Anda mengajukan penghapusan akun, data aktif akan dihapus tuntas dalam 7 hari kerja dan cadangan sistematis dalam 30 hari kalender.
                  </p>
                </section>

                <section id="keamanan" className="scroll-mt-28">
                  <h2 className="text-[20px] font-semibold text-[#292e31] mb-3">
                    7. Keamanan Data
                  </h2>
                  <p>
                    Seluruh komunikasi antara perangkat kasir dan server pusat dienkripsi menggunakan protokol TLS 1.3 standar industri. Akses basis data dibatasi ketat dengan autentikasi multi-faktor.
                  </p>
                </section>

                <section id="hak-anda" className="scroll-mt-28">
                  <h2 className="text-[20px] font-semibold text-[#292e31] mb-3">
                    8. Hak Pengguna
                  </h2>
                  <p>
                    Anda berhak mengekspor data laporan transaksi kapan saja ke format Excel/CSV, memperbarui informasi profil usaha, dan menghapus seluruh data usaha melalui halaman{" "}
                    <Link href="/hapus-akun" className="text-[#f1702c] underline">
                      Hapus Akun
                    </Link>
                    .
                  </p>
                </section>

                <section id="perubahan" className="scroll-mt-28">
                  <h2 className="text-[20px] font-semibold text-[#292e31] mb-3">
                    9. Perubahan Kebijakan
                  </h2>
                  <p>
                    Kebijakan Privasi ini dapat diperbarui berkala untuk mematuhi regulasi terkini. Kami akan memberikan notifikasi resmi pada aplikasi saat ada pembaruan signifikan.
                  </p>
                </section>

                <section id="kontak" className="scroll-mt-28">
                  <h2 className="text-[20px] font-semibold text-[#292e31] mb-3">
                    10. Kontak Petugas Privasi
                  </h2>
                  <p>
                    Untuk pertanyaan seputar perlindungan data pribadi Anda, hubungi petugas kepatuhan data kami melalui email{" "}
                    <a href="mailto:sissikreatifteknologi@gmail.com" className="text-[#f1702c]">
                      sissikreatifteknologi@gmail.com
                    </a>
                    .
                  </p>
                </section>
              </div>
            </article>
          </div>
        </Container>
      </main>

      <Footer />
    </div>
  );
}
