import { blogSource } from '@/lib/source';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BlogIndexPage } from '../components/BlogIndexPage';
import { BlogPostPage } from '../components/BlogPostPage';

export default async function Page(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;
  
  // If no slug, show blog index
  if (!params.slug || params.slug.length === 0) {
    return <BlogIndexPage />;
  }

  // Otherwise, show individual blog post
  return <BlogPostPage slug={params.slug} />;
}

export async function generateStaticParams() {
  return blogSource.generateParams();
}

export async function generateMetadata(props: {
  params: Promise<{ slug?: string[] }>;
}): Promise<Metadata> {
  const params = await props.params;
  
  // If no slug, return blog index metadata
  if (!params.slug || params.slug.length === 0) {
    return {
      title: 'Blog - Sequelize Guard',
      description: 'Insights, updates, and stories about sequelize-guard',
    };
  }
  
  const page = blogSource.getPage(params.slug);
  if (!page) notFound();

  return {
    title: page.data.title,
    description: page.data.description,
  };
}
