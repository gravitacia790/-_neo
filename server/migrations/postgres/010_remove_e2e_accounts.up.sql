DELETE FROM messages_archive
WHERE from_user_id IN (
  SELECT id
  FROM users
  WHERE email LIKE 'e2e-director-%@school.ru'
)
OR to_user_id IN (
  SELECT id
  FROM users
  WHERE email LIKE 'e2e-director-%@school.ru'
);

DELETE FROM users
WHERE email LIKE 'e2e-director-%@school.ru';
