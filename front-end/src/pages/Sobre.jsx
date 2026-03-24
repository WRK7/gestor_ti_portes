import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const SECTIONS = [
  {
    title: 'Dashboard',
    color: '#3b82f6',
    bg: '#eff6ff',
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>,
    steps: [
      'Aqui você visualiza todas as suas tarefas do dia.',
      'Crie novas tarefas clicando em "+ Nova Tarefa". Defina título, prazo, prioridade e responsáveis.',
      'Ao iniciar uma tarefa, o cronômetro começa automaticamente. Pausar pausa o timer.',
      'Tarefas concluídas podem ser enviadas para bonificação clicando no ícone "$".',
      'O botão fica verde quando já foi enviada.',
    ],
  },
  {
    title: 'Bonificação',
    color: '#10b981',
    bg: '#ecfdf5',
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
    steps: [
      'Projetos enviados do Dashboard aparecem com status "Aguardando parâmetros".',
      'Clique em "Preencher Parâmetros" para informar o que o projeto entrega, retorno financeiro e o valor sugerido. O tempo de desenvolvimento continua sendo exibido.',
      'O gestor pode aceitar seu valor ou enviar uma contraproposta; você pode aceitar a proposta do gestor ou sugerir outro valor, até fecharem o valor.',
      'O gestor define o parcelamento (até 12x) ao aceitar sua sugestão ou ao enviar uma contraproposta.',
    ],
  },
  {
    title: 'Billing',
    color: '#8b5cf6',
    bg: '#f5f3ff',
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>,
    steps: [
      'Relatório mensal de todas as bonificações aprovadas.',
      'Filtre por mês, ano e responsável.',
      'Cada card mostra: projeto, colaboradores, tempo de desenvolvimento, valores e parcelamento quando houver.',
      'Use o botão "Imprimir" para gerar um PDF limpo, sem o menu lateral.',
    ],
  },
  {
    title: 'Notificações',
    color: '#f59e0b',
    bg: '#fffbeb',
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
    steps: [
      'O sininho na lateral esquerda mostra suas notificações.',
      'Um badge vermelho indica quantas não lidas você tem.',
      'Você recebe notificações quando: uma tarefa é atribuída a você, uma tarefa atrasa, um projeto precisa de parâmetros, ou uma bonificação é aprovada.',
      'Clique em uma notificação para ir direto à página correspondente.',
    ],
  },
];

const GESTOR_SECTION = {
  title: 'Modo Gestor',
  color: '#ef4444',
  bg: '#fef2f2',
  icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  steps: [
    'Visão consolidada de todas as tarefas de todos os membros do time.',
    'Acompanhe quem está trabalhando em quê, tempos de desenvolvimento e atrasos.',
    'Na tela de Bonificação, o gestor negocia o valor com o time e pode parcelar o total em até 12 vezes.',
    'Acesse os Logs para auditoria completa de ações no sistema.',
  ],
};

export default function Sobre() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isManager = ['gestor', 'admin', 'superadmin'].includes(user?.role);
  const sections = isManager ? [...SECTIONS, GESTOR_SECTION] : SECTIONS;

  return (
    <div className="dashboard sobre-page">
      {/* Mesmo padrão da página Usuários (configurações) */}
      <div className="dashboard-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button type="button" className="btn btn-ghost btn-icon" onClick={() => navigate('/configuracoes')} title="Voltar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <div>
            <h1 className="dashboard-title">Sobre e tutorial</h1>
            <p className="dashboard-date">Guia de uso do sistema e informações do projeto</p>
          </div>
        </div>
      </div>

      <div className="sobre-intro-wrap">
        <p className="sobre-intro-text">
          Este sistema organiza o fluxo de trabalho do TI — da criação de tarefas ao registro de bonificação pelos projetos entregues.
          Abaixo, um guia rápido por seção.
        </p>
      </div>

      <div className="sobre-sections">
          {sections.map((s, i) => (
            <div key={i} className="sobre-card" style={{ '--s-color': s.color, '--s-bg': s.bg }}>
              <div className="sobre-card-header">
                <div className="sobre-card-icon">{s.icon}</div>
                <h2 className="sobre-card-title">{s.title}</h2>
              </div>
              <ol className="sobre-steps">
                {s.steps.map((step, j) => (
                  <li key={j}>
                    <span className="sobre-step-num">{j + 1}</span>
                    <span className="sobre-step-text">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
      </div>

      <div className="sobre-footer">
        <p>Versão 1.0 · Desenvolvido por Wesley da Cruz Gomes da equipe de TI Portes.</p>
      </div>

      <style>{`
        .sobre-page {
          min-height: 100%;
          overflow-y: auto;
          box-sizing: border-box;
        }
        .dashboard { padding: 28px 32px; width: 100%; }
        .dashboard-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; }
        .dashboard-title { font-size: 22px; font-weight: 700; color: var(--gray-900); letter-spacing: -0.3px; }
        .dashboard-date { font-size: 13px; color: var(--gray-400); margin-top: 2px; }

        .sobre-intro-wrap {
          max-width: 560px;
          margin-bottom: 24px;
          padding: 14px 16px;
          background: var(--white);
          border: 1px solid var(--gray-200);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-sm);
        }
        .sobre-intro-text {
          margin: 0;
          font-size: 13px;
          line-height: 1.65;
          color: var(--gray-600);
        }
        @media (max-width: 700px) {
          .dashboard { padding: 20px 16px; }
        }

        /* Grade usa toda a largura; colunas dividem o espaço (auto-fit + 1fr) */
        .sobre-sections {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
          gap: clamp(16px, 2vw, 28px);
          align-items: stretch;
        }
        @media (min-width: 1600px) {
          .sobre-sections {
            grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));
          }
        }
        @media (max-width: 640px) {
          .sobre-sections {
            grid-template-columns: 1fr;
          }
        }

        /* Card */
        .sobre-card {
          display: flex;
          flex-direction: column;
          min-height: 100%;
          background: var(--white);
          border: 1px solid var(--gray-200);
          border-radius: var(--radius-xl);
          padding: 22px 20px;
          box-shadow: var(--shadow-sm);
          transition: all var(--transition);
        }
        .sobre-card:hover {
          border-color: var(--s-color);
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--s-color) 8%, transparent);
        }
        .sobre-card-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 14px;
          padding-bottom: 14px;
          border-bottom: 1px solid var(--gray-100);
        }
        .sobre-card-icon {
          width: 42px;
          height: 42px;
          border-radius: 12px;
          background: var(--s-bg);
          color: var(--s-color);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .sobre-card-title {
          font-size: 16px;
          font-weight: 700;
          color: var(--gray-900);
          margin: 0;
        }

        /* Steps */
        .sobre-steps {
          list-style: none;
          padding: 0;
          margin: 0;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .sobre-steps li {
          display: flex;
          align-items: flex-start;
          gap: 10px;
        }
        .sobre-step-num {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 22px;
          height: 22px;
          border-radius: 50%;
          background: var(--s-bg);
          color: var(--s-color);
          font-size: 11px;
          font-weight: 700;
          flex-shrink: 0;
          margin-top: 1px;
        }
        .sobre-step-text {
          font-size: 13.5px;
          line-height: 1.6;
          color: var(--gray-600);
        }

        .sobre-footer {
          margin-top: 32px;
          padding-top: 16px;
          border-top: 1px solid var(--gray-200);
        }
        .sobre-footer p {
          font-size: 12px;
          color: var(--gray-400);
          margin: 0;
        }
      `}</style>
    </div>
  );
}
