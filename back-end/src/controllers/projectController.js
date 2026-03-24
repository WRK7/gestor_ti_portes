const pool  = require('../config/database');
const { record } = require('../utils/log');
const { notify, notifyMultiple } = require('./notificationController');

const projectSelectSql = () => `
  SELECT
    p.*,
    u.name  AS responsible_name,
    u.id    AS responsible_id,
    cb.name AS created_by_name,
    (p.responsible_id = ? OR EXISTS (
      SELECT 1 FROM task_assignees_ti ta
      WHERE ta.task_id = p.source_task_id AND ta.user_id = ?
    )) AS user_can_negotiate
  FROM projects_ti p
  LEFT JOIN users u  ON p.responsible_id = u.id
  LEFT JOIN users cb ON p.created_by      = cb.id`;

const projectSelectParams = (userId) => [userId, userId];

const canNegotiateAsDev = async (user, project) => {
  if (project.responsible_id === user.id) return true;
  if (!project.source_task_id) return false;
  const [rows] = await pool.query(
    'SELECT 1 FROM task_assignees_ti WHERE task_id = ? AND user_id = ? LIMIT 1',
    [project.source_task_id, user.id]
  );
  return rows.length > 0;
};

const notifyBonifStakeholders = async (projectId, title, body, link, excludeUserId = null) => {
  const [proj] = await pool.query(
    'SELECT responsible_id, source_task_id FROM projects_ti WHERE id = ?',
    [projectId]
  );
  const notifUsers = [];
  if (proj[0]?.responsible_id) notifUsers.push(proj[0].responsible_id);
  if (proj[0]?.source_task_id) {
    const [tas] = await pool.query(
      'SELECT user_id FROM task_assignees_ti WHERE task_id = ?',
      [proj[0].source_task_id]
    );
    tas.forEach(t => notifUsers.push(t.user_id));
  }
  const unique = [...new Set(notifUsers)];
  await notifyMultiple(unique, 'bonif_pending', title, body, link, excludeUserId);
};

const syncProjectAggregates = async (projectId) => {
  const [parts] = await pool.query(
    'SELECT awaiting_params, bonificado FROM project_bonif_participants_ti WHERE project_id = ?',
    [projectId]
  );
  if (!parts.length) return;

  const anyAwaiting = parts.some((p) => p.awaiting_params === 1);
  const allBonif = parts.every((p) => p.bonificado === 1);
  const collaborative = parts.length > 1 ? 1 : 0;

  await pool.query(
    `UPDATE projects_ti SET
      awaiting_params = ?,
      bonificado = ?,
      collaborative = ?,
      updated_at = NOW()
    WHERE id = ?`,
    [anyAwaiting ? 1 : 0, allBonif ? 1 : 0, collaborative, projectId]
  );
};

const attachParticipantsToRows = async (rows, userId) => {
  if (!rows?.length) return rows;
  const ids = rows.map((r) => r.id);
  const [parts] = await pool.query(
    `SELECT bp.*, u.name AS member_name
     FROM project_bonif_participants_ti bp
     LEFT JOIN users u ON u.id = bp.user_id
     WHERE bp.project_id IN (?)
     ORDER BY u.name`,
    [ids]
  );
  const byPid = {};
  for (const bp of parts) {
    (byPid[bp.project_id] ||= []).push(bp);
  }

  return rows.map((r) => {
    const list = byPid[r.id] || [];
    const collaborative = list.length > 1 || Number(r.collaborative) === 1;
    const out = { ...r, bonif_participants: list, collaborative: collaborative ? 1 : 0 };

    if (list.length) {
      out.user_can_negotiate = list.some(
        (bp) => bp.user_id === userId && bp.bonif_pending_response === 'dev'
      );
    }

    if (list.length === 1 && !collaborative) {
      const bp = list[0];
      out.suggested_value = bp.suggested_value;
      out.awaiting_params = bp.awaiting_params;
      out.financial_return = bp.financial_return;
      out.dev_seconds = bp.dev_seconds ?? r.dev_seconds;
      out.bonif_pending_response = bp.bonif_pending_response;
      out.gestor_offer_value = bp.gestor_offer_value;
      out.gestor_offer_installments = bp.gestor_offer_installments;
      out.bonificado = bp.bonificado;
      out.approved_value = bp.approved_value;
      out.installment_count = bp.installment_count;
      out.bonificado_at = bp.bonificado_at;
      out.bonificado_by = bp.bonificado_by;
      out.user_can_negotiate =
        bp.user_id === userId && bp.bonif_pending_response === 'dev';
    }

    return out;
  });
};

const canManageProject = async (user, projectId) => {
  // Gestor atua na aprovação/negociação; edição estrutural do projeto fica com admin/superadmin.
  if (['superadmin', 'admin'].includes(user.role)) return true;

  const [rows] = await pool.query(
    `SELECT 1
     FROM projects_ti p
     WHERE p.id = ?
       AND (
         p.created_by = ?
         OR p.responsible_id = ?
         OR EXISTS (
           SELECT 1
           FROM task_assignees_ti ta
           WHERE ta.task_id = p.source_task_id
             AND ta.user_id = ?
         )
       )
     LIMIT 1`,
    [projectId, user.id, user.id, user.id]
  );

  return rows.length > 0;
};

