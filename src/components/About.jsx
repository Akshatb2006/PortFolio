import React, { useEffect, useRef, useState } from "react";

function VantaNetBackground() {
  const vantaRef = useRef(null);
  const vantaEffect = useRef(null);

  useEffect(() => {
    const loadVanta = async () => {
      // Load Three.js
      if (!window.THREE) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      // Load Vanta Net
      if (!window.VANTA?.NET) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/vanta@0.5.24/dist/vanta.net.min.js';
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      // Initialize Vanta effect
      if (vantaRef.current && !vantaEffect.current) {
        vantaEffect.current = window.VANTA.NET({
          el: vantaRef.current,
          THREE: window.THREE,
          mouseControls: true,
          touchControls: true,
          gyroControls: false,
          minHeight: 200.0,
          minWidth: 200.0,
          scale: 1.0,
          scaleMobile: 1.0,
          color: 0x8b2fbf,
          backgroundColor: 0x000000,
          points: 10.0,
          maxDistance: 23.0,
          spacing: 16.0,
          showDots: true
        });
      }
    };

    loadVanta().catch(console.error);

    return () => {
      if (vantaEffect.current) {
        vantaEffect.current.destroy();
        vantaEffect.current = null;
      }
    };
  }, []);

  return (
    <div
      ref={vantaRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        pointerEvents: 'none'
      }}
    />
  );
}

