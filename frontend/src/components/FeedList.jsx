import AdCard from "./AdCard.jsx";
import PostCard from "./PostCard.jsx";

export default function FeedList({ posts, ads, currentUser, onPostChanged, onAdDeleted }) {
  const activeAds = (ads || []).filter((ad) => ad.is_active);

  const firstAds = activeAds.filter((ad) => ad.placement === "first");
  const afterAds = activeAds
    .filter((ad) => ad.placement === "after")
    .sort((a, b) => (a.after_posts || 0) - (b.after_posts || 0));

  const items = [];

  for (const ad of firstAds) {
    items.push({ type: "ad", data: ad, key: `ad-first-${ad.id}` });
  }

  let postIndex = 0;
  let afterAdIndex = 0;

  while (postIndex < posts.length || afterAdIndex < afterAds.length) {
    const nextPost = posts[postIndex];
    const nextAd = afterAds[afterAdIndex];

    if (nextAd && nextPost) {
      const afterCount = nextAd.after_posts || 0;
      if (postIndex === afterCount) {
        items.push({ type: "ad", data: nextAd, key: `ad-after-${nextAd.id}-${afterCount}` });
        afterAdIndex++;
        continue;
      }
    }

    if (nextPost) {
      items.push({ type: "post", data: nextPost, key: `post-${nextPost.id}` });
      postIndex++;
      continue;
    }

    if (nextAd) {
      const afterCount = nextAd.after_posts || 0;
      if (postIndex >= afterCount) {
        items.push({ type: "ad", data: nextAd, key: `ad-remaining-${nextAd.id}` });
      }
      afterAdIndex++;
      continue;
    }

    break;
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-[#E4E7EC] bg-white py-10 text-center text-sm text-[#98A2B3]">
        এখনো কোনো পোস্ট বা বিজ্ঞাপন নেই।
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item) =>
        item.type === "ad" ? (
          <AdCard
            key={item.key}
            ad={item.data}
            currentUser={currentUser}
            onDeleted={onAdDeleted}
          />
        ) : (
          <PostCard key={item.key} post={item.data} currentUser={currentUser} onChanged={onPostChanged} />
        )
      )}
    </div>
  );
}