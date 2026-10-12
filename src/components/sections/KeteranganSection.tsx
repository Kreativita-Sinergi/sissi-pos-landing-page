import React from "react";

/**
 * Penjelas tepat di bawah gambar hero: hal-hal yang terlihat di layar asli itu,
 * ditulis dengan angka dari layar yang sama.
 */
const NOTES = [
  {
    label: "Offline",
    title: "Jualan dulu, sinkron belakangan",
    description:
      "Transaksi disimpan di perangkat. Saat internet kembali, data terkirim sendiri dan tablet atau HP lain di outlet ikut terbarui.",
  },
  {
    label: "Pesanan",
    title: "Varian dan catatan per item",
    description:
      "Es Kopi Susu Gula Aren ×2, less ice, extra shot. Kasir tidak perlu menulis ulang untuk dapur.",
  },
  {
    label: "Tagihan",
    title: "Pajak dan biaya layanan dihitung",
    description:
      "Subtotal Rp102.000 + biaya layanan Rp5.100 + PB1 10% = Rp117.810. Tarifnya kamu atur sendiri.",
  },
  {
    label: "Dapur",
    title: "Langsung muncul di layar dapur",
    description:
      "Item yang perlu dimasak masuk sebagai tiket per meja. Tambahan pesanan ditandai TAMBAHAN.",
  },
];

export function KeteranganSection() {
  return (
    <section className="bg-white pt-10 sm:pt-12 pb-20 sm:pb-28">
      <div className="max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-[120px]">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-10 border-t border-[#e4e9e7] pt-10">
          {NOTES.map((item) => (
            <div key={item.label} className="flex flex-col items-start">
              <span className="text-[12px] font-mono font-medium tracking-wider uppercase text-[#f1702c] mb-2">
                {item.label}
              </span>
              <h3 className="text-[18px] font-semibold text-[#292e31] leading-snug">
                {item.title}
              </h3>
              <p className="mt-2 text-[15px] text-[#525866] leading-relaxed">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
