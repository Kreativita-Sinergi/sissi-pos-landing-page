import type { Metadata } from "next";
import { TeamView } from "@/components/admin/TeamView";

export const metadata: Metadata = { title: "Tim admin" };

export default function Page() {
  return <TeamView />;
}
