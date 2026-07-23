import C from '../colors';
import stockvisionLogo from '../../stockvisionLogo.png';

const navLinks = ['Dashboard', 'Markets', 'Reports'];

export default function Navbar({ activeTab, setActiveTab }) {
  return (
    <header
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 56,
        background: C.card,
        borderBottom: `1px solid ${C.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        zIndex: 100,
        backdropFilter: 'blur(8px)',
      }}
    >
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 200 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: C.secondary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          <img
            src={stockvisionLogo}
            alt="StockVision logo"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
        <div>
          <div style={{ color: C.white, fontWeight: 700, fontSize: 16, letterSpacing: '0.02em' }}>
            StockVision
          </div>
          <div style={{ color: C.grey, fontSize: 10, letterSpacing: '0.04em', marginTop: -1 }}>
            AI-Powered Forecasting
          </div>
        </div>
      </div>

      {/* Nav Links */}
      <nav style={{ display: 'flex', gap: 4 }}>
        {navLinks.map((link) => {
          const isActive = link === activeTab;
          return (
            <button
              key={link}
              id={`nav-${link.toLowerCase()}`}
              onClick={() => setActiveTab(link)}
              style={{
                background: isActive ? `${C.blue}22` : 'transparent',
                border: 'none',
                borderRadius: 8,
                color: isActive ? C.blue : C.grey,
                fontFamily: 'Inter, sans-serif',
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                padding: '6px 14px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.color = C.white;
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.color = C.grey;
              }}
            >
              {link}
            </button>
          );
        })}
      </nav>

      {/* Version */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 200, justifyContent: 'flex-end' }}>
        <div style={{ color: C.grey, fontSize: 12 }}>v1.3</div>
      </div>
    </header>
  );
}
