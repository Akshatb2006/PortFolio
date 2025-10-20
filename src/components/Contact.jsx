import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

function ParticleBackground() {
  const mountRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          setIsVisible(entry.isIntersecting);
        });
      },
      { threshold: 0.1 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible || !mountRef.current) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    const renderer = new THREE.WebGLRenderer({ 
      antialias: false,
      alpha: true,
      powerPreference: "high-performance"
    });

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 1);
    mountRef.current.appendChild(renderer.domElement);

    // Particle system
    const particleCount = 2000;
    const particles = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const velocities = [];

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      
      // Position
      positions[i3] = (Math.random() - 0.5) * 100;
      positions[i3 + 1] = (Math.random() - 0.5) * 100;
      positions[i3 + 2] = (Math.random() - 0.5) * 100;

      // Color (purple to cyan gradient)
      const color = new THREE.Color();
      color.setHSL(0.7 + Math.random() * 0.1, 0.8, 0.6);
      colors[i3] = color.r;
      colors[i3 + 1] = color.g;
      colors[i3 + 2] = color.b;

      // Velocity
      velocities.push({
        x: (Math.random() - 0.5) * 0.02,
        y: (Math.random() - 0.5) * 0.02,
        z: (Math.random() - 0.5) * 0.02
      });
    }

    particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particles.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const particleMaterial = new THREE.PointsMaterial({
      size: 0.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const particleSystem = new THREE.Points(particles, particleMaterial);
    scene.add(particleSystem);

    camera.position.z = 50;

    // Mouse interaction
    let mouseX = 0;
    let mouseY = 0;

    const handleMouseMove = (event) => {
      mouseX = (event.clientX / window.innerWidth) * 2 - 1;
      mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
    };

    window.addEventListener('mousemove', handleMouseMove);

    // Animation
    let animationId;
    const animate = () => {
      animationId = requestAnimationFrame(animate);

      const positions = particles.attributes.position.array;

      for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        
        // Update positions with velocity
        positions[i3] += velocities[i].x;
        positions[i3 + 1] += velocities[i].y;
        positions[i3 + 2] += velocities[i].z;

        // Boundary check and bounce
        if (Math.abs(positions[i3]) > 50) velocities[i].x *= -1;
        if (Math.abs(positions[i3 + 1]) > 50) velocities[i].y *= -1;
        if (Math.abs(positions[i3 + 2]) > 50) velocities[i].z *= -1;
      }

      particles.attributes.position.needsUpdate = true;

      // Rotate based on mouse
      particleSystem.rotation.x += (mouseY * 0.5 - particleSystem.rotation.x) * 0.05;
      particleSystem.rotation.y += (mouseX * 0.5 - particleSystem.rotation.y) * 0.05;

      renderer.render(scene, camera);
    };

    animate();

    // Handle resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
      particles.dispose();
      particleMaterial.dispose();
    };
  }, [isVisible]);

  return (
    <div ref={containerRef} className="absolute inset-0">
      {isVisible && (
        <div
          ref={mountRef}
          className="absolute inset-0"
          style={{ zIndex: 0, pointerEvents: 'none' }}
        />
      )}
    </div>
  );
}

