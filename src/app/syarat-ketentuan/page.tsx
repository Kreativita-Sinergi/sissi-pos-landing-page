import React from "react";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Container } from "@/components/shared/Container";

export const metadata = {
  title: "Syarat & Ketentuan · Sissi",
  description:
    "Syarat dan ketentuan penggunaan aplikasi kasir Sissi dan layanan pendukungnya.",
};

const TOC_ITEMS = [
  { id: "definisi", title: "1. Definisi" },
  { id: "akun", title: "2. Akun dan Akses Karyawan" },
  { id: "paket", title: "3. Paket, Uji Coba, dan Pembayaran" },
  { id: "data-usaha", title: "4. Data Usaha" },
  { id: "larangan", title: "5. Penggunaan yang Dilarang" },
  { id: "ketersediaan", title: "6. Ketersediaan Layanan" },
  { id: "tanggung-jawab", title: "7. Batas Tanggung Jawab" },
  { id: "penghentian", title: "8. Penangguhan dan Penghentian" },
  { id: "perubahan", title: "9. Perubahan Ketentuan" },
  { id: "hukum", title: "10. Hukum dan Penyelesaian Sengketa" },
  { id: "kontak", title: "11. Kontak" },
];

export default function SyaratKetentuanPage() {
  return (
    <div className="flex min-h-screen flex-col w-full bg-white">
      {/* Subpage White Navbar */}
      <Navbar isLight />

      <main className="flex-1 pt-28 pb-20">
        <Container>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
            {/* Left Sticky Table of Contents (260px in Figma) */}
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
                  BERANDA / SYARAT & KETENTUAN
                </span>
                <h1 className="text-3xl sm:text-[40px] font-semibold text-[#292e31] tracking-tight leading-[1.14]">
                  Syarat dan Ketentuan Penggunaan Sissi
                </h1>
                <div className="mt-3 inline-flex items-center px-2.5 py-1 rounded-[6px] bg-[#f3f6f5] text-[13px] font-mono text-[#7d8986]">
                  Versi 1.0 · Berlaku sejak Oktober 2026
                </div>
                <p className="mt-6 text-[16px] sm:text-[17px] text-[#525866] leading-relaxed">
                  Syarat dan Ketentuan ini mengatur penggunaan aplikasi Sissi dan layanan terkaitnya. Mohon dibaca dengan saksama. Dengan membuat akun atau memakai Sissi, Anda menyatakan telah membaca, memahami, dan menyetujui seluruh ketentuan di bawah ini.
                </p>
              </div>

              {/* Sections */}
              <div className="flex flex-col gap-10 text-[15px] sm:text-[16px] text-[#525866] leading-relaxed">
                <section id="definisi" className="scroll-mt-28">
                  <h2 className="text-[20px] font-semibold text-[#292e31] mb-3">
                    1. Definisi
                  </h2>
                  <ul className="flex flex-col gap-3">
                    <li>
                      <strong className="text-[#292e31]">Sissi:</strong> Aplikasi kasir pintar untuk tablet dan ponsel Android beserta layanan awan pendukungnya.
                    </li>
                    <li>
                      <strong className="text-[#292e31]">Pemilik Akun:</strong> Individu atau badan usaha yang mendaftarkan usaha di Sissi dan bertanggung jawab penuh atas akun tersebut (&quot;Anda&quot;).
                    </li>
                    <li>
                      <strong className="text-[#292e31]">Karyawan:</strong> Pengguna yang diberi otorisasi akses oleh Pemilik Akun untuk mengoperasikan kasir, seperti kasir, barista, atau staf operasional.
                    </li>
                    <li>
                      <strong className="text-[#292e31]">Data Usaha:</strong> Semua informasi katalog produk, riwayat transaksi, data pelanggan, dan catatan keuangan yang dimasukkan ke dalam sistem.
                    </li>
                  </ul>
                </section>

                <section id="akun" className="scroll-mt-28">
                  <h2 className="text-[20px] font-semibold text-[#292e31] mb-3">
                    2. Akun dan Akses Karyawan
                  </h2>
                  <p>
                    Anda bertanggung jawab menjaga kerahasiaan kredensial akun dan kode sandi operasional kasir. Setiap tindakan atau transaksi yang dilakukan melalui akun Anda dianggap sah dilakukan oleh Anda atau karyawan yang Anda beri wewenang.
                  </p>
                </section>

                <section id="paket" className="scroll-mt-28">
                  <h2 className="text-[20px] font-semibold text-[#292e31] mb-3">
                    3. Paket, Uji Coba, dan Pembayaran
                  </h2>
                  <p>
                    Paket Gratis dapat digunakan tanpa batas waktu sesuai batas kuota yang ditentukan. Paket Pro mencakup uji coba gratis selama 30 hari kalender sejak tanggal pendaftaran akun. Setelah masa uji coba, Anda dapat berlangganan Pro dengan membayar biaya bulanan atau tahunan sesuai petunjuk di menu Langganan pada aplikasi. Langganan tidak diperpanjang atau ditagih secara otomatis; bila tidak diperpanjang, akun kembali ke Paket Gratis setelah masa tenggang dan data Anda tetap tersimpan.
                  </p>
                </section>

                <section id="data-usaha" className="scroll-mt-28">
                  <h2 className="text-[20px] font-semibold text-[#292e31] mb-3">
                    4. Data Usaha
                  </h2>
                  <p>
                    Hak kepemilikan Data Usaha sepenuhnya tetap berada di tangan Anda. Sissi tidak memperjualbelikan data usaha Anda kepada pihak ketiga mana pun dan hanya mengolah data tersebut untuk kepentingan penyediaan layanan kasir dan laporan analitik Anda.
                  </p>
                </section>

                <section id="larangan" className="scroll-mt-28">
                  <h2 className="text-[20px] font-semibold text-[#292e31] mb-3">
                    5. Penggunaan yang Dilarang
                  </h2>
                  <p>
                    Pengguna dilarang menggunakan Sissi untuk memperjualbelikan barang atau jasa terlarang secara hukum, melakukan transaksi penipuan, memanipulasi data pembayaran digital, atau mencoba membobol integritas teknis infrastruktur server kami.
                  </p>
                </section>

                <section id="ketersediaan" className="scroll-mt-28">
                  <h2 className="text-[20px] font-semibold text-[#292e31] mb-3">
                    6. Ketersediaan Layanan
                  </h2>
                  <p>
                    Aplikasi kasir Sissi didesain dengan kapabilitas offline-first sehingga kasir dapat tetap mencatat pesanan, mencetak struk, dan menerima pembayaran tunai saat koneksi internet terputus. Data akan otomatis disinkronkan saat sambungan kembali aktif.
                  </p>
                </section>

                <section id="tanggung-jawab" className="scroll-mt-28">
                  <h2 className="text-[20px] font-semibold text-[#292e31] mb-3">
                    7. Batas Tanggung Jawab
                  </h2>
                  <p>
                    Sissi disediakan sebagaimana adanya (&quot;as is&quot;). Kami berkomitmen menjaga ketersediaan layanan hingga 99,9%, namun tidak bertanggung jawab atas kerugian tidak langsung akibat kelalaian operasional kasir atau kerusakan fisik perangkat keras Anda.
                  </p>
                </section>

                <section id="penghentian" className="scroll-mt-28">
                  <h2 className="text-[20px] font-semibold text-[#292e31] mb-3">
                    8. Penangguhan dan Penghentian
                  </h2>
                  <p>
                    Anda dapat berhenti menggunakan layanan kapan saja dan menghapus akun melalui menu yang tersedia di aplikasi atau halaman{" "}
                    <Link href="/hapus-akun" className="text-[#f1702c] underline">
                      Hapus Akun
                    </Link>
                    .
                  </p>
                </section>

                <section id="perubahan" className="scroll-mt-28">
                  <h2 className="text-[20px] font-semibold text-[#292e31] mb-3">
                    9. Perubahan Ketentuan
                  </h2>
                  <p>
                    Kami dapat memperbarui ketentuan ini dari waktu ke waktu. Perubahan material akan diumumkan melalui aplikasi atau pesan WhatsApp terdaftar setidaknya 14 hari sebelum diberlakukan.
                  </p>
                </section>

                <section id="hukum" className="scroll-mt-28">
                  <h2 className="text-[20px] font-semibold text-[#292e31] mb-3">
                    10. Hukum dan Penyelesaian Sengketa
                  </h2>
                  <p>
                    Syarat dan Ketentuan ini diatur dan ditafsirkan sesuai dengan hukum Republik Indonesia. Setiap perselisihan akan diselesaikan terlebih dahulu secara musyawarah untuk mencapai mufakat.
                  </p>
                </section>

                <section id="kontak" className="scroll-mt-28">
                  <h2 className="text-[20px] font-semibold text-[#292e31] mb-3">
                    11. Kontak
                  </h2>
                  <p>
                    Pertanyaan seputar ketentuan ini dapat disampaikan melalui email ke{" "}
                    <a href="mailto:sissikreatifteknologi@gmail.com" className="text-[#f1702c]">
                      sissikreatifteknologi@gmail.com
                    </a>{" "}
                    atau melalui WhatsApp dukungan resmi di{" "}
                    <a href="https://wa.me/6285161462806" className="text-[#f1702c]">
                      0851-6146-2806
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
