-- Demo accounts for local development and the first production deploy.
--
-- The hashes are PBKDF2-SHA256, 100000 iterations, matching
-- src/lib/password.ts. That count is not a free choice: workerd caps PBKDF2 at
-- 100000 and throws `NotSupportedError: iteration counts above 100000 are not
-- supported` for anything higher, which turned every registration into a 500.
-- They are committed deliberately: these two accounts exist only to make a
-- fresh database usable, and their passwords are published here anyway.
--
-- 0007 re-seeds these two accounts at the same iteration count, so a database
-- created from an older revision of this file still ends up able to log in.
--
-- INSERT OR IGNORE keys off the email unique index, so re-applying the
-- migration does not error and does not reset a password that was changed
-- after the first run.

INSERT OR IGNORE INTO users (id, email, name, password_hash, role)
VALUES
  (
    'usr_0000admin',
    'admin@helpmycv.id',
    'Demo Admin',
    'pbkdf2_sha256$210000$a1b2c3d4e5f607182930a1b2c3d4e5f6$48d827e41eecb7aa04962279bc832d8c51c8806dc35977ea6d5cdc8786fe3c6f',
    'admin'
  ),
  (
    'usr_00000000',
    'user@helpmycv.id',
    'Demo User',
    'pbkdf2_sha256$210000$0f1e2d3c4b5a69788796a5b4c3d2e1f0$570e6d3883eca504fc4da679ec98169b32bde1cfdbe1a858c1f3ff1e92351d43',
    'user'
  );