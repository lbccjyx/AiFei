import { getPosts, type Post } from '../lib/content';
import PostList from '../components/PostList';

export type PostListViewProps = {
  /** page heading shown above the list */
  title: string;
  /** posts to list; defaults to every post (the archive) */
  posts?: Post[];
  /** back target when the back control is used (history back, fallback id) */
  backFallback?: string;
  /** hide the year rail when the list has fewer than this many posts */
  minRailPosts?: number;
};

/**
 * The unified "post list" page — a year-grouped list of posts with the
 * right-edge year rail (omitted when there are too few posts to navigate).
 *
 * Archive and tag pages are the same view fed with different data: the
 * archive lists every post; a tag page lists a tag-filtered subset under a
 * "Tag: …" title. The page registry picks the data, this component owns the
 * presentation.
 */
export default function PostListView({
  title,
  posts = getPosts(),
  backFallback = 'home',
  minRailPosts,
}: PostListViewProps) {
  return (
    <PostList
      posts={posts}
      title={title}
      showBack
      backFallback={backFallback}
      minRailPosts={minRailPosts}
    />
  );
}
