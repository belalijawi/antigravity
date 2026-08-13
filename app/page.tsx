import { NightCalculator } from "@/components/NightCalculator";
import { EducationalContent } from "@/components/EducationalContent";
import { Tracker } from "@/components/Tracker";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 md:p-24 bg-[url('/noise.svg')] bg-fixed">
      <div className="absolute inset-0 bg-slate-950 -z-10" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black -z-10" />

      <NightCalculator />
      <div className="mt-12 w-full flex justify-center">
        <Tracker />
      </div>
      <div className="mt-12 w-full flex justify-center pb-20">
        <EducationalContent />
      </div>
    </main>
  );
}
