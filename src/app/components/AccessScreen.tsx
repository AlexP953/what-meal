import Image from "next/image";
import type { ReactNode } from "react";

export default function AccessScreen({ title, description, children }: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="app-surface access-screen">
      <section className="access-card" aria-labelledby="access-title">
        <Image src="/logo.svg" alt="WhatMeal" width={174} height={48} loading="eager" />
        <h1 id="access-title" className="app-title">{title}</h1>
        <p className="app-muted">{description}</p>
        {children}
      </section>
    </main>
  );
}
