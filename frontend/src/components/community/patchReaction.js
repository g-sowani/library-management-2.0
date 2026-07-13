export function patchReaction(comments, targetId, reactions) {
  return comments.map((c) => {
    if (c.id === targetId) return { ...c, reactions };
    if (c.replies?.length)
      return { ...c, replies: patchReaction(c.replies, targetId, reactions) };
    return c;
  });
}
