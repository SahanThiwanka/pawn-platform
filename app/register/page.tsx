import Link from "next/link";

export default function RegisterChooser() {
  return (
    <div className="relative min-h-[100svh]">
      {/* Soft brand gradient background */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-indigo-500 via-sky-500 to-cyan-400 opacity-25" />
      <div className="absolute -top-40 -left-40 h-[32rem] w-[32rem] rounded-full bg-white/10 blur-3xl" />
      <div className="absolute -bottom-40 -right-40 h-[32rem] w-[32rem] rounded-full bg-white/10 blur-3xl" />

      <main className="relative z-10 mx-auto flex min-h-[100svh] w-full flex-col items-center justify-center px-4">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-gray-900/70 p-8 text-center text-gray-100 shadow-2xl backdrop-blur-md">
          <h1 className="text-2xl font-bold mb-6">Create an account</h1>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link
              href="/register/user"
              className="rounded-2xl border border-white/10 bg-gray-800/80 p-6 text-base font-medium shadow-lg shadow-indigo-600/10 transition hover:-translate-y-1 hover:bg-indigo-600 hover:text-white hover:shadow-indigo-600/30"
            >
              I’m a Customer
            </Link>
            <Link
              href="/register/shop"
              className="rounded-2xl border border-white/10 bg-gray-800/80 p-6 text-base font-medium shadow-lg shadow-indigo-600/10 transition hover:-translate-y-1 hover:bg-sky-600 hover:text-white hover:shadow-sky-600/30"
            >
              I’m a Shop Admin
            </Link>
          </div>

          <p className="mt-6 text-sm text-gray-400">
            Already have an account?{" "}
            <Link
              href="/login"
              className="underline hover:text-gray-200 transition"
            >
              Login
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
