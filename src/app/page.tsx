import dynamic from "next/dynamic";

const FireMap = dynamic(() => import("@/components/FireMap"), {
  loading: () => (
    <div className="flex h-full items-center justify-center text-zinc-500">
      Chargement de la carte…
    </div>
  ),
});

export default function Home() {
  return <FireMap />;
}
