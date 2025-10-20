import { useState, useEffect } from "react";
import Background from "./components/Background";
import About from "./components/About";
import Projects from "./components/Projects";
import Contact from "./components/Contact";
import "./styles.css";

export default function App() {
  const [scrollY, setScrollY] = useState(0);
  const [vh, setVh] = useState(window.innerHeight);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    const handleResize = () => setVh(window.innerHeight);

    window.addEventListener("scroll", handleScroll);
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const heroProgress = Math.min(scrollY / vh, 1);
  const heroOpacity = 1 - heroProgress * 1.3;
  const heroScale = 1 - heroProgress * 0.2;

  const aboutProgress = Math.max(Math.min((scrollY - vh) / vh, 1), 0);
  const aboutOpacity = Math.max(heroProgress * 1.8 - 0.4, 0);

  const projectsProgress = Math.max((scrollY - vh * 2) / vh, 0);
  const projectsOpacity = Math.min(projectsProgress * 2, 1);

  return (
    <div className="w-screen overflow-x-hidden bg-black">
      <section
        className="relative h-screen flex items-center justify-center text-center transition-all duration-700"
        style={{
          opacity: heroOpacity,
          transform: `scale(${heroScale})`,
        }}
      >
        <div className="absolute inset-0">
          <Background />
        </div>
        <div className="relative z-10 text-white px-4">
          <div className="absolute w-96 h-48 bg-black/70 rounded-full blur-3xl -z-10"></div>
          <h1
            className="text-4xl md:text-6xl font-extrabold mb-4 cosmic-text text-slide-in"
            style={{ animationDelay: "0.3s" }}
          >
            Hello, Earthlings 👋
          </h1>
          <h2
            className="text-2xl md:text-3xl mb-6 cosmic-text text-slide-in"
            style={{ animationDelay: "1.5s" }}
          >
            I'm Akshat.
          </h2>
          <p
            className="text-lg md:text-xl max-w-xl mx-auto cosmic-text text-slide-in"
            style={{ animationDelay: "2.7s" }}
          >
            Exploring the universe of code and ideas.<br />
            Software engineer | Open source explorer | Eternal learner
          </p>
          <div className="mt-10 opacity-70 text-sm animate-pulse">
            ↓ Scroll to explore
          </div>
        </div>
      </section>

      <section
        className="relative min-h-screen transition-all duration-700"
        style={{
          opacity: aboutOpacity,
        }}
      >
        <About opacity={aboutOpacity} />
      </section>

      <section
        className="relative min-h-screen transition-all duration-700"
        style={{
          opacity: projectsOpacity,
        }}
      >
        <Projects opacity={projectsOpacity} />
      </section>
      <section>
        <div className="w-full py-6 text-center text-gray-500 text-sm">
          <Contact opacity={projectsOpacity} />
        </div>
      </section>
    </div>
  );
}