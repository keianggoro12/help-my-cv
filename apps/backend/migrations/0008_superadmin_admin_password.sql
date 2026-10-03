-- Set the superadmin password to admin@12345.
--
-- The account was created by 0003 with a hash that does not match this
-- password, and 0005/0006 only re-derived hashes for a different iteration
-- count, so `superadmin@gmail.com` could not be signed into with it.
--
-- PBKDF2-SHA256, 100000 iterations, matching src/lib/password.ts. Salt and
-- digest are hex, and the salt is decoded to raw bytes before deriving (the
-- same rule password.ts applies) so this hash verifies in the Worker.
--
-- Deliberately committed: this is a shared owner account, and its password
-- is published here anyway. Rotate it if that stops being true.

UPDATE users
   SET password_hash = 'pbkdf2_sha256$100000$02a9f5ed1f3d2ae38d86e12cf6073754$0bd6b2ed58a9d88fa561c08ef7f6ce88f94c4587631481e44e1f59292259d79d'
 WHERE email = 'superadmin@gmail.com';
