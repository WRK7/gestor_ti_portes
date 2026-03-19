import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';

const DialogContext = createContext(null);

const VARIANTS = {
  danger:  { color: 'var(--red-600)',   iconBg: 'var(--red-50)',   btnBg: 'var(--red-500)',   title: 'Confirmar',    label: 'Remover'   },
  success: { color: 'var(--green-600)', iconBg: 'var(--green-50)', btnBg: 'var(--green-500)', title: 'Sucesso!',     label: 'OK'        },
  warning: { color: 'var(--amber-600)', iconBg: 'var(--amber-50)', btnBg: 'var(--amber-500)', title: 'Atenção',      label: 'Continuar' },
  info:    { color: 'var(--blue-600)',  iconBg: 'var(--blue-50)',  btnBg: 'var(--blue-600)',  title: 'Informação',   label: 'OK'        },
  error:   { color: 'var(--red-600)',   iconBg: 'var(--red-50)',   btnBg: 'var(--red-500)',   title: 'Erro',         label: 'Fechar'    },
};

function DialogIcon({ variant }) {
  const paths = {
    danger: (
      <>
        <polyline points="3 6 5 6 21 6"/>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
      </>
    ),
    success: (
      <>
        <circle cx="12" cy="12" r="10"/>
        <polyline points="9 12 11 14 15 10"/>
      </>
    ),
    error: (
      <>
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </>
    ),
    warning: (
      <>
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="8"/>
        <polyline points="11 12 12 12 12 16"/>
      </>
    ),
  };
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {paths[variant] || paths.info}
    </svg>
  );
}

function DialogBox({ dialog, onConfirm, onCancel }) {
  const variant = dialog.variant || (dialog.type === 'alert' ? 'info' : 'danger');
  const v = VARIANTS[variant] || VARIANTS.info;
  const isConfirm = dialog.type === 'confirm';
  const title = dialog.title || v.title;

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Enter') onConfirm();
      if (e.key === 'Escape' && isConfirm) onCancel();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onConfirm, onCancel, isConfirm]);

  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        background: 'var(--white)',
        borderRadius: 'var(--radius-xl)',
        width: '100%',
        maxWidth: 400,
        boxShadow: 'var(--shadow-xl)',
        border: '1px solid var(--gray-200)',
        animation: 'slideUp 0.2s ease',
        overflow: 'hidden',
      }}
    >
      {/* Icon + Text */}
      <div style={{
        padding: '32px 28px 0',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', textAlign: 'center', gap: 14,
      }}>
        <div style={{
          width: 58, height: 58, borderRadius: '50%',
          background: v.iconBg, color: v.color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <DialogIcon variant={variant} />
        </div>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--gray-900)', margin: '0 0 8px', lineHeight: 1.3 }}>
            {title}
          </h3>
          <p style={{ fontSize: 14, color: 'var(--gray-500)', lineHeight: 1.6, margin: 0, maxWidth: 320 }}>
            {dialog.message}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div style={{
        display: 'flex', gap: 8,
        padding: '24px 28px 28px',
        justifyContent: 'center',
      }}>
        {isConfirm && (
          <button className="btn btn-secondary" onClick={onCancel} style={{ flex: 1 }}>
            Cancelar
          </button>
        )}
        <button
          className="btn"
          onClick={onConfirm}
          autoFocus
          style={{
            flex: isConfirm ? 1 : 0,
            minWidth: isConfirm ? 'auto' : 130,
            background: v.btnBg,
            color: '#fff',
            justifyContent: 'center',
          }}
        >
          {dialog.confirmLabel || v.label}
        </button>
      </div>
    </div>
  );
}

export const DialogProvider = ({ children }) => {
  const [dialog, setDialog] = useState(null);

  /** opts.closeOnBackdropClick === true permite fechar ao clicar no fundo escuro (padrão: não fecha) */
  const confirm = useCallback((message, opts = {}) =>
    new Promise((resolve) => setDialog({ type: 'confirm', message, resolve, ...opts })),
  []);

  const alert = useCallback((message, opts = {}) =>
    new Promise((resolve) => setDialog({ type: 'alert', message, resolve, ...opts })),
  []);

  const handleResult = (result) => {
    dialog?.resolve(result);
    setDialog(null);
  };

  const handleBackdropMouseDown = (e) => {
    if (e.target !== e.currentTarget) return;
    if (dialog?.closeOnBackdropClick) handleResult(false);
  };

  return (
    <DialogContext.Provider value={{ confirm, alert }}>
      {children}
      {dialog && createPortal(
        <div
          role="presentation"
          onMouseDown={handleBackdropMouseDown}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 99999, padding: 20,
            animation: 'fadeIn 0.15s ease',
          }}
        >
          <DialogBox
            dialog={dialog}
            onConfirm={() => handleResult(true)}
            onCancel={() => handleResult(false)}
          />
        </div>,
        document.body
      )}
    </DialogContext.Provider>
  );
};

export const useDialog = () => {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog deve ser usado dentro de DialogProvider');
  return ctx;
};
