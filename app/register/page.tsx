import Link from "next/link";

export default function RegisterChooser() {
  return (
    <main className="max-w-md mx-auto p-8 space-y-4 text-center">
      <h1 className="text-2xl font-bold">Create an account</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Link href="/register/user" className="border rounded-xl p-6 hover:bg-gray-50">
          I’m a Customer
        </Link>
        <Link href="/register/shop" className="border rounded-xl p-6 hover:bg-gray-50">
          I’m a Shop Admin
        </Link>
      </div>
    </main>
  );
}
