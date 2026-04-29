import { TopNav } from "@/components/TopNav";
import { GlobalLoadingBar } from "@/components/GlobalLoadingBar";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopNav />
      <GlobalLoadingBar />
      {children}
    </>
  );
}

