import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';
import {
  Zap,
  CheckCircle2,
  Key,
  Star,
  Github,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Code,
  Database,
} from 'lucide-react';
import Link from 'next/link';

export const HomePageScreen = () => {
  return (
    <>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
        {/* Navigation */}
        <nav className="border-b border-slate-200 bg-white/80 backdrop-blur sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-9 h-9 text-emerald-600" />
              <span className="text-2xl font-bold text-slate-900">
                Sequelize Guard
              </span>
            </div>
            <div className="flex items-center gap-8">
              <Link
                href="/docs"
                className="text-slate-600 hover:text-slate-900 font-medium transition"
              >
                Documentation
              </Link>
              <Link
                href="/blogs"
                className="text-slate-600 hover:text-slate-900 font-medium transition"
              >
                Blog
              </Link>
              <a
                href="#features"
                className="text-slate-600 hover:text-slate-900 font-medium transition"
              >
                Features
              </a>
              <a
                href="#usage"
                className="text-slate-600 hover:text-slate-900 font-medium transition"
              >
                Usage
              </a>
              <a
                href="#demo"
                className="text-slate-600 hover:text-slate-900 font-medium transition"
              >
                Demo
              </a>
              <a
                href="https://github.com/lotivo/sequelize-guard"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition"
              >
                <Github className="w-5 h-5" />
                GitHub
              </a>
            </div>
          </div>
        </nav>

        {/* Hero */}
        <section className="pt-32 pb-24 px-6">
          <div className="max-w-5xl mx-auto text-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-indigo-100 text-indigo-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
                <Zap className="w-4 h-4" />
                Now with Sequelize v6 & v7 support
              </div>
              <br />

              <div className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
                <Sparkles className="w-4 h-4" />
                Powerful RBAC for Sequelize.js
              </div>
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-slate-900 mb-6 leading-tight">
              Role-Based Access Control
              <br />
              <span className="text-emerald-600">Made Simple & Fast</span>
            </h1>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto mb-10 leading-relaxed">
              A fluent, high-performance authorization library for Sequelize
              <br /> that brings Laravel-style permissions to Node.js <br />{' '}
              with caching, events, and zero dependencies.
            </p>

            <div className="flex flex-col sm:flex-row gap-5 justify-center items-center mb-12">
              <Link
                href="/docs/guide/installation"
                className="inline-flex items-center gap-3 bg-emerald-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-emerald-700 transition shadow-lg"
              >
                Get Started
                <ArrowRight className="w-5 h-5" />
              </Link>
              <a
                href="https://github.com/lotivo/sequelize-guard"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 border-2 border-slate-300 px-8 py-4 rounded-xl font-bold text-lg  text-gray-900 hover:border-slate-400 transition"
              >
                <Star className="w-5 h-5" />
                Star on GitHub
              </a>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-16 bg-gray-50 sm:py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="lg:text-center">
              <h2 className="text-base text-indigo-600 font-semibold tracking-wide uppercase">
                Core Features
              </h2>
              <p className="mt-2 text-3xl leading-8 font-extrabold tracking-tight text-gray-900 sm:text-4xl">
                The Authorization Toolkit You Need
              </p>
            </div>

            <div className="mt-16">
              <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
                {features.map((feature) => (
                  <div key={feature.title} className="pt-6">
                    <div className="flow-root bg-white rounded-lg px-6 pb-8 shadow-lg h-full">
                      <div className="-mt-6">
                        <div>
                          <span className="inline-flex items-center justify-center p-3 border border-indigo-100 bg-indigo-50 rounded-md shadow-lg">
                            <feature.icon
                              className="h-6 w-6 text-indigo-600"
                              aria-hidden="true"
                            />
                          </span>
                        </div>
                        <h3 className="mt-4 text-xl font-semibold text-gray-900">
                          {feature.title}
                        </h3>
                        <p className="mt-2 text-base text-gray-500">
                          {feature.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Demo / Code */}
        <section id="demo" className="py-24 bg-slate-50">
          <div className="max-w-5xl mx-auto px-6">
            <div className="lg:text-center mb-20">
              <h2 className="text-base text-indigo-600 font-semibold tracking-wide uppercase">
                Usage
              </h2>
              <p className="mt-2 text-3xl leading-8 font-extrabold tracking-tight text-gray-900 sm:text-4xl">
                Start guarding your API in Minutes
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <h3 className="text-xl font-bold mb-6 text-center text-gray-900 ">
                  Define Permissions Like a Pro
                </h3>
                <DynamicCodeBlock
                  lang="ts"
                  code={definePermissionCode}
                  options={{
                    themes: {
                      light: 'github-dark',
                      dark: 'github-dark',
                    },
                    components: {
                      // override components (e.g. `pre` and `code`)
                    },
                    theme: 'github-dark',
                  }}
                />
              </div>

              <div>
                <h3 className="text-xl font-bold mb-6 text-center text-gray-900 ">
                  Authorize in Style
                </h3>

                <DynamicCodeBlock
                  lang="ts"
                  code={checkPermissionCode}
                  options={{
                    themes: {
                      light: 'github-dark',
                      dark: 'github-dark',
                    },
                    components: {
                      // override components (e.g. `pre` and `code`)
                    },
                    theme: 'github-dark',
                  }}
                />
              </div>
            </div>

            <div className="mt-16 text-center">
              <div className="inline-flex items-center gap-3 text-emerald-600 font-semibold">
                <CheckCircle2 className="w-6 h-6" />
                <span>Feels like Laravel Permission — but for Node.js</span>
              </div>
            </div>
          </div>
        </section>

        {/* Installation */}
        <section id="installation" className="py-24 bg-emerald-50">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <h2 className="text-4xl font-bold text-slate-900 mb-8">
              Ready to Level Up Your Auth?
            </h2>
            <div className="bg-white p-8 rounded-2xl shadow-xl inline-block max-w-2xl mt-4">
              <code className="text-xl font-mono text-slate-800">
                yarn add sequelize-guard
              </code>
            </div>
            <div className="mt-8 flex flex-wrap justify-center gap-6 text-slate-600 font-medium ">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />{' '}
                Plug-n-Play
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" /> Full
                TypeScript Support
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />{' '}
                Event-Driven
              </span>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-slate-900 text-white py-16">
          <div className="max-w-7xl mx-auto px-6 text-center">
            <div className="flex items-center justify-center gap-3 mb-6">
              <ShieldCheck className="w-10 h-10 text-emerald-500" />
              <span className="text-3xl font-bold">Sequelize Guard</span>
            </div>
            <p className="text-slate-400 text-lg mb-8">
              The missing authorization layer for Sequelize.js
            </p>
            <div className="flex justify-center gap-8 text-slate-400">
              <a
                href="https://github.com/lotivo/sequelize-guard"
                className="hover:text-white transition flex items-center gap-2"
              >
                GitHub
              </a>
              <div className="border-l border-slate-600 h-5" />
              <a
                href="https://www.npmjs.com/package/sequelize-guard"
                className="hover:text-white transition flex items-center gap-2"
              >
                NPM
              </a>
              <div className="border-l border-slate-600 h-5" />
              <Link href="/docs" className="hover:text-white transition">
                Documentation
              </Link>
              <div className="border-l border-slate-600 h-5" />
              <Link href="/blogs" className="hover:text-white transition">
                Blog
              </Link>
            </div>
            <p className="mt-10 text-slate-500 text-sm">
              Made with ❤️ for Open-Source by{' '}
              <a
                href="https://github.com/pankajvaghela"
                className="text-emerald-400 hover:underline"
              >
                Pankaj Vaghela
              </a>
            </p>
          </div>
        </footer>
      </div>
    </>
  );
};

const features = [
  {
    icon: Key,
    title: 'Role & Permission Based',
    description:
      'Implement fine-grained access control by easily assigning multiple roles and specific permissions to your users.',
  },
  {
    icon: Zap,
    title: 'Super-Fast Caching',
    description:
      'Leverage a built-in, highly optimized caching layer for near-instant permission resolution, minimizing database lookups.',
  },
  {
    icon: Code,
    title: 'Fluent Semantic API',
    description:
      "Check permissions using a simple, readable API: `user.can('action resource')`. Authorization is straightforward and intuitive.",
  },
  {
    icon: Database,
    title: 'Seamless Sequelize Integration',
    description:
      'A native, lightweight extension for Sequelize, ensuring zero friction with your existing Node.js and ORM setup.',
  },
];

export const definePermissionCode = `// Using Guard-Control builder
guard.init()
  .allow('admin')
  .to(['view', 'edit', 'delete'])
  .on('blog')
  .commit();

// Or one-liner
guard.allow('editor', ['view', 'edit'], 'post');`;

export const checkPermissionCode = `// Permission checks
user.can('edit blog');
user.can('* blog');     // all actions on blog
user.can('view *');     // view everything
user.can('*');          // superadmin

// Role checks
user.isA('admin');
user.isAnyOf(['admin', 'editor']);`;
