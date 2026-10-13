import type { Metadata } from "next";
import { TeamView } from "@/components/owner/TeamView";

export const metadata: Metadata = { title: "Tim" };

export default function Page() {
  return <TeamView />;
}
