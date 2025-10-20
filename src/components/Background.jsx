import React, { useRef, useEffect, useState } from "react";

function VantaBackground() {
  const vantaRef = useRef(null);
  const [vantaEffect, setVantaEffect] = useState(null);

  useEffect(() => {
    if (!vantaRef.current) return;

    const loadVanta = async () => {
      if (!window.THREE) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      if (!window.VANTA?.NET) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/vanta@0.5.24/dist/vanta.net.min.js';
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      const effect = window.VANTA.NET({
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
        points: 8.0,
        maxDistance: 25.0,
        spacing: 18.0,
        showDots: true
      });

      setVantaEffect(effect);
    };

    loadVanta().catch(console.error);

    return () => {
      if (vantaEffect) vantaEffect.destroy();
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
        willChange: 'transform',
        transform: 'translateZ(0)',
        pointerEvents: 'none'
      }}
    />
  );
}

function StarField() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let animationId;
    let stars = [];
    
    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      initStars();
    };

    class Star {
      constructor() {
        this.reset();
      }

      reset() {
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * Math.max(canvas.width, canvas.height) * 0.5;
        this.x = canvas.width / 2 + Math.cos(angle) * distance;
        this.y = canvas.height / 2 + Math.sin(angle) * distance;
        this.z = Math.random() * 1000;
        this.size = (1000 - this.z) / 1000 * 2;
        this.speed = (1000 - this.z) / 10000;
      }

      update(centerX, centerY) {
        const dx = centerX - this.x;
        const dy = centerY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 50) {
          this.reset();
          return;
        }

        const pullStrength = 0.5 / (distance * 0.01);
        this.x += dx * pullStrength * this.speed;
        this.y += dy * pullStrength * this.speed;

        const angle = Math.atan2(dy, dx);
        const perpAngle = angle + Math.PI / 2;
        this.x += Math.cos(perpAngle) * this.speed * 2;
        this.y += Math.sin(perpAngle) * this.speed * 2;

        this.size = Math.max(0.5, Math.min(3, (1000 - this.z) / 1000 * 2));
      }

      draw() {
        ctx.fillStyle = `rgba(${200 + this.z/10}, ${150 + this.z/15}, 255, ${0.8 - this.z/1500})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const initStars = () => {
      stars = [];
      const starCount = Math.min(200, (canvas.width * canvas.height) / 5000);
      for (let i = 0; i < starCount; i++) {
        stars.push(new Star());
      }
    };

    const animate = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      stars.forEach(star => {
        star.update(centerX, centerY);
        star.draw();
      });

      animationId = requestAnimationFrame(animate);
    };

    resize();
    window.addEventListener('resize', resize);
    animate();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        willChange: 'transform',
        transform: 'translateZ(0)'
      }}
    />
  );
}

function BlackHoleCore() {
  const [isHovered, setIsHovered] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseMove = (e) => {
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width - 0.5) * 20;
      const y = ((e.clientY - rect.top) / rect.height - 0.5) * 20;
      setMousePos({ x, y });
    };

    const handleMouseEnter = () => {
      console.log('🔥 HOVER ACTIVATED');
      setIsHovered(true);
    };

    const handleMouseLeave = () => {
      console.log('❄️ HOVER DEACTIVATED');
      setIsHovered(false);
    };

    container.addEventListener('mouseenter', handleMouseEnter);
    container.addEventListener('mouseleave', handleMouseLeave);
    container.addEventListener('mousemove', handleMouseMove);

    return () => {
      container.removeEventListener('mouseenter', handleMouseEnter);
      container.removeEventListener('mouseleave', handleMouseLeave);
      container.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        width: '700px',
        height: '700px',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'auto',
        cursor: 'pointer',
        zIndex: 5
      }}
    >
      <style>{`
        @keyframes rotate {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.8; }
          50% { opacity: 1; }
        }
        @keyframes energyBurst {
          0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(2.5); opacity: 0; }
        }
        @keyframes irregularMorph {
          0% { border-radius: 42% 58% 47% 53% / 48% 55% 45% 52%; }
          20% { border-radius: 55% 45% 60% 40% / 52% 43% 57% 48%; }
          40% { border-radius: 38% 62% 45% 55% / 58% 47% 53% 42%; }
          60% { border-radius: 52% 48% 38% 62% / 45% 60% 40% 55%; }
          80% { border-radius: 47% 53% 58% 42% / 55% 38% 62% 45%; }
          100% { border-radius: 42% 58% 47% 53% / 48% 55% 45% 52%; }
        }
        @keyframes plasmaFlow {
          0% { 
            border-radius: 45% 55% 52% 48% / 48% 50% 52% 50%;
            transform: translate(-50%, -50%) rotate(0deg) scale(1);
          }
          33% { 
            border-radius: 52% 48% 45% 55% / 55% 48% 52% 45%;
            transform: translate(-50%, -50%) rotate(120deg) scale(1.05);
          }
          66% { 
            border-radius: 48% 52% 55% 45% / 50% 55% 45% 50%;
            transform: translate(-50%, -50%) rotate(240deg) scale(0.98);
          }
          100% { 
            border-radius: 45% 55% 52% 48% / 48% 50% 52% 50%;
            transform: translate(-50%, -50%) rotate(360deg) scale(1);
          }
        }
        @keyframes solarFlare {
          0%, 100% { 
            transform: translate(-50%, -50%) scaleY(1) scaleX(0.3);
            opacity: 0.6;
          }
          50% { 
            transform: translate(-50%, -50%) scaleY(1.4) scaleX(0.5);
            opacity: 0.9;
          }
        }
        @keyframes coronaGlow {
          0%, 100% { opacity: 0.4; filter: blur(30px); }
          50% { opacity: 0.7; filter: blur(40px); }
        }
      `}</style>
      
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: '550px',
          height: '550px',
          transform: `translate(-50%, -50%) scale(${isHovered ? 1.2 : 1})`,
          background: `
            radial-gradient(circle at center, 
              rgba(255, 200, 255, 0.3) 0%,
              rgba(199, 47, 255, 0.4) 20%,
              rgba(138, 43, 226, 0.5) 40%,
              rgba(75, 0, 130, 0.3) 60%,
              transparent 80%
            )
          `,
          animation: 'irregularMorph 8s ease-in-out infinite, coronaGlow 3s ease-in-out infinite',
          filter: 'blur(25px)',
          willChange: 'transform, border-radius',
          transition: 'transform 0.5s ease-out',
          pointerEvents: 'none'
        }}
      />

      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: '450px',
          height: '450px',
          transform: `translate(-50%, -50%) translate(${mousePos.x}px, ${mousePos.y}px)`,
          background: `
            radial-gradient(ellipse at 30% 30%, 
              rgba(255, 180, 255, ${isHovered ? 0.9 : 0.7}) 0%,
              rgba(199, 47, 255, ${isHovered ? 0.8 : 0.6}) 20%,
              rgba(138, 43, 226, ${isHovered ? 1 : 0.8}) 40%,
              rgba(75, 0, 130, ${isHovered ? 0.9 : 0.7}) 60%,
              rgba(50, 0, 80, 0.5) 80%,
              transparent 100%
            )
          `,
          boxShadow: `
            0 0 ${isHovered ? 120 : 80}px ${isHovered ? 50 : 30}px rgba(138, 43, 226, ${isHovered ? 0.8 : 0.6}),
            inset 0 0 80px 30px rgba(199, 47, 255, ${isHovered ? 0.5 : 0.3}),
            0 0 ${isHovered ? 200 : 150}px ${isHovered ? 80 : 50}px rgba(255, 107, 255, ${isHovered ? 0.4 : 0.2})
          `,
          animation: 'plasmaFlow 10s ease-in-out infinite',
          willChange: 'transform, border-radius',
          transition: 'box-shadow 0.3s ease-out',
          pointerEvents: 'none'
        }}
      />

      {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angle) => (
        <div
          key={angle}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: '8px',
            height: isHovered ? '200px' : '150px',
            background: `linear-gradient(to bottom, 
              rgba(255, 180, 255, 0.8), 
              rgba(199, 47, 255, 0.6),
              rgba(138, 43, 226, 0.4),
              transparent
            )`,
            transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-250px)`,
            animation: `solarFlare ${2 + (angle % 3)}s ease-in-out infinite ${angle / 1000}s`,
            willChange: 'transform, opacity',
            pointerEvents: 'none',
            filter: 'blur(2px)',
            transition: 'height 0.3s ease-out'
          }}
        />
      ))}

      {isHovered && (
        <>
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: '450px',
              height: '450px',
              border: '3px solid rgba(255, 180, 255, 0.6)',
              animation: 'energyBurst 1.2s ease-out infinite, irregularMorph 3s ease-in-out infinite',
              willChange: 'transform, opacity, border-radius',
              pointerEvents: 'none'
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: '450px',
              height: '450px',
              border: '2px solid rgba(199, 47, 255, 0.5)',
              animation: 'energyBurst 1.2s ease-out infinite 0.4s, irregularMorph 3s ease-in-out infinite 1s',
              willChange: 'transform, opacity, border-radius',
              pointerEvents: 'none'
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: '450px',
              height: '450px',
              border: '2px solid rgba(255, 107, 255, 0.4)',
              animation: 'energyBurst 1.2s ease-out infinite 0.8s, irregularMorph 3s ease-in-out infinite 2s',
              willChange: 'transform, opacity, border-radius',
              pointerEvents: 'none'
            }}
          />
        </>
      )}

      {[0, 120, 240].map((angle, i) => (
        <div
          key={`spot-${angle}`}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: '80px',
            height: '80px',
            background: 'radial-gradient(circle, rgba(255, 200, 255, 0.8), transparent)',
            borderRadius: '50%',
            transform: `translate(-50%, -50%) rotate(${angle}deg) translateX(120px) rotate(-${angle}deg)`,
            animation: `rotate ${15 + i * 3}s linear infinite, pulse 2s ease-in-out infinite ${i * 0.3}s`,
            filter: 'blur(15px)',
            pointerEvents: 'none',
            willChange: 'transform, opacity'
          }}
        />
      ))}
    </div>
  );
}

export default function Background({ style = {} }) {
  const [isVisible, setIsVisible] = useState(true);
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          setIsVisible(entry.isIntersecting);
        });
      },
      { threshold: 0.1 }
    );

    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        backgroundColor: '#000',
        ...style
      }}
    >
      {isVisible && <VantaBackground />}
      {isVisible && <StarField />}
      <BlackHoleCore />
    </div>
  );
}