export default function About({ opacity = 1, onTransitionStart }) {
  const [fadeIn, setFadeIn] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Trigger fade-in after component mounts
    const timer = setTimeout(() => setFadeIn(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Handle exit transition
  useEffect(() => {
    if (opacity < 1 && !isExiting) {
      setIsExiting(true);
      setFadeIn(false);
    } else if (opacity === 1 && isExiting) {
      setIsExiting(false);
      const timer = setTimeout(() => setFadeIn(true), 100);
      return () => clearTimeout(timer);
    }
  }, [opacity, isExiting]);

  return (
    <div
      className="relative min-h-screen flex flex-col items-center justify-start text-gray-100 overflow-hidden"
      style={{ 
        background: "black",
        opacity: fadeIn ? opacity : 0,
        transition: "opacity 800ms ease-in-out"
      }}
    >
      <VantaNetBackground />
      
      <div className="relative z-10 w-full max-w-5xl px-6 sm:px-10 pt-20">
        <h1 
          className="text-5xl md:text-6xl text-center font-bold font-mono text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-500 mb-10 transition-all duration-1000"
          style={{ 
            textShadow: '0 0 20px rgba(0, 0, 0, 0.9), 0 0 40px rgba(0, 0, 0, 0.7)',
            transform: fadeIn ? 'translateY(0)' : 'translateY(-20px)',
            opacity: fadeIn ? 1 : 0
          }}
        >
          ABOUT ME
        </h1>
        
        <div 
          className="font-mono text-gray-200 leading-relaxed text-lg md:text-xl transition-all duration-1000 delay-200"
          style={{ 
            textShadow: '0 2px 8px rgba(0, 0, 0, 0.9), 0 0 15px rgba(0, 0, 0, 0.8)',
            transform: fadeIn ? 'translateY(0)' : 'translateY(20px)',
            opacity: fadeIn ? 1 : 0
          }}
        >
          <p className="fonthtml flex">{`<p>`}</p>
          <div className="my-4">
            Hey there! I'm{" "}
            <span className="text-cyan-400">Akshat Baranwal</span> — a software
            engineer passionate about crafting immersive digital experiences and
            exploring the depths of open-source and decentralized technologies.
            <br />
            <br />
            I love building systems that blend creativity with performance — from
            sleek frontend interfaces to distributed backend architectures. I'm
            deeply involved in open-source work, having contributed to{" "}
            <span className="text-cyan-400">Google Summer of Code (GSoC)</span>{" "}
            with <span className="text-cyan-400">Chaoss</span>, and{" "}
            <span className="text-cyan-400">Summer Of Bitcoin (SOB)</span>.
            <br />
            <br />
            Beyond coding, I'm endlessly curious about the intersection of
            technology, design, and philosophy — how we can build tools that
            empower people and push boundaries of what's possible.
          </div>
          <p className="fonthtml flex justify-end">{`</p>`}</p>
        </div>

        {/* Resume Button */}
        <div 
          className="flex justify-center mt-10 transition-all duration-1000 delay-400"
          style={{
            transform: fadeIn ? 'translateY(0)' : 'translateY(20px)',
            opacity: fadeIn ? 1 : 0
          }}
        >
          <a
            href="https://drive.google.com/file/d/1n6qN5XDxv3ck23GjL4VXEg3nUSWeg3Ro/view?usp=drive_link"
            target="_blank"
            rel="noopener noreferrer"
            className="relative inline-block px-8 py-3 text-lg font-semibold text-white rounded-full bg-gradient-to-r from-purple-600 via-pink-500 to-cyan-400 shadow-lg transition-transform duration-300 hover:scale-110 hover:shadow-cyan-500/50"
          >
            <span className="absolute inset-0 blur-xl bg-gradient-to-r from-purple-500 via-pink-400 to-cyan-400 opacity-40 rounded-full"></span>
            <span className="relative z-10">📄 View Resume</span>
          </a>
        </div>

        {/* Skills */}
        <div 
          className="text-xl md:text-2xl text-center mt-20 font-mono font-bold text-cyan-300 transition-all duration-1000 delay-500"
          style={{ 
            textShadow: '0 2px 8px rgba(0, 0, 0, 0.9), 0 0 15px rgba(0, 0, 0, 0.8)',
            transform: fadeIn ? 'translateY(0)' : 'translateY(20px)',
            opacity: fadeIn ? 1 : 0
          }}
        >
          MY TECHNICAL SKILLS
        </div>
        <div 
          className="flex flex-wrap justify-center gap-10 pt-10 transition-all duration-1000 delay-600"
          style={{
            transform: fadeIn ? 'translateY(0)' : 'translateY(20px)',
            opacity: fadeIn ? 1 : 0
          }}
        >
          {[
            ["HTML", "🌐"],
            ["CSS", "🎨"],
            ["JavaScript", "⚡"],
            ["React", "⚛️"],
            ["ThreeJS", "🎮"],
            ["NodeJS", "🟢"],
            ["MongoDB", "🍃"],
            ["MySQL", "🗄️"],
            ["NextJS", "▲"],
            ["Python", "🐍"],
            ["Plotly", "📈"],
            ["PostgreSQL", "🐘"],
            ["Java", "☕"],
            ["Git", "🔀"],
            ["TailwindCSS", "🌊"],
            ["Bootstrap", "📦"],
            ["UI/UX", "✨"],
          ].map(([name, icon], i) => (
            <div
              key={i}
              className="flex flex-col items-center transition-transform duration-300 hover:scale-110 cursor-pointer"
            >
              <div className="text-5xl mb-2">{icon}</div>
              <p className="text-white text-center" style={{ textShadow: '0 2px 8px rgba(0, 0, 0, 0.9), 0 0 15px rgba(0, 0, 0, 0.8)' }}>{name}</p>
            </div>
          ))}
        </div>

        {/* Tools */}
        <div 
          className="text-xl md:text-2xl text-center mt-20 font-mono font-bold text-cyan-300 transition-all duration-1000 delay-700"
          style={{ 
            textShadow: '0 2px 8px rgba(0, 0, 0, 0.9), 0 0 15px rgba(0, 0, 0, 0.8)',
            transform: fadeIn ? 'translateY(0)' : 'translateY(20px)',
            opacity: fadeIn ? 1 : 0
          }}
        >
          TOOLS THAT I USE
        </div>
        <div 
          className="flex justify-center flex-wrap gap-20 pt-10 pb-20 transition-all duration-1000 delay-800"
          style={{
            transform: fadeIn ? 'translateY(0)' : 'translateY(20px)',
            opacity: fadeIn ? 1 : 0
          }}
        >
          {[
            ["VS Code", "💻"],
            ["GitHub", "🐙"],
            ["Ubuntu", "🐧"],
            ["Docker", "🐳"],
            ["Lumyst", "🌌"],
            ["Vercel", "▲"],
            ["Figma", "🎨"],
            ["Postman", "📮"],
          ].map(([name, icon], i) => (
            <div
              key={i}
              className="flex flex-col items-center transition-transform duration-300 hover:scale-110 cursor-pointer"
            >
              <div className="text-5xl mb-2">{icon}</div>
              <p className="text-white text-center" style={{ textShadow: '0 2px 8px rgba(0, 0, 0, 0.9), 0 0 15px rgba(0, 0, 0, 0.8)' }}>{name}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}