import React from "react";
import { AlertTriangle, Info, Lightbulb } from "lucide-react";
import type { GuideCallout as GuideCalloutData } from "@/constants/guides";

const STYLES: Record<GuideCalloutData["type"], { box: string; label: string; Icon: typeof Info }> = {
  tip: { box: "bg-[#e8f4f0] border-[#cfe6dd] text-[#155c46]", label: "Tips", Icon: Lightbulb },
  warning: { box: "bg-[#fff6e5] border-[#f5dfae] text-[#8a5a00]", label: "Perhatian", Icon: AlertTriangle },
  info: { box: "bg-[#f3f6f5] border-[#e4e9e7] text-[#3b4246]", label: "Catatan", Icon: Info },
};

export function GuideCallout({ callout }: { callout: GuideCalloutData }) {
  const { box, label, Icon } = STYLES[callout.type];
  return (
    <div className={`mt-5 flex items-start gap-3 rounded-[12px] border p-4 ${box}`}>
      <Icon className="mt-0.5 h-[18px] w-[18px] shrink-0" />
      <div className="min-w-0">
        <p className="text-[14px] font-semibold">{callout.title ?? label}</p>
        <p className="mt-1 text-[14px] leading-relaxed opacity-95">{callout.text}</p>
      </div>
    </div>
  );
}