const getAllProjects = async (req, res) => {
  try {
    const { bonificado, awaiting_params, month, year } = req.query;
    let where = 'WHERE 1=1';
    const params = [];

    if (bonificado !== undefined) {
      where += ' AND p.bonificado = ?';
      params.push(bonificado === '1' || bonificado === 'true' ? 1 : 0);
    }

    if (awaiting_params !== undefined) {
      where += ' AND p.awaiting_params = ?';
      params.push(awaiting_params === '1' || awaiting_params === 'true' ? 1 : 0);
    }

    // month/year filter: show projects bonified in that month OR not yet bonified
    if (month && year) {
      where += ` AND (
        p.bonificado = 0
        OR (MONTH(p.bonificado_at) = ? AND YEAR(p.bonificado_at) = ?)
      )`;
      params.push(Number(month), Number(year));
    }

    const [rows] = await pool.query(
      `${projectSelectSql()}
      ${where}
      ORDER BY
        p.awaiting_params DESC,
        p.bonificado ASC,
        p.updated_at DESC`,
      [...projectSelectParams(req.user.id), ...params]
    );

    const enriched = await attachParticipantsToRows(rows, req.user.id);
    return res.json(enriched);
  } catch (err) {
    console.error('Erro ao buscar projetos:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const getProjectById = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `${projectSelectSql()} WHERE p.id = ?`,
      [...projectSelectParams(req.user.id), req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Projeto não encontrado' });
    const [enriched] = await attachParticipantsToRows(rows, req.user.id);
    return res.json(enriched);
  } catch (err) {
    console.error('Erro ao buscar projeto:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const createProject = async (req, res) => {
  const {
    name, description, status, link,
    progress, dev_seconds, financial_return,
    suggested_value, responsible_id,
  } = req.body;

  if (!name) return res.status(400).json({ error: 'Nome do projeto é obrigatório' });

  try {
    const [result] = await pool.query(
      `INSERT INTO projects_ti
        (name, description, status, link, progress, dev_seconds,
         financial_return, suggested_value, responsible_id, created_by, awaiting_params, bonif_pending_response)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'gestor')`,
      [
        name,
        description || null,
        status || 'completed',
        link || null,
        progress ?? 100,
        dev_seconds || 0,
        financial_return || null,
        suggested_value || null,
        responsible_id || null,
        req.user.id,
      ]
    );

    const [rows] = await pool.query(
      `${projectSelectSql()} WHERE p.id = ?`,
      [...projectSelectParams(req.user.id), result.insertId]
    );
    await record(req.user, 'criou', 'projeto', result.insertId, name, 'Projeto criado manualmente');
    return res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Erro ao criar projeto:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const createFromTask = async (req, res) => {
  const { taskId } = req.params;

  try {
    const [tasks] = await pool.query(
      `SELECT t.*, c.name AS category_name FROM tasks_ti t
       LEFT JOIN task_categories_ti c ON t.category_id = c.id
       WHERE t.id = ?`,
      [taskId]
    );

    if (tasks.length === 0) return res.status(404).json({ error: 'Tarefa não encontrada' });

    const task = tasks[0];
    if (task.status !== 'completed') {
      return res.status(400).json({ error: 'Apenas tarefas concluídas podem ser enviadas para bonificação' });
    }

    const [existing] = await pool.query(
      'SELECT id FROM projects_ti WHERE source_task_id = ?', [taskId]
    );
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Esta tarefa já possui um projeto de bonificação vinculado' });
    }

    const [assigneeRows] = await pool.query(
      'SELECT user_id FROM task_assignees_ti WHERE task_id = ? ORDER BY user_id',
      [taskId]
    );
    const assigneeIds = assigneeRows.map((a) => a.user_id);
    if (assigneeIds.length === 0) {
      return res.status(400).json({ error: 'A tarefa precisa ter pelo menos um responsável para bonificação' });
    }

    const responsibleId = assigneeIds[0];
    const collaborative = assigneeIds.length > 1 ? 1 : 0;

    const [timerSum] = await pool.query(
      'SELECT COALESCE(SUM(dev_seconds), 0) AS total FROM task_user_timers_ti WHERE task_id = ?',
      [taskId]
    );
    const totalDevSeconds = timerSum[0].total || task.dev_seconds || 0;

    const [timerByUser] = await pool.query(
      'SELECT user_id, dev_seconds FROM task_user_timers_ti WHERE task_id = ?',
      [taskId]
    );
    const secByUser = Object.fromEntries(timerByUser.map((t) => [t.user_id, t.dev_seconds]));

    const [result] = await pool.query(
      `INSERT INTO projects_ti
        (name, description, status, progress, dev_seconds, source_task_id,
         responsible_id, created_by, awaiting_params, bonificado, collaborative)
       VALUES (?, NULL, 'completed', 100, ?, ?, ?, ?, 1, 0, ?)`,
      [task.title, totalDevSeconds, taskId, responsibleId, req.user.id, collaborative]
    );

    const projectId = result.insertId;

    for (const uid of assigneeIds) {
      const secs = secByUser[uid] ?? 0;
      await pool.query(
        `INSERT INTO project_bonif_participants_ti (project_id, user_id, dev_seconds, awaiting_params)
         VALUES (?, ?, ?, 1)`,
        [projectId, uid, secs]
      );
    }

    await syncProjectAggregates(projectId);

    const [rows] = await pool.query(
      `${projectSelectSql()} WHERE p.id = ?`,
      [...projectSelectParams(req.user.id), projectId]
    );
    const [enriched] = await attachParticipantsToRows(rows, req.user.id);

    await record(req.user, 'enviou para bonificação', 'projeto', projectId, task.title, `A partir da tarefa #${taskId}`);

    await notifyMultiple(
      assigneeIds,
      'bonif_pending',
      'Parâmetros pendentes',
      collaborative
        ? `O projeto colaborativo "${task.title}" foi enviado para bonificação: cada membro deve preencher seus parâmetros.`
        : `O projeto "${task.title}" foi enviado para bonificação e precisa que você preencha os parâmetros.`,
      '/bonificacao'
    );

    return res.status(201).json(enriched);
  } catch (err) {
    console.error('Erro ao criar projeto a partir da tarefa:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const updateProject = async (req, res) => {
  const { id } = req.params;
  const {
    name, description, status, link,
    progress, dev_seconds, financial_return,
    suggested_value, responsible_id,
  } = req.body;

  try {
    const [existing] = await pool.query(
      'SELECT id, name, awaiting_params, bonificado, source_task_id FROM projects_ti WHERE id = ?',
      [id]
    );
    if (existing.length === 0) return res.status(404).json({ error: 'Projeto não encontrado' });

    const allowed = await canManageProject(req.user, id);
    if (!allowed) {
      return res.status(403).json({ error: 'Você não tem permissão para editar este projeto/bonificação' });
    }

    const [pc] = await pool.query(
      'SELECT COUNT(*) AS c FROM project_bonif_participants_ti WHERE project_id = ?',
      [id]
    );
    const hasParticipants = pc[0].c > 0;

    if (hasParticipants) {
      await pool.query(
        `UPDATE projects_ti SET
          name             = COALESCE(?, name),
          description      = COALESCE(?, description),
          status           = COALESCE(?, status),
          link             = COALESCE(?, link),
          progress         = COALESCE(?, progress),
          dev_seconds      = COALESCE(?, dev_seconds),
          responsible_id   = COALESCE(?, responsible_id),
          updated_at       = NOW()
        WHERE id = ?`,
        [name, description, status, link, progress, dev_seconds, responsible_id, id]
      );

      const [rows] = await pool.query(
        `${projectSelectSql()} WHERE p.id = ?`,
        [...projectSelectParams(req.user.id), id]
      );
      const projectName = rows[0]?.name || existing[0].name;
      await record(req.user, 'editou', 'projeto', Number(id), projectName, 'Dados do projeto atualizados');
      const [enriched] = await attachParticipantsToRows(rows, req.user.id);
      return res.json(enriched);
    }

    const sv = suggested_value != null && suggested_value !== '' ? Number(suggested_value) : null;
    const hasFr = financial_return && String(financial_return).trim();
    const hasParams = (sv != null && !Number.isNaN(sv) && sv > 0) || !!hasFr;
    const newAwaitingParams = hasParams ? 0 : existing[0].awaiting_params;

    let bonifPendingResponse = null;
    if (existing[0].awaiting_params === 1 && newAwaitingParams === 0 && !existing[0].bonificado) {
      bonifPendingResponse = 'gestor';
    }

    await pool.query(
      `UPDATE projects_ti SET
        name             = COALESCE(?, name),
        description      = COALESCE(?, description),
        status           = COALESCE(?, status),
        link             = COALESCE(?, link),
        progress         = COALESCE(?, progress),
        dev_seconds      = COALESCE(?, dev_seconds),
        financial_return = COALESCE(?, financial_return),
        suggested_value  = COALESCE(?, suggested_value),
        hourly_rate      = NULL,
        difficulty       = NULL,
        responsible_id   = COALESCE(?, responsible_id),
        awaiting_params  = ?,
        bonif_pending_response = COALESCE(?, bonif_pending_response),
        updated_at       = NOW()
      WHERE id = ?`,
      [
        name, description, status, link, progress, dev_seconds,
        financial_return, suggested_value, responsible_id, newAwaitingParams,
        bonifPendingResponse, id,
      ]
    );

    const [rows] = await pool.query(
      `${projectSelectSql()} WHERE p.id = ?`,
      [...projectSelectParams(req.user.id), id]
    );
    const projectName = rows[0]?.name || existing[0].name;
    await record(req.user, 'editou', 'projeto', Number(id), projectName, hasParams ? 'Parâmetros preenchidos' : 'Dados atualizados');

    if (hasParams && existing[0].awaiting_params && newAwaitingParams === 0) {
      const [gestores] = await pool.query(
        "SELECT id FROM users WHERE role IN ('gestor','superadmin') AND active = 1"
      );
      await notifyMultiple(
        gestores.map(g => g.id),
        'bonif_ready',
        'Bonificação pronta para aprovação',
        `O projeto "${projectName}" teve os parâmetros preenchidos e está aguardando aprovação.`,
        '/bonificacao'
      );
    }

    const [enriched] = await attachParticipantsToRows(rows, req.user.id);
    return res.json(enriched);
  } catch (err) {
    console.error('Erro ao atualizar projeto:', err.message || err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const updateParticipant = async (req, res) => {
  const { id, participantId } = req.params;
  const { financial_return, suggested_value } = req.body;

  try {
    const [existing] = await pool.query(
      `SELECT bp.*, p.name AS project_name
       FROM project_bonif_participants_ti bp
       JOIN projects_ti p ON p.id = bp.project_id
       WHERE bp.id = ? AND bp.project_id = ?`,
      [participantId, id]
    );
    if (existing.length === 0) return res.status(404).json({ error: 'Participante não encontrado' });

    const bp = existing[0];

    const allowed =
      bp.user_id === req.user.id ||
      ['superadmin', 'admin'].includes(req.user.role) ||
      (await canManageProject(req.user, id));
    if (!allowed) {
      return res.status(403).json({ error: 'Você não tem permissão para editar esta bonificação' });
    }

    if (bp.bonificado) {
      return res.status(400).json({ error: 'Esta bonificação individual já foi concluída' });
    }

    const sv = suggested_value != null && suggested_value !== '' ? Number(suggested_value) : null;
    const hasFr = financial_return && String(financial_return).trim();
    const hasParams = (sv != null && !Number.isNaN(sv) && sv > 0) || !!hasFr;
    const newAwaitingParams = hasParams ? 0 : bp.awaiting_params;

    let bonifPendingResponse = null;
    if (bp.awaiting_params === 1 && newAwaitingParams === 0) {
      bonifPendingResponse = 'gestor';
    }

    await pool.query(
      `UPDATE project_bonif_participants_ti SET
        financial_return = ?,
        suggested_value = ?,
        awaiting_params = ?,
        bonif_pending_response = COALESCE(?, bonif_pending_response),
        updated_at = NOW()
      WHERE id = ?`,
      [
        financial_return != null ? String(financial_return).trim() || null : null,
        suggested_value != null ? sv : null,
        newAwaitingParams,
        bonifPendingResponse,
        participantId,
      ]
    );

    await syncProjectAggregates(id);

    const projectName = bp.project_name;
    await record(
      req.user,
      'editou',
      'projeto',
      Number(id),
      projectName,
      hasParams ? `Parâmetros preenchidos (${participantId})` : 'Bonificação individual atualizada'
    );

    if (hasParams && bp.awaiting_params === 1 && newAwaitingParams === 0) {
      const [gestores] = await pool.query(
        "SELECT id FROM users WHERE role IN ('gestor','superadmin') AND active = 1"
      );
      await notifyMultiple(
        gestores.map((g) => g.id),
        'bonif_ready',
        'Bonificação pronta para aprovação',
        `O projeto "${projectName}" teve parâmetros de bonificação preenchidos (membro do time).`,
        '/bonificacao'
      );
    }

    const [rows] = await pool.query(
      `${projectSelectSql()} WHERE p.id = ?`,
      [...projectSelectParams(req.user.id), id]
    );
    const [enriched] = await attachParticipantsToRows(rows, req.user.id);
    return res.json(enriched);
  } catch (err) {
    console.error('Erro ao atualizar participante:', err.message || err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const deleteProject = async (req, res) => {
  try {
    const [existing] = await pool.query('SELECT id, name FROM projects_ti WHERE id = ?', [req.params.id]);
    if (existing.length === 0) return res.status(404).json({ error: 'Projeto não encontrado' });

    const allowed = await canManageProject(req.user, req.params.id);
    if (!allowed) {
      return res.status(403).json({ error: 'Você não tem permissão para remover este projeto/bonificação' });
    }

    const [result] = await pool.query('DELETE FROM projects_ti WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Projeto não encontrado' });
    await record(req.user, 'apagou', 'projeto', Number(req.params.id), existing[0]?.name, 'Projeto removido');
    return res.json({ message: 'Projeto removido com sucesso' });
  } catch (err) {
    console.error('Erro ao deletar projeto:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const bonificarAction = async (req, res) => {
  const { id } = req.params;
  const { action, approved_value, installment_count: rawInst, participant_id: pidRaw } = req.body;
  const inst = Math.min(12, Math.max(1, parseInt(rawInst ?? 1, 10) || 1));
  let participantId = pidRaw != null ? parseInt(pidRaw, 10) : null;

  const validActions = ['gestor_accept_dev', 'gestor_propose', 'dev_accept', 'dev_counter'];
  if (!validActions.includes(action)) {
    return res.status(400).json({ error: 'Ação inválida' });
  }

  try {
    const [existing] = await pool.query('SELECT * FROM projects_ti WHERE id = ?', [id]);
    if (existing.length === 0) return res.status(404).json({ error: 'Projeto não encontrado' });
    const p = existing[0];

    const [pc] = await pool.query(
      'SELECT id FROM project_bonif_participants_ti WHERE project_id = ?',
      [id]
    );
    const hasParticipants = pc.length > 0;

    if (hasParticipants) {
      if (!participantId || Number.isNaN(participantId)) {
        if (pc.length === 1) {
          participantId = Number(pc[0].id);
        } else {
          return res.status(400).json({ error: 'Informe participant_id (bonificação individual)' });
        }
      }
      const [pRows] = await pool.query(
        `SELECT bp.*, u.name AS member_name
         FROM project_bonif_participants_ti bp
         LEFT JOIN users u ON u.id = bp.user_id
         WHERE bp.id = ? AND bp.project_id = ?`,
        [participantId, id]
      );
      if (!pRows.length) return res.status(404).json({ error: 'Participante não encontrado' });
      const bp = pRows[0];

      if (bp.awaiting_params) {
        return res.status(400).json({ error: 'Preencha os parâmetros desta bonificação antes de continuar' });
      }
      if (bp.bonificado) {
        return res.status(400).json({ error: 'Esta bonificação individual já foi concluída' });
      }

      const gestorTurn = bp.bonif_pending_response !== 'dev';

      const logApprovedOne = async (finalValue, installmentCount, memberUserId) => {
        const detail = finalValue != null
          ? `Valor aprovado: R$ ${finalValue}${installmentCount > 1 ? ` (${installmentCount}x)` : ''} — ${bp.member_name || 'membro'}`
          : null;
        await record(req.user, 'aprovou bonificação', 'bonificacao', Number(id), p.name, detail);

        const fmtVal = finalValue != null
          ? Number(finalValue).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
          : '';
        const instMsg = installmentCount > 1 ? ` em ${installmentCount} parcelas` : '';
        if (memberUserId && memberUserId !== req.user.id) {
          await notifyMultiple(
            [memberUserId],
            'bonif_approved',
            'Bonificação aprovada!',
            `Sua bonificação no projeto "${p.name}" foi aprovada${fmtVal ? ` com valor de ${fmtVal}` : ''}${instMsg}.`,
            '/billing',
            req.user.id
          );
        }
      };

      if (action === 'gestor_accept_dev' || action === 'gestor_propose') {
        if (!['gestor', 'admin', 'superadmin'].includes(req.user.role)) {
          return res.status(403).json({ error: 'Apenas gestor ou admin pode realizar esta ação' });
        }
        if (!gestorTurn) {
          return res.status(400).json({ error: 'Aguardando resposta do desenvolvedor nesta bonificação' });
        }

        if (action === 'gestor_accept_dev') {
          const finalVal = bp.suggested_value != null ? Number(bp.suggested_value) : null;
          if (finalVal == null || Number.isNaN(finalVal) || finalVal <= 0) {
            return res.status(400).json({ error: 'Não há valor sugerido para aprovar nesta linha' });
          }
          await pool.query(
            `UPDATE project_bonif_participants_ti SET
              bonificado = 1,
              approved_value = ?,
              installment_count = ?,
              bonificado_at = NOW(),
              bonificado_by = ?,
              bonif_pending_response = NULL,
              gestor_offer_value = NULL,
              gestor_offer_installments = NULL,
              updated_at = NOW()
            WHERE id = ?`,
            [finalVal, inst, req.user.id, participantId]
          );
          await syncProjectAggregates(id);
          await logApprovedOne(finalVal, inst, bp.user_id);
        } else {
          const val = approved_value != null ? Number(approved_value) : null;
          if (val == null || Number.isNaN(val) || val < 0) {
            return res.status(400).json({ error: 'Informe um valor válido para a contraproposta' });
          }
          await pool.query(
            `UPDATE project_bonif_participants_ti SET
              gestor_offer_value = ?,
              gestor_offer_installments = ?,
              bonif_pending_response = 'dev',
              updated_at = NOW()
            WHERE id = ?`,
            [val, inst, participantId]
          );
          await syncProjectAggregates(id);
          await record(
            req.user,
            'editou',
            'projeto',
            Number(id),
            p.name,
            `Contraproposta (${bp.member_name || bp.user_id}): R$ ${val}`
          );
          await notifyMultiple(
            [bp.user_id],
            'bonif_pending',
            'Contraproposta do gestor',
            `O gestor enviou uma contraproposta para sua bonificação em "${p.name}".`,
            '/bonificacao',
            req.user.id
          );
        }
      } else {
        if (req.user.id !== bp.user_id) {
          return res.status(403).json({ error: 'Apenas o próprio membro pode responder nesta bonificação' });
        }
        if (bp.bonif_pending_response !== 'dev') {
          return res.status(400).json({ error: 'Aguardando resposta do gestor no momento' });
        }

        if (action === 'dev_accept') {
          const gv = bp.gestor_offer_value != null ? Number(bp.gestor_offer_value) : null;
          if (gv == null || Number.isNaN(gv)) {
            return res.status(400).json({ error: 'Não há proposta do gestor para aceitar' });
          }
          const instFinal = bp.gestor_offer_installments != null
            ? Math.min(12, Math.max(1, parseInt(bp.gestor_offer_installments, 10) || 1))
            : 1;
          await pool.query(
            `UPDATE project_bonif_participants_ti SET
              bonificado = 1,
              approved_value = ?,
              installment_count = ?,
              bonificado_at = NOW(),
              bonificado_by = ?,
              bonif_pending_response = NULL,
              gestor_offer_value = NULL,
              gestor_offer_installments = NULL,
              updated_at = NOW()
            WHERE id = ?`,
            [gv, instFinal, req.user.id, participantId]
          );
          await syncProjectAggregates(id);
          await logApprovedOne(gv, instFinal, bp.user_id);
        } else {
          const val = approved_value != null ? Number(approved_value) : null;
          if (val == null || Number.isNaN(val) || val < 0) {
            return res.status(400).json({ error: 'Informe um valor válido' });
          }
          await pool.query(
            `UPDATE project_bonif_participants_ti SET
              suggested_value = ?,
              gestor_offer_value = NULL,
              gestor_offer_installments = NULL,
              bonif_pending_response = 'gestor',
              updated_at = NOW()
            WHERE id = ?`,
            [val, participantId]
          );
          await syncProjectAggregates(id);
          await record(
            req.user,
            'editou',
            'projeto',
            Number(id),
            p.name,
            `Nova sugestão (${bp.member_name || bp.user_id}): R$ ${val}`
          );
          const [gestores] = await pool.query(
            "SELECT id FROM users WHERE role IN ('gestor','superadmin') AND active = 1"
          );
          await notifyMultiple(
            gestores.map((g) => g.id),
            'bonif_ready',
            'Resposta do desenvolvedor',
            `Bonificação em "${p.name}": nova sugestão de ${bp.member_name || 'membro'}.`,
            '/bonificacao'
          );
        }
      }

      const [rows] = await pool.query(
        `${projectSelectSql()} WHERE p.id = ?`,
        [...projectSelectParams(req.user.id), id]
      );
      const [enriched] = await attachParticipantsToRows(rows, req.user.id);
      return res.json(enriched);
    }

    if (p.awaiting_params) {
      return res.status(400).json({ error: 'Preencha os parâmetros do projeto antes de bonificar' });
    }
    if (p.bonificado) {
      return res.status(400).json({ error: 'Este projeto já foi bonificado' });
    }

    const logApproved = async (finalValue, installmentCount) => {
      const detail = finalValue != null
        ? `Valor aprovado: R$ ${finalValue}${installmentCount > 1 ? ` (${installmentCount}x)` : ''}`
        : null;
      await record(req.user, 'aprovou bonificação', 'bonificacao', Number(id), p.name, detail);

      const [proj] = await pool.query(
        'SELECT responsible_id, source_task_id FROM projects_ti WHERE id = ?',
        [id]
      );
      const notifUsers = [];
      if (proj[0]?.responsible_id) notifUsers.push(proj[0].responsible_id);
      if (proj[0]?.source_task_id) {
        const [tas] = await pool.query(
          'SELECT user_id FROM task_assignees_ti WHERE task_id = ?',
          [proj[0].source_task_id]
        );
        tas.forEach((t) => notifUsers.push(t.user_id));
      }
      const fmtVal = finalValue != null
        ? Number(finalValue).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        : '';
      const instMsg = installmentCount > 1 ? ` em ${installmentCount} parcelas` : '';
      await notifyMultiple(
        [...new Set(notifUsers)].filter((uid) => uid !== req.user.id),
        'bonif_approved',
        'Bonificação aprovada!',
        `O projeto "${p.name}" foi aprovado${fmtVal ? ` com valor de ${fmtVal}` : ''}${instMsg}.`,
        '/billing'
      );
    };

    if (action === 'gestor_accept_dev' || action === 'gestor_propose') {
      if (!['gestor', 'admin', 'superadmin'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Apenas gestor ou admin pode realizar esta ação' });
      }
      if (p.bonif_pending_response === 'dev') {
        return res.status(400).json({ error: 'Aguardando resposta do desenvolvedor antes de prosseguir' });
      }

      if (action === 'gestor_accept_dev') {
        const finalVal = p.suggested_value != null ? Number(p.suggested_value) : null;
        if (finalVal == null || Number.isNaN(finalVal) || finalVal <= 0) {
          return res.status(400).json({ error: 'Não há valor sugerido pelo time para aprovar' });
        }
        await pool.query(
          `UPDATE projects_ti SET
            bonificado = 1,
            approved_value = ?,
            installment_count = ?,
            bonificado_at = NOW(),
            bonificado_by = ?,
            bonif_pending_response = NULL,
            gestor_offer_value = NULL,
            gestor_offer_installments = NULL,
            updated_at = NOW()
          WHERE id = ?`,
          [finalVal, inst, req.user.id, id]
        );
        await logApproved(finalVal, inst);
      } else {
        const val = approved_value != null ? Number(approved_value) : null;
        if (val == null || Number.isNaN(val) || val < 0) {
          return res.status(400).json({ error: 'Informe um valor válido para a contraproposta' });
        }
        await pool.query(
          `UPDATE projects_ti SET
            gestor_offer_value = ?,
            gestor_offer_installments = ?,
            bonif_pending_response = 'dev',
            updated_at = NOW()
          WHERE id = ?`,
          [val, inst, id]
        );
        await record(
          req.user,
          'editou',
          'projeto',
          Number(id),
          p.name,
          `Contraproposta de bonificação: R$ ${val}`
        );
        await notifyBonifStakeholders(
          id,
          'Contraproposta do gestor',
          `O gestor enviou uma contraproposta para "${p.name}". Responda na tela de Bonificação.`,
          '/bonificacao',
          req.user.id
        );
      }
    } else {
      const allowed = await canNegotiateAsDev(req.user, p);
      if (!allowed) {
        return res.status(403).json({ error: 'Você não pode responder por esta bonificação' });
      }
      if (p.bonif_pending_response !== 'dev') {
        return res.status(400).json({ error: 'Aguardando resposta do gestor no momento' });
      }

      if (action === 'dev_accept') {
        const gv = p.gestor_offer_value != null ? Number(p.gestor_offer_value) : null;
        if (gv == null || Number.isNaN(gv)) {
          return res.status(400).json({ error: 'Não há proposta do gestor para aceitar' });
        }
        const instFinal = p.gestor_offer_installments != null
          ? Math.min(12, Math.max(1, parseInt(p.gestor_offer_installments, 10) || 1))
          : 1;
        await pool.query(
          `UPDATE projects_ti SET
            bonificado = 1,
            approved_value = ?,
            installment_count = ?,
            bonificado_at = NOW(),
            bonificado_by = ?,
            bonif_pending_response = NULL,
            gestor_offer_value = NULL,
            gestor_offer_installments = NULL,
            updated_at = NOW()
          WHERE id = ?`,
          [gv, instFinal, req.user.id, id]
        );
        await logApproved(gv, instFinal);
      } else {
        const val = approved_value != null ? Number(approved_value) : null;
        if (val == null || Number.isNaN(val) || val < 0) {
          return res.status(400).json({ error: 'Informe um valor válido' });
        }
        await pool.query(
          `UPDATE projects_ti SET
            suggested_value = ?,
            gestor_offer_value = NULL,
            gestor_offer_installments = NULL,
            bonif_pending_response = 'gestor',
            updated_at = NOW()
          WHERE id = ?`,
          [val, id]
        );
        await record(
          req.user,
          'editou',
          'projeto',
          Number(id),
          p.name,
          `Nova sugestão de bonificação: R$ ${val}`
        );
        const [gestores] = await pool.query(
          "SELECT id FROM users WHERE role IN ('gestor','superadmin') AND active = 1"
        );
        await notifyMultiple(
          gestores.map((g) => g.id),
          'bonif_ready',
          'Resposta do desenvolvedor',
          `O projeto "${p.name}" recebeu uma nova sugestão de valor. Revise na Bonificação.`,
          '/bonificacao'
        );
      }
    }

    const [rows] = await pool.query(
      `${projectSelectSql()} WHERE p.id = ?`,
      [...projectSelectParams(req.user.id), id]
    );
    const [enriched] = await attachParticipantsToRows(rows, req.user.id);
    return res.json(enriched);
  } catch (err) {
    console.error('Erro ao atualizar bonificação:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const getStats = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
        COUNT(*)                                                  AS total,
        COALESCE(SUM(awaiting_params = 1), 0)                    AS awaiting,
        COALESCE(SUM(awaiting_params = 0 AND bonificado = 0), 0) AS pending,
        COALESCE(SUM(bonificado = 1), 0)                         AS bonificado
      FROM projects_ti`
    );
    return res.json(rows[0]);
  } catch (err) {
    console.error('Erro ao buscar stats projetos:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// Returns monthly breakdown: list of {year, month, total_projects, total_approved}
const getMonthlyStats = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        x.yr  AS year,
        x.mth AS month,
        COUNT(*) AS total_projects,
        SUM(x.val) AS total_approved
      FROM (
        SELECT
          YEAR(bp.bonificado_at) AS yr,
          MONTH(bp.bonificado_at) AS mth,
          COALESCE(bp.approved_value, bp.suggested_value, 0) AS val
        FROM project_bonif_participants_ti bp
        INNER JOIN projects_ti p ON p.id = bp.project_id AND p.source_task_id IS NOT NULL
        WHERE bp.bonificado = 1 AND bp.bonificado_at IS NOT NULL
        UNION ALL
        SELECT
          YEAR(p.bonificado_at),
          MONTH(p.bonificado_at),
          COALESCE(p.approved_value, p.suggested_value, 0)
        FROM projects_ti p
        WHERE p.source_task_id IS NULL AND p.bonificado = 1 AND p.bonificado_at IS NOT NULL
      ) x
      GROUP BY x.yr, x.mth
      ORDER BY year DESC, month DESC
    `);
    return res.json(rows);
  } catch (err) {
    console.error('Erro ao buscar stats mensais:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// Returns per-user bonification totals for a given month/year
const getMonthlyByUser = async (req, res) => {
  const { month, year } = req.query;
  try {
    const [rows] = await pool.query(`
      SELECT
        u.id,
        u.name,
        u.username,
        u.role,
        COUNT(x.line_id) AS total_projects,
        SUM(x.line_val) AS total_value,
        JSON_ARRAYAGG(JSON_OBJECT(
          'id', x.proj_id,
          'name', x.proj_name,
          'approved_value', x.approved_value,
          'suggested_value', x.suggested_value,
          'bonificado_at', x.bonificado_at,
          'participant_id', x.participant_id,
          'member_name', x.member_name
        )) AS projects
      FROM (
        SELECT
          bp.id AS line_id,
          p.id AS proj_id,
          p.name AS proj_name,
          bp.user_id AS uid,
          bp.approved_value,
          bp.suggested_value,
          bp.bonificado_at,
          bp.id AS participant_id,
          um.name AS member_name,
          COALESCE(bp.approved_value, bp.suggested_value, 0) AS line_val
        FROM project_bonif_participants_ti bp
        JOIN projects_ti p ON p.id = bp.project_id AND p.source_task_id IS NOT NULL
        LEFT JOIN users um ON um.id = bp.user_id
        WHERE bp.bonificado = 1 AND bp.bonificado_at IS NOT NULL
          AND MONTH(bp.bonificado_at) = ? AND YEAR(bp.bonificado_at) = ?
        UNION ALL
        SELECT
          p.id,
          p.id,
          p.name,
          p.responsible_id,
          p.approved_value,
          p.suggested_value,
          p.bonificado_at,
          NULL,
          NULL,
          COALESCE(p.approved_value, p.suggested_value, 0)
        FROM projects_ti p
        WHERE p.source_task_id IS NULL AND p.bonificado = 1 AND p.bonificado_at IS NOT NULL
          AND MONTH(p.bonificado_at) = ? AND YEAR(p.bonificado_at) = ?
      ) x
      JOIN users u ON u.id = x.uid
      GROUP BY u.id, u.name, u.username, u.role
      ORDER BY total_value DESC
    `, [Number(month), Number(year), Number(month), Number(year)]);
    return res.json(rows);
  } catch (err) {
    console.error('Erro ao buscar bonificações por usuário:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// Projects pending bonification (all time) — for calendar/dashboard view
const getPendingByUser = async (req, res) => {
  const { user_id } = req.query;
  try {
    if (user_id) {
      const [rows] = await pool.query(
        `SELECT DISTINCT p.*, u.name AS responsible_name, u.role AS responsible_role
         FROM projects_ti p
         INNER JOIN project_bonif_participants_ti bp ON bp.project_id = p.id
         LEFT JOIN users u ON u.id = p.responsible_id
         WHERE bp.bonificado = 0 AND bp.awaiting_params = 0
           AND bp.user_id = ?
         ORDER BY p.updated_at DESC`,
        [user_id]
      );
      return res.json(rows);
    }
    const [rows] = await pool.query(
      `SELECT p.*, u.name AS responsible_name, u.role AS responsible_role
       FROM projects_ti p
       LEFT JOIN users u ON u.id = p.responsible_id
       WHERE p.bonificado = 0 AND p.awaiting_params = 0
       ORDER BY p.updated_at DESC`
    );
    return res.json(rows);
  } catch (err) {
    console.error('Erro ao buscar projetos pendentes:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const getBillingReport = async (req, res) => {
  const { month, year, responsible_id } = req.query;

  const qp = [];
  let dtBp = '';
  let dtP = '';
  if (month && year) {
    dtBp = ' AND MONTH(bp.bonificado_at) = ? AND YEAR(bp.bonificado_at) = ?';
    dtP = ' AND MONTH(p.bonificado_at) = ? AND YEAR(p.bonificado_at) = ?';
    qp.push(Number(month), Number(year), Number(month), Number(year));
  }
  let fBp = '';
  let fP = '';
  if (['gestor', 'admin', 'superadmin'].includes(req.user.role) && responsible_id) {
    fBp = ' AND bp.user_id = ?';
    fP = ' AND p.responsible_id = ?';
    qp.push(Number(responsible_id), Number(responsible_id));
  }

  try {
    const [rows] = await pool.query(
      `
      (
        SELECT
          p.id,
          p.name,
          p.description,
          p.link,
          p.source_task_id,
          p.created_by,
          bp.dev_seconds,
          bp.financial_return,
          bp.suggested_value,
          bp.approved_value,
          bp.installment_count,
          bp.bonificado_at,
          bp.bonificado_by,
          bp.id AS participant_id,
          um.name AS responsible_name,
          um.username AS responsible_username,
          um.role AS responsible_role,
          cb.name AS created_by_name,
          gb.name AS bonificado_by_name,
          t.title AS source_task_title
        FROM project_bonif_participants_ti bp
        INNER JOIN projects_ti p ON p.id = bp.project_id AND p.source_task_id IS NOT NULL
        LEFT JOIN users um ON um.id = bp.user_id
        LEFT JOIN users cb ON cb.id = p.created_by
        LEFT JOIN users gb ON gb.id = bp.bonificado_by
        LEFT JOIN tasks_ti t ON t.id = p.source_task_id
        WHERE bp.bonificado = 1 AND bp.bonificado_at IS NOT NULL
        ${dtBp}
        ${fBp}
      )
      UNION ALL
      (
        SELECT
          p.id,
          p.name,
          p.description,
          p.link,
          p.source_task_id,
          p.created_by,
          p.dev_seconds,
          p.financial_return,
          p.suggested_value,
          p.approved_value,
          p.installment_count,
          p.bonificado_at,
          p.bonificado_by,
          NULL AS participant_id,
          u.name AS responsible_name,
          u.username AS responsible_username,
          u.role AS responsible_role,
          cb.name AS created_by_name,
          gb.name AS bonificado_by_name,
          t.title AS source_task_title
        FROM projects_ti p
        LEFT JOIN users u ON u.id = p.responsible_id
        LEFT JOIN users cb ON cb.id = p.created_by
        LEFT JOIN users gb ON gb.id = p.bonificado_by
        LEFT JOIN tasks_ti t ON t.id = p.source_task_id
        WHERE p.source_task_id IS NULL AND p.bonificado = 1 AND p.bonificado_at IS NOT NULL
        ${dtP}
        ${fP}
      )
      ORDER BY bonificado_at DESC
      `,
      qp
    );

    const taskIds = [...new Set(rows.map((r) => r.source_task_id).filter(Boolean))];
    let assigneesMap = {};
    if (taskIds.length) {
      const [aRows] = await pool.query(
        `SELECT ta.task_id, u.id, u.name, u.username, u.role
         FROM task_assignees_ti ta
         JOIN users u ON u.id = ta.user_id
         WHERE ta.task_id IN (?)`,
        [taskIds]
      );
      assigneesMap = aRows.reduce((map, row) => {
        if (!map[row.task_id]) map[row.task_id] = [];
        map[row.task_id].push({ id: row.id, name: row.name, username: row.username, role: row.role });
        return map;
      }, {});
    }

    const result = rows.map((row) => ({
      ...row,
      collaborators: row.source_task_id ? assigneesMap[row.source_task_id] || [] : [],
    }));

    return res.json(result);
  } catch (err) {
    console.error('Erro ao buscar relatório de billing:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

module.exports = {
  getAllProjects,
  getProjectById,
  createProject,
  createFromTask,
  updateProject,
  updateParticipant,
  deleteProject,
  getStats,
  getMonthlyStats,
  getMonthlyByUser,
  getPendingByUser,
  bonificarAction,
  getBillingReport,
};
