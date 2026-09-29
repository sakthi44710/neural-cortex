'use client';

import { motion } from 'framer-motion';
import {
  Brain, Upload, MessageSquare, Network, Sparkles,
  Shield, Zap, ArrowRight, ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';

const features = [
  {
    icon: Brain,
    title: 'Neural Memory',
    description: 'Multi-modal memory system that ingests documents, images, and notes into a unified knowledge base.',
    color: 'from-neon-blue to-cyan-400',
  },
  {
    icon: Network,
    title: 'Knowledge Graph',
    description: 'Interactive visualization of your knowledge connections. Discover hidden patterns and insights.',
    color: 'from-neon-purple to-violet-400',
  },
  {
    icon: MessageSquare,
    title: 'AI Conversation',
    description: 'Chat with your knowledge using NVIDIA NIM AI. Get answers with source citations.',
    color: 'from-neon-pink to-rose-400',
  },
  {
    icon: Sparkles,
    title: 'Predictive Intelligence',
    description: 'Morning briefs, knowledge gap detection, and proactive suggestions powered by AI.',
    color: 'from-neon-green to-emerald-400',
  },
  {
    icon: Upload,
    title: 'Smart Ingestion',
    description: 'Upload any text document. AI automatically extracts entities, key points, and summaries.',
    color: 'from-yellow-400 to-orange-400',
  },
  {
    icon: Shield,
    title: 'Privacy First',
    description: 'Your data stays yours. Local-first architecture with SQLite. No data leaves your machine.',
    color: 'from-emerald-400 to-teal-400',
  },
];

const particles = Array.from({ length: 25 }, (_, i) => ({
  id: i,
  left: `${Math.random() * 100}%`,
  top: `${Math.random() * 100}%`,
  color: ['#00f0ff', '#b829f7', '#ff0080', '#00ff88'][i % 4],
  delay: `${Math.random() * 8}s`,
  duration: `${6 + Math.random() * 4}s`,
  opacity: 0.2 + Math.random() * 0.4,
}));

export default function LandingPage() {
  const { data: session } = useSession();

  return (
    <div className="min-h-screen animated-gradient">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 glass-strong">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-neon-blue to-neon-purple flex items-center justify-center">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold gradient-text">Neural Cortex</span>
          </Link>
          <div className="flex items-center gap-4">
            {session ? (
              <Link href="/dashboard" className="btn-primary flex items-center gap-2">
                Dashboard <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <>
                <Link href="/api/auth/signin" className="text-text-secondary hover:text-white transition-colors">
                  Sign In
                </Link>
                <Link href="/api/auth/signin" className="btn-primary flex items-center gap-2">
                  Get Started <ArrowRight className="w-4 h-4" />
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
        {/* Animated background particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {particles.map((p) => (
            <div
              key={p.id}
              className="absolute w-1 h-1 rounded-full particle"
              style={{
                left: p.left,
                top: p.top,
                backgroundColor: p.color,
                animationDelay: p.delay,
                animationDuration: p.duration,
                opacity: p.opacity,
              }}
            />
          ))}
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-neon-blue/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-neon-purple/5 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-neon-pink/3 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-8">
              <Zap className="w-4 h-4 text-neon-blue" />
              <span className="text-sm text-text-secondary">Powered by NVIDIA NIM AI</span>
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="text-5xl md:text-7xl font-bold mb-6 leading-tight"
          >
            Your AI{' '}
            <span className="gradient-text">Knowledge Twin</span>
            <br />
            That Thinks Like You
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-xl text-text-secondary max-w-2xl mx-auto mb-10"
          >
            We consume 34GB of information daily but retain less than 1%.
            Neural Cortex remembers everything, finds connections you&apos;d miss,
            and predicts what you need before you ask.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link
              href={session ? '/dashboard' : '/api/auth/signin'}
              className="btn-primary text-lg flex items-center gap-2 justify-center"
            >
              Start Building Your Brain <ArrowRight className="w-5 h-5" />
            </Link>
            <a href="#features" className="btn-secondary text-lg flex items-center gap-2 justify-center">
              See How It Works <ChevronRight className="w-5 h-5" />
            </a>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="mt-20 grid grid-cols-3 gap-8 max-w-md mx-auto"
          >
            {[
              { value: '\u221E', label: 'Memory' },
              { value: '<1s', label: 'Recall' },
              { value: '100%', label: 'Private' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl font-bold gradient-text">{stat.value}</div>
                <div className="text-sm text-text-secondary mt-1">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-32 relative">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              A Brain That <span className="gradient-text">Never Forgets</span>
            </h2>
            <p className="text-text-secondary text-lg max-w-2xl mx-auto">
              Six powerful modules working together to create your personal cognitive architecture.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="group p-6 rounded-2xl glass card-hover cursor-pointer"
              >
                <div
                  className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}
                >
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-text-secondary leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-32 relative neural-bg">
        <div className="max-w-5xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              How It <span className="gradient-text">Works</span>
            </h2>
          </motion.div>

          <div className="space-y-16">
            {[
              {
                step: '01',
                title: 'Ingest Everything',
                desc: 'Upload documents, notes, and ideas. Any text format. The AI extracts meaning, entities, and relationships automatically.',
              },
              {
                step: '02',
                title: 'Build Your Graph',
                desc: 'Watch your knowledge form connections in real-time. Concepts cluster, patterns emerge, and insights surface.',
              },
              {
                step: '03',
                title: 'Converse & Create',
                desc: 'Ask questions across your entire knowledge base. Get AI responses with source citations and connected insights.',
              },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, x: i % 2 === 0 ? -30 : 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="flex items-start gap-8"
              >
                <div className="text-7xl font-bold gradient-text opacity-40 shrink-0 leading-none">
                  {item.step}
                </div>
                <div>
                  <h3 className="text-2xl font-bold mb-3">{item.title}</h3>
                  <p className="text-text-secondary text-lg leading-relaxed">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 relative">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="p-12 rounded-3xl glass-strong neon-glow"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Ready to <span className="gradient-text">Amplify</span> Your Mind?
            </h2>
            <p className="text-text-secondary text-lg mb-8 max-w-xl mx-auto">
              Join the future of personal knowledge management. Your AI twin is waiting.
            </p>
            <Link
              href={session ? '/dashboard' : '/api/auth/signin'}
              className="btn-primary text-lg inline-flex items-center gap-2"
            >
              Launch Neural Cortex <ArrowRight className="w-5 h-5" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border-custom">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-neon-blue" />
            <span className="font-semibold">Neural Cortex</span>
          </div>
          <p className="text-text-secondary text-sm">
            Built with NVIDIA NIM &amp; Next.js for DevHeat 2026
          </p>
        </div>
      </footer>
    </div>
  );
}
