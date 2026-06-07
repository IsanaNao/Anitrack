import { TopNav } from "@/components/TopNav";
import { GlobalLoadingBar } from "@/components/GlobalLoadingBar";
import { MirrorI18nBootstrap } from "@/components/MirrorI18nBootstrap";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MirrorI18nBootstrap />
      <TopNav />
      <GlobalLoadingBar />
      {children}
    </>
  );
}

