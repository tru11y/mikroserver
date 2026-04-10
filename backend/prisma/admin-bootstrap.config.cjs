const DEFAULT_SUPER_ADMIN_EMAIL = 'admin@mikroserver.com';
const DEFAULT_SUPER_ADMIN_PASSWORD = '12345678';
const DEFAULT_SUPER_ADMIN_FIRST_NAME = 'Super';
const DEFAULT_SUPER_ADMIN_LAST_NAME = 'Admin';

function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase();
}

function getSeedAdminConfig(env = process.env) {
  return {
    email: normalizeEmail(
      env.SEED_ADMIN_EMAIL ??
        env.DEFAULT_SUPER_ADMIN_EMAIL ??
        DEFAULT_SUPER_ADMIN_EMAIL,
    ),
    password:
      env.SEED_ADMIN_PASSWORD ??
      env.DEFAULT_SUPER_ADMIN_PASSWORD ??
      DEFAULT_SUPER_ADMIN_PASSWORD,
    firstName:
      env.SEED_ADMIN_FIRST_NAME ??
      env.DEFAULT_SUPER_ADMIN_FIRST_NAME ??
      DEFAULT_SUPER_ADMIN_FIRST_NAME,
    lastName:
      env.SEED_ADMIN_LAST_NAME ??
      env.DEFAULT_SUPER_ADMIN_LAST_NAME ??
      DEFAULT_SUPER_ADMIN_LAST_NAME,
  };
}

function getRecoveryAdminConfig(env = process.env) {
  return {
    email: normalizeEmail(
      env.ADMIN_RECOVERY_EMAIL ??
        env.SEED_ADMIN_EMAIL ??
        env.DEFAULT_SUPER_ADMIN_EMAIL ??
        DEFAULT_SUPER_ADMIN_EMAIL,
    ),
    password:
      env.ADMIN_RECOVERY_PASSWORD ??
      env.SEED_ADMIN_PASSWORD ??
      env.DEFAULT_SUPER_ADMIN_PASSWORD ??
      DEFAULT_SUPER_ADMIN_PASSWORD,
    firstName:
      env.ADMIN_RECOVERY_FIRST_NAME ??
      env.SEED_ADMIN_FIRST_NAME ??
      env.DEFAULT_SUPER_ADMIN_FIRST_NAME ??
      DEFAULT_SUPER_ADMIN_FIRST_NAME,
    lastName:
      env.ADMIN_RECOVERY_LAST_NAME ??
      env.SEED_ADMIN_LAST_NAME ??
      env.DEFAULT_SUPER_ADMIN_LAST_NAME ??
      DEFAULT_SUPER_ADMIN_LAST_NAME,
  };
}

module.exports = {
  DEFAULT_SUPER_ADMIN_EMAIL,
  DEFAULT_SUPER_ADMIN_PASSWORD,
  DEFAULT_SUPER_ADMIN_FIRST_NAME,
  DEFAULT_SUPER_ADMIN_LAST_NAME,
  normalizeEmail,
  getSeedAdminConfig,
  getRecoveryAdminConfig,
};