function ContactForm() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email || !formData.message) {
      setSubmitStatus({ type: 'error', message: 'Please fill in all fields' });
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus(null);

    // Create mailto link
    const subject = encodeURIComponent(`Portfolio Contact from ${formData.name}`);
    const body = encodeURIComponent(
      `Name: ${formData.name}\nEmail: ${formData.email}\n\nMessage:\n${formData.message}`
    );
    const mailtoLink = `mailto:kysuakshat23@gmail.com?subject=${subject}&body=${body}`;

    // Open email client
    window.location.href = mailtoLink;

    // Show success message and reset form
    setTimeout(() => {
      setIsSubmitting(false);
      setSubmitStatus({ 
        type: 'success', 
        message: 'Your email client has been opened. Please send the email to complete your message!' 
      });
      setFormData({ name: '', email: '', message: '' });
    }, 1000);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-purple-300 mb-2">
          Name
        </label>
        <input
          type="text"
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          required
          className="w-full px-4 py-3 bg-black/40 border border-purple-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20 transition-all"
          placeholder="Your name"
        />
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-purple-300 mb-2">
          Email
        </label>
        <input
          type="email"
          id="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          required
          className="w-full px-4 py-3 bg-black/40 border border-purple-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20 transition-all"
          placeholder="your.email@example.com"
        />
      </div>

      <div>
        <label htmlFor="message" className="block text-sm font-medium text-purple-300 mb-2">
          Message
        </label>
        <textarea
          id="message"
          name="message"
          value={formData.message}
          onChange={handleChange}
          required
          rows="5"
          className="w-full px-4 py-3 bg-black/40 border border-purple-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20 transition-all resize-none"
          placeholder="Your message..."
        />
      </div>

      {submitStatus && (
        <div
          className={`p-4 rounded-lg ${
            submitStatus.type === 'success'
              ? 'bg-green-500/20 border border-green-500/30 text-green-300'
              : 'bg-red-500/20 border border-red-500/30 text-red-300'
          }`}
        >
          {submitStatus.message}
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className={`w-full px-8 py-3 text-lg font-semibold text-white rounded-full bg-gradient-to-r from-purple-600 via-pink-500 to-cyan-400 shadow-lg transition-all duration-300 ${
          isSubmitting
            ? 'opacity-50 cursor-not-allowed'
            : 'hover:scale-105 hover:shadow-cyan-500/50'
        }`}
      >
        {isSubmitting ? 'Opening Email...' : 'Send Message'}
      </button>
    </form>
  );
}

export default function Contact({ opacity = 1 }) {
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

  const socialLinks = [
    {
      name: "GitHub",
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
        </svg>
      ),
      url: "https://github.com/Akshatb2006"
    },
    {
      name: "LinkedIn",
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
        </svg>
      ),
      url: "https://www.linkedin.com/in/akshat-baranwal-936797313/"
    },
    {
      name: "Twitter",
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
        </svg>
      ),
      url: "https://twitter.com/akshat"
    },
    {
      name: "Email",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      url: "mailto:kysuakshat23@gmail.com"
    }
  ];

  return (
    <div
      className="relative min-h-screen flex flex-col items-center justify-start text-gray-100 overflow-hidden"
      style={{ 
        background: "black", 
        opacity: fadeIn ? opacity : 0,
        transition: "opacity 800ms ease-in-out"
      }}
    >
      <ParticleBackground />
      
      <div className="relative z-10 w-full max-w-6xl px-6 sm:px-10 pt-20 pb-20">
        <h1 
          className="text-5xl md:text-6xl text-center font-bold font-mono text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-500 mb-6 transition-all duration-1000"
          style={{
            transform: fadeIn ? 'translateY(0)' : 'translateY(-20px)',
            opacity: fadeIn ? 1 : 0
          }}
        >
          GET IN TOUCH
        </h1>
        
        <p 
          className="text-center text-gray-400 text-lg mb-16 font-mono transition-all duration-1000 delay-200"
          style={{
            transform: fadeIn ? 'translateY(0)' : 'translateY(20px)',
            opacity: fadeIn ? 1 : 0
          }}
        >
          Let's build something amazing together
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Contact Form */}
          <div 
            className="bg-gradient-to-br from-purple-900/20 to-black/40 backdrop-blur-sm border border-purple-500/30 rounded-xl p-8 transition-all duration-1000 delay-300"
            style={{
              transform: fadeIn ? 'translateX(0)' : 'translateX(-30px)',
              opacity: fadeIn ? 1 : 0
            }}
          >
            <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400 mb-6">
              Send a Message
            </h2>
            <ContactForm />
          </div>

          {/* Social Links & Info */}
          <div 
            className="space-y-8 transition-all duration-1000 delay-400"
            style={{
              transform: fadeIn ? 'translateX(0)' : 'translateX(30px)',
              opacity: fadeIn ? 1 : 0
            }}
          >
            <div className="bg-gradient-to-br from-purple-900/20 to-black/40 backdrop-blur-sm border border-purple-500/30 rounded-xl p-8">
              <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400 mb-6">
                Connect With Me
              </h2>
              <div className="grid grid-cols-2 gap-4">
                {socialLinks.map((link, idx) => (
                  <a
                    key={idx}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center justify-center p-6 bg-black/40 border border-purple-500/30 rounded-lg transition-all duration-300 hover:scale-105 hover:border-purple-400/60 hover:shadow-lg hover:shadow-purple-500/20 group"
                  >
                    <div className="text-purple-400 group-hover:text-cyan-400 transition-colors duration-300">
                      {link.icon}
                    </div>
                    <span className="text-sm text-gray-400 mt-2 group-hover:text-purple-300 transition-colors duration-300">
                      {link.name}
                    </span>
                  </a>
                ))}
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-900/20 to-black/40 backdrop-blur-sm border border-purple-500/30 rounded-xl p-8">
              <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400 mb-4">
                Location
              </h2>
              <p className="text-gray-300 mb-2">📍 Bengaluru, Karnataka, India</p>
              <p className="text-gray-400 text-sm">Open to remote opportunities worldwide</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}