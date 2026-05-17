import Link from "next/link";
import { BASE_PATH } from "@/lib/paths";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-champagne flex flex-col items-center justify-center gap-6 p-8">
      <p className="text-cadet text-lg font-medium">page not found</p>
      <Link href={BASE_PATH} className="text-cadet underline underline-offset-4">
        go home
      </Link>
    </main>
  );
}
