import { blogSource } from '@/lib/source';
import Link from 'next/link';
import { Calendar, User, Tag } from 'lucide-react';

export function BlogIndexPage() {
  const allBlogs = [...blogSource.getPages()].sort((a, b) => {
    const dateA = new Date(a.data.date || 0).getTime();
    const dateB = new Date(b.data.date || 0).getTime();
    return dateB - dateA;
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-5xl mx-auto px-6 py-16">
        <div className="mb-12">
          <Link
            href="/"
            className="text-emerald-600 hover:text-emerald-700 font-medium mb-4 inline-block"
          >
            ← Back to Home
          </Link>
          <h1 className="text-5xl font-bold text-slate-900 mb-4">Blog</h1>
          <p className="text-xl text-slate-600">
            Insights, updates, and stories about sequelize-guard
          </p>
        </div>

        <div className="space-y-8">
          {allBlogs.map((blog) => (
            <article
              key={blog.url}
              className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow p-8 border border-slate-200"
            >
              <Link href={blog.url} className="group">
                <h2 className="text-3xl font-bold text-slate-900 mb-3 group-hover:text-emerald-600 transition">
                  {blog.data.title}
                </h2>
              </Link>

              {blog.data.description && (
                <p className="text-lg text-slate-600 mb-4">
                  {blog.data.description}
                </p>
              )}

              <div className="flex flex-wrap gap-4 text-sm text-slate-500 mb-4">
                {blog.data.date && (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <time>
                      {new Date(blog.data.date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </time>
                  </div>
                )}

                {blog.data.author && (
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    <span>{blog.data.author}</span>
                  </div>
                )}
              </div>

              {blog.data.tags && blog.data.tags.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Tag className="w-4 h-4 text-slate-400" />
                  {blog.data.tags.map((tag: string) => (
                    <span
                      key={tag}
                      className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-sm font-medium"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <Link
                href={blog.url}
                className="inline-flex items-center gap-2 mt-6 text-emerald-600 hover:text-emerald-700 font-semibold"
              >
                Read more →
              </Link>
            </article>
          ))}
        </div>

        {allBlogs.length === 0 && (
          <div className="text-center py-16">
            <p className="text-xl text-slate-500">No blog posts yet. Check back soon!</p>
          </div>
        )}
      </div>
    </div>
  );
}
