CREATE VIRTUAL TABLE IF NOT EXISTS director_search USING fts5(
  user_id UNINDEXED,
  content,
  tokenize = 'unicode61'
);

DELETE FROM director_search;

INSERT INTO director_search (user_id, content)
SELECT
  u.id,
  trim(
    coalesce(u.name, '') || ' ' ||
    coalesce(s.name, '') || ' ' ||
    coalesce(s.address, '') || ' ' ||
    coalesce(p.city, '') || ' ' ||
    coalesce(s.useful_experience, p.experience, '') || ' ' ||
    coalesce(s.want_to_know, '') || ' ' ||
    coalesce(p.interests, '') || ' ' ||
    coalesce(ps.names, '') || ' ' ||
    coalesce(pk.names, '') || ' ' ||
    coalesce(pt.tags, '')
  )
FROM users u
LEFT JOIN profiles p ON p.user_id = u.id
LEFT JOIN schools s ON s.user_id = u.id
LEFT JOIN (
  SELECT user_id, group_concat(name, ' ') AS names
  FROM profile_strengths
  GROUP BY user_id
) ps ON ps.user_id = u.id
LEFT JOIN (
  SELECT user_id, group_concat(name, ' ') AS names
  FROM profile_skills
  GROUP BY user_id
) pk ON pk.user_id = u.id
LEFT JOIN (
  SELECT user_id, group_concat(tag, ' ') AS tags
  FROM profile_tags
  GROUP BY user_id
) pt ON pt.user_id = u.id
WHERE u.role = 'director';
