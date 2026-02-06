import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Ralph Course Platform" },
    { name: "description", content: "A course platform for learning" },
  ];
}

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold">Ralph Course Platform</h1>
        <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
          Coming soon
        </p>
      </div>
    </main>
  );
}
