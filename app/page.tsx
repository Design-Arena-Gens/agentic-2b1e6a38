"use client";

import dynamic from "next/dynamic";

const RaceGame = dynamic(() => import("../components/RaceGame"), {
  ssr: false
});

export default function Home() {
  return (
    <main className="page">
      <div className="content">
        <header className="header">
          <h1>Neon Sprint</h1>
          <p>Race through neon streets, dodge rivals, and chase the distance.</p>
        </header>
        <RaceGame />
        <footer className="footer">
          <span>Controls: W/A/S/D or Arrow Keys · Space to boost · R to reset</span>
        </footer>
      </div>
    </main>
  );
}
