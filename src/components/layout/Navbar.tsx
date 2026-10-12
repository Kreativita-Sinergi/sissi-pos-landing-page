"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Menu,
  X,
  ChevronDown,
  Utensils,
  ShoppingBasket,
  Wrench,
  CalendarClock,
} from "lucide-react";
import { NAV_LINKS } from "@/constants/navigation";

const ICON_MAP: Record<string, React.ReactNode> = {
  utensils: <Utensils className="w-5 h-5 text-[#f1702c]" />,
  "shopping-basket": <ShoppingBasket className="w-5 h-5 text-[#f1702c]" />,
  wrench: <Wrench className="w-5 h-5 text-[#f1702c]" />,
  "calendar-clock": <CalendarClock className="w-5 h-5 text-[#f1702c]" />,
};

export function Navbar({ isLight = false }: { isLight?: boolean }) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileDropdownOpen, setMobileDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 40);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const showDark = isLight || isScrolled;

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${
        showDark
          ? "bg-white/95 backdrop-blur-md border-b border-[#e4e9e7] shadow-sm py-3"
          : "bg-[#f1702c] py-4 sm:py-[22px]"
      }`}
    >
      <div className="max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-[120px]">
        <div className="flex items-center justify-between h-[38px]">
          {/* Logo Sissi - Exactly matching Figma Navbar */}
          <Link href="/" className="flex items-center shrink-0">
            <div className="relative h-[30px] w-[91px]">
              <Image
                src={
                  showDark
                    ? "/logos/sissi-navbar-logo-dark.svg"
                    : "/logos/sissi-navbar-logo.svg"
                }
                alt="Sissi Kasir"
                fill
                priority
                className="object-contain object-left"
              />
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map((link) => {
              if (link.children) {
                return (
                  <div
                    key={link.label}
                    ref={dropdownRef}
                    className="relative"
                    onMouseEnter={() => setDropdownOpen(true)}
                    onMouseLeave={() => setDropdownOpen(false)}
                  >
                    <button
                      type="button"
                      onClick={() => setDropdownOpen(!dropdownOpen)}
                      className={`inline-flex items-center gap-1.5 text-[15px] font-normal transition-colors cursor-pointer ${
                        showDark
                          ? "text-[#525866] hover:text-[#292e31]"
                          : "text-[#fef1eb] hover:text-white"
                      }`}
                    >
                      <span>{link.label}</span>
                      <ChevronDown
                        size={14}
                        className={`transition-transform duration-150 ${
                          dropdownOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    {/* Figma Dropdown `Navbar · Dropdown Untuk usaha (terbuka)` (560px, rounded-16, p-3) */}
                    {dropdownOpen && (
                      <div className="absolute top-full left-1/2 -translate-x-1/2 pt-2.5 z-50">
                        <div className="w-[560px] bg-white rounded-[16px] border border-[#e4e9e7] shadow-xl p-3 flex flex-col gap-1">
                          {link.children.map((child) => (
                            <Link
                              key={child.label}
                              href={child.href}
                              onClick={() => setDropdownOpen(false)}
                              className="group flex items-center gap-3.5 p-3.5 rounded-[12px] hover:bg-[#f3f6f5] transition-colors cursor-pointer"
                            >
                              <div className="w-10 h-10 rounded-[10px] bg-[#e8f4f0] flex items-center justify-center shrink-0">
                                {ICON_MAP[child.icon] || (
                                  <Utensils className="w-5 h-5 text-[#f1702c]" />
                                )}
                              </div>
                              <div className="flex flex-col">
                                <span className="text-[16px] font-semibold text-[#292e31] leading-tight group-hover:text-[#f1702c] transition-colors">
                                  {child.label}
                                </span>
                                <span className="text-[13px] font-normal text-[#525866] mt-0.5 leading-snug">
                                  {child.description}
                                </span>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <Link
                  key={link.label}
                  href={link.href}
                  className={`text-[15px] font-normal transition-colors cursor-pointer ${
                    showDark
                      ? "text-[#525866] hover:text-[#292e31]"
                      : "text-[#fef1eb] hover:text-white"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-2.5">
            <Link
              href="/masuk"
              className={`text-sm font-medium px-4 py-2 rounded-[8px] transition-colors cursor-pointer ${
                showDark
                  ? "text-[#292e31] hover:bg-black/5"
                  : "text-white hover:bg-white/10"
              }`}
            >
              Masuk
            </Link>
            <Link
              href="/download"
              className={`text-sm font-medium px-4 py-2 rounded-[8px] transition-all shadow-sm cursor-pointer ${
                showDark
                  ? "bg-[#f1702c] hover:bg-[#ff7a45] text-white"
                  : "bg-white hover:bg-[#fef1eb] text-[#292e31]"
              }`}
            >
              Coba Sekarang
            </Link>
          </div>

          {/* Mobile Right: Coba Sekarang + Hamburger */}
          <div className="flex md:hidden items-center gap-2">
            <Link
              href="/download"
              className={`text-xs font-medium px-3 py-1.5 rounded-[8px] transition-all shadow-sm cursor-pointer ${
                showDark
                  ? "bg-[#f1702c] text-white"
                  : "bg-white text-[#292e31]"
              }`}
            >
              Coba Sekarang
            </Link>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className={`p-1.5 rounded-[8px] transition-colors cursor-pointer ${
                showDark
                  ? "text-[#292e31] hover:bg-black/5"
                  : "text-white hover:bg-white/10"
              }`}
              aria-label="Menu"
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-[#e4e9e7] shadow-xl px-6 py-6 mt-3 flex flex-col gap-4 text-[#292e31]">
          <nav className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => {
              if (link.children) {
                return (
                  <div key={link.label} className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => setMobileDropdownOpen(!mobileDropdownOpen)}
                      className="flex items-center justify-between px-3 py-2.5 text-base font-medium text-[#292e31] hover:bg-[#f3f6f5] rounded-[8px] transition-colors"
                    >
                      <span>{link.label}</span>
                      <ChevronDown
                        size={16}
                        className={`transition-transform duration-150 ${
                          mobileDropdownOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    {mobileDropdownOpen && (
                      <div className="pl-4 pr-1 py-1 flex flex-col gap-1 border-l-2 border-[#e8f4f0] ml-3 mt-1">
                        {link.children.map((child) => (
                          <Link
                            key={child.label}
                            href={child.href}
                            onClick={() => setMobileMenuOpen(false)}
                            className="px-3 py-2 text-sm font-medium text-[#525866] hover:text-[#f1702c] hover:bg-[#f3f6f5] rounded-[6px] transition-colors"
                          >
                            {child.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <Link
                  key={link.label}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3 py-2.5 text-base font-medium text-[#292e31] hover:bg-[#f3f6f5] rounded-[8px] transition-colors"
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
          <div className="pt-4 border-t border-[#e4e9e7] flex flex-col gap-2.5">
            <Link
              href="/masuk"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-center py-2.5 text-sm font-medium text-[#292e31] border border-[#e4e9e7] rounded-[8px] hover:bg-[#f3f6f5]"
            >
              Masuk
            </Link>
            <Link
              href="/download"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-center py-2.5 text-sm font-medium text-white bg-[#f1702c] rounded-[8px] hover:bg-[#ff7a45]"
            >
              Coba Sekarang
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
