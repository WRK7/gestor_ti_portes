const pool = require('../config/database');

/**
 * record(actor, action, entity, entityId, entityName, detail)
 * actor: req.user object { id, name, username, role }
 */
const record = async (actor, action, entity, entityId, entityName, detail = null) => {
  try {
    await pool.query(
      `INSERT INTO logs_ti (actor_id, actor_name, actor_role, action, entity, entity_id, entity_name, detail)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        actor?.id   ?? null,
        actor?.name ?? actor?.username ?? null,
        actor?.role ?? null,
        action,
        entity,
        entityId   ?? null,
        entityName ?? null,
        detail     ?? null,
      ]
    );
  } catch (err) {
    console.error('[LOG ERROR]', err.message);
  }
};

module.exports = { record };
