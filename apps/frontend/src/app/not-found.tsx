import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-4xl font-bold text-foreground">404</p>
      <Link href="/" className="text-sm text-primary underline-offset-4 hover:underline">
        Help My CV
      </Link>
    </main>
  );
}
