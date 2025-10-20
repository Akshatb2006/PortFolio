import React, { useEffect, useRef, useState } from "react";

function VantaBirdsBackground() {
  const vantaRef = useRef(null);
  const vantaEffect = useRef(null);

  useEffect(() => {
    // Load Three.js
    const threeScript = document.createElement('script');
    threeScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
    threeScript.async = true;
    
    threeScript.onload = () => {
      // Load Vanta Birds after Three.js
      const vantaScript = document.createElement('script');
      vantaScript.src = 'https://cdn.jsdelivr.net/npm/vanta@latest/dist/vanta.birds.min.js';
      vantaScript.async = true;
      
      vantaScript.onload = () => {
        if (!vantaEffect.current && vantaRef.current && window.VANTA) {
          vantaEffect.current = window.VANTA.BIRDS({
            el: vantaRef.current,
            THREE: window.THREE,
            mouseControls: true,
            touchControls: true,
            gyroControls: false,
            minHeight: 200.00,
            minWidth: 200.00,
            scale: 1.00,
            scaleMobile: 1.00,
            backgroundColor: 0x0,
            color1: 0xa78bfa,
            color2: 0x8b5cf6,
            colorMode: "lerp",
            birdSize: 1.5,
            wingSpan: 25.00,
            speedLimit: 6.00,
            separation: 40.00,
            alignment: 40.00,
            cohesion: 30.00,
            quantity: 3.00
          });
        }
      };
      
      document.body.appendChild(vantaScript);
    };
    
    document.body.appendChild(threeScript);

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

const ProjectCard = React.memo(({ title, description, githubUrl, tags, isOpenSource, index, fadeIn }) => {
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef(null);

  useEffect(() => {
    if (!fadeIn) {
      setIsVisible(false);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setTimeout(() => setIsVisible(true), index * 150);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, [index, fadeIn]);

  return (
    <div
      ref={cardRef}
      className={`bg-gradient-to-br from-gray-900/80 to-gray-800/80 backdrop-blur-sm rounded-xl p-6 shadow-2xl border border-gray-700 hover:border-purple-500 transition-all duration-500 transform ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
      } hover:scale-105 hover:shadow-purple-500/20`}
    >
      {isOpenSource && (
        <div className="inline-block bg-green-500/20 text-green-400 text-xs font-semibold px-3 py-1 rounded-full mb-4 border border-green-500/30">
          Open Source
        </div>
      )}
      
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-2xl font-bold text-white mb-2">
            {title}
          </h3>
          <a 
            href={githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-400 hover:text-purple-300 transition-colors inline-flex items-center gap-2 text-sm"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
          </a>
        </div>
      </div>

      <p className="text-gray-300 mb-4 leading-relaxed">
        {description}
      </p>

      <div className="flex flex-wrap gap-2">
        {tags.map((tag, idx) => (
          <span
            key={idx}
            className="bg-purple-500/20 text-purple-300 text-xs font-medium px-3 py-1 rounded-full border border-purple-500/30"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
});

ProjectCard.displayName = 'ProjectCard';

export default function Projects({ opacity = 1 }) {
  const [fadeIn, setFadeIn] = useState(false);

  useEffect(() => {
    // Only trigger fade-in when opacity is 1 (page is active)
    if (opacity === 1) {
      const timer = setTimeout(() => setFadeIn(true), 50);
      return () => clearTimeout(timer);
    } else {
      // Reset fade-in when page becomes inactive
      setFadeIn(false);
    }
  }, [opacity]);

  const projects = [
    {
      title: "Ai-Agents",
      description: "An advanced AI agents platform leveraging cutting-edge machine learning and natural language processing to create intelligent, autonomous systems capable of complex decision-making and task automation.",
      githubUrl: "https://github.com/Akshatb2006/Ai-Agents",
      tags: ["AI", "Machine Learning", "Python", "Automation"],
      isOpenSource: false
    },
    {
      title: "Augur",
      description: "A powerful prediction and analytics platform that combines data science with intuitive visualization tools to provide actionable insights and forecasting capabilities for complex datasets.",
      githubUrl: "https://github.com/Akshatb2006/augur",
      tags: ["Analytics", "Data Science", "Visualization", "Python"],
      isOpenSource: true
    },
    {
      title: "8Knot",
      description: "An innovative open-source project focused on community metrics and analytics, providing comprehensive insights into project health, contributor engagement, and development patterns.",
      githubUrl: "https://github.com/Akshatb2006/8Knot",
      tags: ["Open Source", "Metrics", "Analytics", "Community"],
      isOpenSource: true
    },
    {
      title: "IgniteEdge",
      description: "IgniteEdge is a comprehensive business management platform that combines project management capabilities with advanced analytics and financial tracking features. Designed to streamline operations and enhance decision-making for businesses of all sizes.",
      githubUrl: "https://github.com/Manishym956/IgniteEdge",
      tags: ["Web Development", "React", "Node.js", "Full Stack"],
      isOpenSource: false
    }
  ];

  return (
    <div 
      className="min-h-screen bg-black relative overflow-hidden"
      style={{ 
        opacity: fadeIn ? opacity : 0,
        transition: "opacity 800ms ease-in-out"
      }}
    >
      <VantaBirdsBackground />
      
      <div className="relative z-10 container mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h2 
            className="text-6xl font-bold text-white mb-4 tracking-tight transition-all duration-1000"
            style={{
              transform: fadeIn ? 'translateY(0)' : 'translateY(-20px)',
              opacity: fadeIn ? 1 : 0
            }}
          >
            PROJECTS
          </h2>
          
          <div 
            className="h-1 w-32 bg-gradient-to-r from-purple-500 to-pink-500 mx-auto mb-6 transition-all duration-1000 delay-200"
            style={{
              transform: fadeIn ? 'scaleX(1)' : 'scaleX(0)',
              opacity: fadeIn ? 1 : 0
            }}
          ></div>
          
          <p 
            className="text-xl text-gray-400 max-w-2xl mx-auto transition-all duration-1000 delay-300"
            style={{
              transform: fadeIn ? 'translateY(0)' : 'translateY(20px)',
              opacity: fadeIn ? 1 : 0
            }}
          >
            Building innovative solutions and contributing to open source
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-16 max-w-6xl mx-auto">
            {projects.map((project, idx) => (
              <ProjectCard key={idx} {...project} index={idx} fadeIn={fadeIn} />
            ))}
          </div>

          <div 
            className="mt-16 transition-all duration-1000 delay-500"
            style={{
              transform: fadeIn ? 'translateY(0)' : 'translateY(20px)',
              opacity: fadeIn ? 1 : 0
            }}
          >
            <a
              href="https://github.com/Akshatb2006"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold px-8 py-4 rounded-full hover:from-purple-700 hover:to-pink-700 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-purple-500/50"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              View More on GitHub
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}