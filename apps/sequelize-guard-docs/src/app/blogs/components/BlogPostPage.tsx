import { blogSource } from '@/lib/source';
import { DocsBody } from 'fumadocs-ui/page';
import { Calendar, User, Tag, ArrowLeft, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

interface BlogPostPageProps {
  slug: string[];
}

export function BlogPostPage({ slug }: BlogPostPageProps) {
  const page = blogSource.getPage(slug);
  if (!page) notFound();

  const MDX = page.data.body;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-4xl mx-auto px-4 py-10 sm:px-6 sm:py-16">
        <header className="mb-10 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3 group">
            <ShieldCheck className="w-8 h-8 text-emerald-600 group-hover:text-emerald-700 transition" />
            <span className="text-xl font-bold text-slate-900 group-hover:text-slate-950 transition">
              Sequelize Guard
            </span>
          </Link>
        </header>

        <Link
          href="/blogs"
          className="inline-flex items-center gap-2 text-emerald-600 hover:text-emerald-700 font-medium mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Blog
        </Link>

        <article className="bg-white rounded-xl shadow-lg p-4 sm:p-6 md:p-10 border border-slate-200">
          <header className="mb-8 pb-8 border-b border-slate-200">
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              {page.data.title}
            </h1>

            {page.data.description && (
              <p className="text-xl text-slate-600 mb-6">
                {page.data.description}
              </p>
            )}

            <div className="flex flex-wrap gap-4 text-sm text-slate-500">
              {page.data.date && (
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <time>
                    {new Date(page.data.date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </time>
                </div>
              )}

              {page.data.author && (
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  <span>{page.data.author}</span>
                </div>
              )}
            </div>

            {page.data.tags && page.data.tags.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap mt-4">
                <Tag className="w-4 h-4 text-slate-400" />
                {page.data.tags.map((tag: string) => (
                  <span
                    key={tag}
                    className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-sm font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </header>

          <DocsBody className="prose prose-sm sm:prose-base prose-slate max-w-none prose-headings:text-slate-900 prose-p:text-slate-700 prose-p:leading-relaxed prose-li:text-slate-700 prose-strong:text-slate-900 prose-a:text-emerald-600 prose-a:font-medium hover:prose-a:text-emerald-700 prose-code:text-emerald-600 prose-code:font-semibold prose-pre:bg-slate-900 prose-pre:text-sm sm:prose-pre:text-base prose-pre:overflow-x-auto prose-pre:rounded-lg prose-pre:p-4 prose-h2:text-slate-900 prose-h3:text-slate-800">
            <MDX />
          </DocsBody>
        </article>

        <div className="mt-8 text-center">
          <Link
            href="/blogs"
            className="inline-flex items-center gap-2 text-emerald-600 hover:text-emerald-700 font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to all posts
          </Link>
        </div>
      </div>
    </div>
  );
}
