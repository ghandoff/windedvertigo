import Link from "next/link";

interface Props {
  searchParams: Promise<{ pack?: string; session_id?: string }>;
}

export default async function CheckoutSuccessPage({ searchParams }: Props) {
  const { pack } = await searchParams;
  const packName = pack || "your vault pack";

  return (
    <main className="min-h-screen flex items-center justify-center bg-stone-950 text-stone-100 p-8">
      <div className="max-w-md text-center space-y-6">
        <div className="text-5xl">🎉</div>
        <h1 className="text-2xl font-bold text-amber-400">
          Welcome to {packName}!
        </h1>
        <p className="text-stone-300">
          Your purchase is confirmed. You now have full access to all activities
          included in this pack.
        </p>
        <div className="flex gap-4 justify-center pt-4">
          <Link
            href="/"
            className="px-6 py-3 bg-amber-500 text-stone-950 font-semibold rounded-lg hover:bg-amber-400 transition-colors"
          >
            Browse Activities
          </Link>
        </div>
      </div>
    </main>
  );
}
